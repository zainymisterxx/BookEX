/**
 * Background cleanup jobs — run on a cron schedule (e.g. hourly via pm2-cron or Vercel cron).
 *
 * Jobs:
 *   1. expireOldListings    — set books with expiresAt < now to status:'expired'
 *   2. cancelStaleExchanges — cancel exchanges stuck in proposed/accepted/in_progress > 30 days
 *   3. warnInactiveUsers    — email active users who haven't logged in for 60+ days
 *   4. sendDonationReminders — remind org reps of pending donations older than 3 days
 *
 * Usage: tsx scripts/cleanup-jobs.ts [--job=expire|stale|all|weekly-digest|inactive-warning|donation-reminders|warm-cache]
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import {
  sendWeeklyDigestEmail,
  sendInactivityWarningEmail,
  sendDonationReminderEmail,
} from '../src/lib/email';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB  = process.env.MONGODB_DB || 'bookex';
const STALE_EXCHANGE_DAYS = 30;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

async function expireOldListings(db: ReturnType<MongoClient['db']>): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.collection('books').updateMany(
    {
      status: 'active',
      expiresAt: { $lt: now },
      deletedAt: { $exists: false },
    },
    { $set: { status: 'expired', updatedAt: now } }
  );
  return result.modifiedCount;
}

async function cancelStaleExchanges(db: ReturnType<MongoClient['db']>): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_EXCHANGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const stale = await db.collection('exchanges').find({
    status: { $in: ['proposed', 'accepted', 'in_progress'] },
    updatedAt: { $lt: cutoff },
  }).toArray();

  if (stale.length === 0) return 0;

  const cancelEntry = {
    status: 'cancelled',
    timestamp: now,
    updatedBy: 'system',
    notes: `Auto-cancelled after ${STALE_EXCHANGE_DAYS} days of inactivity`,
  };

  const exchangeIds = stale.map(e => e._id);

  await db.collection('exchanges').updateMany(
    { _id: { $in: exchangeIds } },
    {
      $set: { status: 'cancelled', updatedAt: now },
      $push: { statusHistory: cancelEntry } as any,
    }
  );

  // Restore books that were on_hold or reserved due to these exchanges
  const bookIds = stale.flatMap(e => [
    String(e.proposerBookId),
    String(e.responderBookId),
  ]).filter(Boolean);

  if (bookIds.length > 0) {
    await db.collection('books').updateMany(
      {
        _id: { $in: bookIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) },
        status: { $in: ['on_hold', 'reserved'] },
      },
      { $set: { status: 'active', updatedAt: now } }
    );
  }

  // Notify both parties of auto-cancellation
  const notifications = stale.flatMap(e => [
    {
      userId: e.proposerId,
      type: 'exchange_update',
      title: 'Exchange Auto-Cancelled',
      message: `An exchange was automatically cancelled due to ${STALE_EXCHANGE_DAYS} days of inactivity.`,
      link: '/exchange/history',
      read: false,
      createdAt: now,
      metadata: { exchangeId: String(e._id) },
    },
    {
      userId: e.responderId,
      type: 'exchange_update',
      title: 'Exchange Auto-Cancelled',
      message: `An exchange was automatically cancelled due to ${STALE_EXCHANGE_DAYS} days of inactivity.`,
      link: '/exchange/history',
      read: false,
      createdAt: now,
      metadata: { exchangeId: String(e._id) },
    },
  ]);

  if (notifications.length > 0) {
    await db.collection('notifications').insertMany(notifications);
  }

  return stale.length;
}

async function sendWeeklyDigest(db: ReturnType<MongoClient['db']>): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const subscribers = await db.collection('users').find({
    'emailPreferences.weeklyDigest': true,
    status: 'active',
    deletedAt: { $exists: false },
    email: { $exists: true },
  }, { projection: { _id: 1, name: 1, email: 1, city: 1, cityNormalized: 1 } }).toArray();

  let sentCount = 0;

  for (const user of subscribers) {
    const city = user.cityNormalized ?? user.city;
    if (!city) continue;

    const cityFilter = user.cityNormalized
      ? { cityNormalized: user.cityNormalized }
      : { city: user.city };

    const recentBooks = await db.collection('books').find({
      ...cityFilter,
      status: 'active',
      createdAt: { $gte: sevenDaysAgo },
      deletedAt: { $exists: false },
    }, { projection: { _id: 1, title: 1, author: 1, condition: 1 } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    if (recentBooks.length === 0) continue;

    const books = recentBooks.map(b => ({
      id: String(b._id),
      title: b.title ?? 'Unknown Title',
      author: b.author ?? 'Unknown Author',
      condition: b.condition ?? 'Unknown',
    }));

    const result = await sendWeeklyDigestEmail(user.email, user.name ?? 'Reader', books);

    if (result.success) {
      sentCount++;
    } else {
      console.error(`[cleanup-jobs] sendWeeklyDigest: failed for ${user.email}: ${result.error}`);
    }
  }

  return sentCount;
}

const INACTIVE_USER_DAYS = 60;
const INACTIVITY_WARN_RESEND_DAYS = 14;
const DONATION_REMINDER_DAYS = 3;

async function warnInactiveUsers(db: ReturnType<MongoClient['db']>): Promise<number> {
  const now = new Date();
  const inactiveCutoff = new Date(now.getTime() - INACTIVE_USER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const warnResendCutoff = new Date(now.getTime() - INACTIVITY_WARN_RESEND_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const candidates = await db.collection('users').find({
    status: 'active',
    deletedAt: { $exists: false },
    email: { $exists: true },
    'emailPreferences.adminActions': { $ne: false },
    $or: [
      { inactivityWarningSentAt: { $exists: false } },
      { inactivityWarningSentAt: { $lt: warnResendCutoff } },
    ],
    $and: [
      {
        $or: [
          { lastLoginAt: { $lt: inactiveCutoff } },
          { $and: [{ lastLoginAt: { $exists: false } }, { createdAt: { $lt: inactiveCutoff } }] },
        ],
      },
    ],
  }).toArray();

  let sentCount = 0;
  const nowIso = now.toISOString();

  for (const user of candidates) {
    const lastLoginAt: string | null = user.lastLoginAt ?? null;
    const result = await sendInactivityWarningEmail(user.email, user.name ?? 'Reader', lastLoginAt);

    if (result.success) {
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { inactivityWarningSentAt: nowIso } }
      );
      sentCount++;
    } else {
      console.error(`[cleanup-jobs] warnInactiveUsers: failed for ${user.email}: ${result.error}`);
    }
  }

  return sentCount;
}

async function sendDonationReminders(db: ReturnType<MongoClient['db']>): Promise<number> {
  const cutoff = new Date(Date.now() - DONATION_REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const pending = await db.collection('donations').find({
    status: 'pending',
    createdAt: { $lt: cutoff },
    reminderSentAt: { $exists: false },
  }).toArray();

  let sentCount = 0;

  for (const donation of pending) {
    // Fetch the organization to get the representative's email
    const org = await db.collection('organizations').findOne(
      { _id: new ObjectId(String(donation.organizationId)) },
      { projection: { email: 1, name: 1, contactPersonName: 1 } }
    );

    if (!org?.email) {
      console.error(`[cleanup-jobs] sendDonationReminders: no email for org ${donation.organizationId}`);
      continue;
    }

    // Fetch donor name for context
    const donor = await db.collection('users').findOne(
      { _id: new ObjectId(String(donation.userId)) },
      { projection: { name: 1 } }
    );

    const recipientName = org.contactPersonName ?? org.name ?? 'Organization Representative';
    const donorName = donor?.name ?? 'A donor';

    const result = await sendDonationReminderEmail(
      org.email,
      recipientName,
      donorName,
      String(donation._id)
    );

    if (result.success) {
      await db.collection('donations').updateOne(
        { _id: donation._id },
        { $set: { reminderSentAt: now } }
      );
      sentCount++;
    } else {
      console.error(`[cleanup-jobs] sendDonationReminders: failed for donation ${donation._id}: ${result.error}`);
    }
  }

  return sentCount;
}

const CACHE_WARM_BOOKS_TTL = 60 * 60;        // 1 hour
const CACHE_WARM_ORGS_TTL  = 60 * 60;        // 1 hour
const CACHE_WARM_BOOKS_KEY = 'cache:warm:recent-books';
const CACHE_WARM_ORGS_KEY  = 'cache:warm:approved-orgs';

async function warmCache(db: ReturnType<MongoClient['db']>): Promise<{ books: number; orgs: number }> {
  const { createClient } = await import('redis');

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = createClient({ url: redisUrl });
  await client.connect();

  try {
    // Top 20 most recently active books
    const recentBooks = await db.collection('books')
      .find({ status: 'active', deletedAt: { $exists: false } })
      .sort({ updatedAt: -1 })
      .limit(20)
      .project({ _id: 1, title: 1, author: 1, condition: 1, city: 1, imageUrl: 1, type: 1, updatedAt: 1 })
      .toArray();

    await client.setEx(CACHE_WARM_BOOKS_KEY, CACHE_WARM_BOOKS_TTL, JSON.stringify(recentBooks));

    // Approved organizations list
    const approvedOrgs = await db.collection('organizations')
      .find({ status: 'approved', isActive: { $ne: false }, deletedAt: { $exists: false } })
      .sort({ name: 1 })
      .project({ _id: 1, name: 1, description: 1, imageUrl: 1, location: 1 })
      .toArray();

    await client.setEx(CACHE_WARM_ORGS_KEY, CACHE_WARM_ORGS_TTL, JSON.stringify(approvedOrgs));

    return { books: recentBooks.length, orgs: approvedOrgs.length };
  } finally {
    await client.disconnect();
  }
}

async function main() {
  const jobArg = process.argv.find(a => a.startsWith('--job='))?.split('=')[1] ?? 'all';
  const client = new MongoClient(MONGODB_URI!);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    console.log(`[cleanup-jobs] connected to ${MONGODB_DB}, running job="${jobArg}"`);

    if (jobArg === 'expire' || jobArg === 'all') {
      const expired = await expireOldListings(db);
      console.log(`[cleanup-jobs] expireOldListings: ${expired} listings expired`);
    }

    if (jobArg === 'stale' || jobArg === 'all') {
      const cancelled = await cancelStaleExchanges(db);
      console.log(`[cleanup-jobs] cancelStaleExchanges: ${cancelled} exchanges cancelled`);
    }

    if (jobArg === 'weekly-digest') {
      const sent = await sendWeeklyDigest(db);
      console.log(`[cleanup-jobs] sendWeeklyDigest: ${sent} digest emails sent`);
    }

    if (jobArg === 'inactive-warning') {
      const warned = await warnInactiveUsers(db);
      console.log(`[cleanup-jobs] warnInactiveUsers: ${warned} warning emails sent`);
    }

    if (jobArg === 'donation-reminders') {
      const reminded = await sendDonationReminders(db);
      console.log(`[cleanup-jobs] sendDonationReminders: ${reminded} reminder emails sent`);
    }

    if (jobArg === 'warm-cache') {
      const { books, orgs } = await warmCache(db);
      console.log(`[cleanup-jobs] warmCache: ${books} books, ${orgs} orgs cached`);
    }

    console.log('[cleanup-jobs] done');
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('[cleanup-jobs] fatal error:', err);
  process.exit(1);
});
