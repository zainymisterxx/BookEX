/**
 * Background cleanup jobs — run on a cron schedule (e.g. hourly via pm2-cron or Vercel cron).
 *
 * Jobs:
 *   1. expireOldListings   — set books with expiresAt < now to status:'expired'
 *   2. cancelStaleExchanges — cancel exchanges stuck in proposed/accepted/in_progress > 30 days
 *
 * Usage: tsx scripts/cleanup-jobs.ts [--job=expire|stale|all]
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

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

    console.log('[cleanup-jobs] done');
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('[cleanup-jobs] fatal error:', err);
  process.exit(1);
});
