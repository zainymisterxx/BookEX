/**
 * BookEx Database Seed Script
 * ─────────────────────────────────────────────────────
 * Populates a fresh MongoDB instance with:
 *   • 1 admin user
 *   • 4 regular users
 *   • 12 book listings (mix of sell & exchange)
 *   • 1 demo community (public) with channels, posts, comments
 *   • 1 proposed exchange between two users
 *   • Sample notifications
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * Requires MONGODB_URI in .env at project root.
 * ─────────────────────────────────────────────────────
 */

import { MongoClient, ObjectId } from 'mongodb';
import bcryptjs from 'bcryptjs';
const { hash } = bcryptjs;
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env manually ────────────────────────────────
const envPath = resolve(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) { console.error('❌  MONGODB_URI not set'); process.exit(1); }

const DB_NAME = 'bookex';
const SALT_ROUNDS = 10;
const now = () => new Date().toISOString();

// ── Helper: normalise text for duplicate detection ────
const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const makeHash  = (title, author) =>
  Buffer.from(`${normalise(title)}:${normalise(author)}`).toString('base64');

// ── IDs (declared upfront so cross-references work) ──
const adminId   = new ObjectId();
const alice     = new ObjectId();
const bob       = new ObjectId();
const carol     = new ObjectId();
const dan       = new ObjectId();

const bookIds   = Array.from({ length: 12 }, () => new ObjectId());
const communityId = new ObjectId();
const channelForumId = new ObjectId().toHexString();
const channelChatId  = new ObjectId().toHexString();
const post1Id    = new ObjectId();
const post2Id    = new ObjectId();
const exchangeId = new ObjectId();

// ── 1. USERS ──────────────────────────────────────────
async function seedUsers(db) {
  const col = db.collection('users');
  const adminPass = await hash('Admin@1234', SALT_ROUNDS);
  const userPass  = await hash('User@1234',  SALT_ROUNDS);

  const users = [
    {
      _id: adminId,
      name: 'BookEx Admin',
      username: 'bookex_admin',
      email: 'admin@bookex.com',
      password: adminPass,
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin',
      city: 'Karachi',
      bio: 'Platform administrator for BookEx.',
      role: 'admin',
      status: 'active',
      profileCompleted: true,
      createdAt: now(),
      updatedAt: now(),
      wishlist: [],
      communities: [communityId],
      emailPreferences: { exchangeProposals: true, exchangeUpdates: true, contactNotifications: true, weeklyDigest: false },
    },
    {
      _id: alice,
      name: 'Alice Khan',
      username: 'alice_k',
      email: 'alice@bookex.com',
      password: userPass,
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Alice',
      city: 'Lahore',
      bio: 'Avid reader | Fantasy & Sci-Fi lover',
      interests: ['fantasy', 'sci-fi', 'mystery'],
      role: 'user',
      status: 'active',
      profileCompleted: true,
      reviews: 2,
      totalRatingPoints: 9,
      averageRating: 4.5,
      createdAt: now(),
      updatedAt: now(),
      wishlist: [],
      communities: [communityId],
      emailPreferences: { exchangeProposals: true, exchangeUpdates: true, contactNotifications: false, weeklyDigest: true },
    },
    {
      _id: bob,
      name: 'Bob Sheikh',
      username: 'bsheikh',
      email: 'bob@bookex.com',
      password: userPass,
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Bob',
      city: 'Islamabad',
      bio: 'History buff and mystery novel fan.',
      interests: ['historical-fiction', 'mystery'],
      role: 'user',
      status: 'active',
      profileCompleted: true,
      reviews: 1,
      totalRatingPoints: 4,
      averageRating: 4.0,
      createdAt: now(),
      updatedAt: now(),
      wishlist: [],
      communities: [communityId],
      emailPreferences: { exchangeProposals: true, exchangeUpdates: true, contactNotifications: true, weeklyDigest: false },
    },
    {
      _id: carol,
      name: 'Carol Ahmed',
      username: 'carol_reads',
      email: 'carol@bookex.com',
      password: userPass,
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Carol',
      city: 'Lahore',
      bio: 'Romance & self-help enthusiast.',
      interests: ['romance', 'self-help'],
      role: 'user',
      status: 'active',
      profileCompleted: true,
      reviews: 0,
      totalRatingPoints: 0,
      averageRating: 0,
      createdAt: now(),
      updatedAt: now(),
      wishlist: [],
      communities: [],
      emailPreferences: { exchangeProposals: true, exchangeUpdates: false, contactNotifications: true, weeklyDigest: true },
    },
    {
      _id: dan,
      name: 'Dan Malik',
      username: 'dan_m',
      email: 'dan@bookex.com',
      password: userPass,
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Dan',
      city: 'Karachi',
      bio: 'Collector of rare books.',
      interests: ['other', 'historical-fiction'],
      role: 'user',
      status: 'active',
      profileCompleted: true,
      reviews: 0,
      totalRatingPoints: 0,
      averageRating: 0,
      createdAt: now(),
      updatedAt: now(),
      wishlist: [],
      communities: [],
      emailPreferences: { exchangeProposals: false, exchangeUpdates: true, contactNotifications: true, weeklyDigest: false },
    },
  ];

  await col.deleteMany({});
  await col.insertMany(users);
  console.log(`✅  Users: inserted ${users.length}`);
}

// ── 2. BOOKS ──────────────────────────────────────────
async function seedBooks(db) {
  const col = db.collection('books');

  const books = [
    // Alice's books
    {
      _id: bookIds[0], title: "The Name of the Wind", author: "Patrick Rothfuss",
      description: "A captivating fantasy novel about the legendary Kvothe, told in his own words.",
      genre: "fantasy", condition: "like-new", type: "exchange",
      imageUrl: "https://covers.openlibrary.org/b/id/8392789-L.jpg",
      sellerId: alice.toHexString(), city: "Lahore", status: "active",
      titleNormalized: normalise("The Name of the Wind"), authorNormalized: normalise("Patrick Rothfuss"),
      duplicateHash: makeHash("The Name of the Wind", "Patrick Rothfuss"),
      createdAt: now(), updatedAt: now(),
    },
    {
      _id: bookIds[1], title: "Dune", author: "Frank Herbert",
      description: "The iconic sci-fi epic set on the desert planet Arrakis.",
      genre: "sci-fi", condition: "used", type: "exchange",
      imageUrl: "https://covers.openlibrary.org/b/id/8231432-L.jpg",
      sellerId: alice.toHexString(), city: "Lahore", status: "active",
      titleNormalized: normalise("Dune"), authorNormalized: normalise("Frank Herbert"),
      duplicateHash: makeHash("Dune", "Frank Herbert"),
      createdAt: now(), updatedAt: now(),
    },
    {
      _id: bookIds[2], title: "Mistborn: The Final Empire", author: "Brandon Sanderson",
      description: "A fantasy heist story set in a world where ash falls from the sky.",
      genre: "fantasy", condition: "new", type: "sell", price: 850,
      imageUrl: "https://covers.openlibrary.org/b/id/8235491-L.jpg",
      sellerId: alice.toHexString(), city: "Lahore", status: "active",
      titleNormalized: normalise("Mistborn The Final Empire"), authorNormalized: normalise("Brandon Sanderson"),
      duplicateHash: makeHash("Mistborn The Final Empire", "Brandon Sanderson"),
      createdAt: now(), updatedAt: now(),
    },

    // Bob's books
    {
      _id: bookIds[3], title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson",
      description: "A gripping mystery thriller set in Sweden.",
      genre: "mystery", condition: "used", type: "exchange",
      imageUrl: "https://covers.openlibrary.org/b/id/8262371-L.jpg",
      sellerId: bob.toHexString(), city: "Islamabad", status: "active",
      titleNormalized: normalise("The Girl with the Dragon Tattoo"), authorNormalized: normalise("Stieg Larsson"),
      duplicateHash: makeHash("The Girl with the Dragon Tattoo", "Stieg Larsson"),
      createdAt: now(), updatedAt: now(),
    },
    {
      _id: bookIds[4], title: "Sapiens", author: "Yuval Noah Harari",
      description: "A brief history of humankind from the Stone Age to the modern era.",
      genre: "historical-fiction", condition: "like-new", type: "sell", price: 1200,
      imageUrl: "https://covers.openlibrary.org/b/id/8628756-L.jpg",
      sellerId: bob.toHexString(), city: "Islamabad", status: "active",
      titleNormalized: normalise("Sapiens"), authorNormalized: normalise("Yuval Noah Harari"),
      duplicateHash: makeHash("Sapiens", "Yuval Noah Harari"),
      createdAt: now(), updatedAt: now(),
    },
    {
      _id: bookIds[5], title: "Gone Girl", author: "Gillian Flynn",
      description: "A psychological thriller about a marriage gone terribly wrong.",
      genre: "mystery", condition: "used", type: "exchange",
      imageUrl: "https://covers.openlibrary.org/b/id/7886069-L.jpg",
      sellerId: bob.toHexString(), city: "Islamabad", status: "active",
      titleNormalized: normalise("Gone Girl"), authorNormalized: normalise("Gillian Flynn"),
      duplicateHash: makeHash("Gone Girl", "Gillian Flynn"),
      createdAt: now(), updatedAt: now(),
    },

    // Carol's books
    {
      _id: bookIds[6], title: "Atomic Habits", author: "James Clear",
      description: "A proven framework for improving every day through tiny changes.",
      genre: "self-help", condition: "new", type: "sell", price: 950,
      imageUrl: "https://covers.openlibrary.org/b/id/10391706-L.jpg",
      sellerId: carol.toHexString(), city: "Lahore", status: "active",
      titleNormalized: normalise("Atomic Habits"), authorNormalized: normalise("James Clear"),
      duplicateHash: makeHash("Atomic Habits", "James Clear"),
      createdAt: now(), updatedAt: now(),
    },
    {
      _id: bookIds[7], title: "Pride and Prejudice", author: "Jane Austen",
      description: "The classic romance novel exploring manners, marriage, and morality.",
      genre: "romance", condition: "worn", type: "exchange",
      imageUrl: "https://covers.openlibrary.org/b/id/8739161-L.jpg",
      sellerId: carol.toHexString(), city: "Lahore", status: "active",
      titleNormalized: normalise("Pride and Prejudice"), authorNormalized: normalise("Jane Austen"),
      duplicateHash: makeHash("Pride and Prejudice", "Jane Austen"),
      createdAt: now(), updatedAt: now(),
    },

    // Dan's books
    {
      _id: bookIds[8], title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams",
      description: "The comedic sci-fi classic about Earth's demolition and one man's journey.",
      genre: "sci-fi", condition: "like-new", type: "exchange",
      imageUrl: "https://covers.openlibrary.org/b/id/7366484-L.jpg",
      sellerId: dan.toHexString(), city: "Karachi", status: "active",
      titleNormalized: normalise("The Hitchhikers Guide to the Galaxy"), authorNormalized: normalise("Douglas Adams"),
      duplicateHash: makeHash("The Hitchhikers Guide to the Galaxy", "Douglas Adams"),
      createdAt: now(), updatedAt: now(),
    },
    {
      _id: bookIds[9], title: "1984", author: "George Orwell",
      description: "The dystopian masterpiece about totalitarianism and surveillance.",
      genre: "sci-fi", condition: "used", type: "sell", price: 700,
      imageUrl: "https://covers.openlibrary.org/b/id/8575708-L.jpg",
      sellerId: dan.toHexString(), city: "Karachi", status: "active",
      titleNormalized: normalise("1984"), authorNormalized: normalise("George Orwell"),
      duplicateHash: makeHash("1984", "George Orwell"),
      createdAt: now(), updatedAt: now(),
    },
    {
      _id: bookIds[10], title: "The Alchemist", author: "Paulo Coelho",
      description: "A philosophical novel about following your dreams across the Sahara.",
      genre: "self-help", condition: "like-new", type: "exchange",
      imageUrl: "https://covers.openlibrary.org/b/id/8236445-L.jpg",
      sellerId: dan.toHexString(), city: "Karachi", status: "active",
      titleNormalized: normalise("The Alchemist"), authorNormalized: normalise("Paulo Coelho"),
      duplicateHash: makeHash("The Alchemist", "Paulo Coelho"),
      createdAt: now(), updatedAt: now(),
    },
    // An in-exchange book (for the demo exchange below)
    {
      _id: bookIds[11], title: "Sherlock Holmes: Complete Collection", author: "Arthur Conan Doyle",
      description: "The full collection of Sherlock Holmes stories and novels.",
      genre: "mystery", condition: "used", type: "exchange",
      imageUrl: "https://covers.openlibrary.org/b/id/8231432-L.jpg",
      sellerId: alice.toHexString(), city: "Lahore", status: "active",
      titleNormalized: normalise("Sherlock Holmes Complete Collection"), authorNormalized: normalise("Arthur Conan Doyle"),
      duplicateHash: makeHash("Sherlock Holmes Complete Collection", "Arthur Conan Doyle"),
      createdAt: now(), updatedAt: now(),
    },
  ];

  await col.deleteMany({});
  await col.insertMany(books);
  console.log(`✅  Books: inserted ${books.length}`);
}

// ── 3. COMMUNITY ──────────────────────────────────────
async function seedCommunities(db) {
  const col = db.collection('communities');

  const community = {
    _id: communityId,
    name: 'BookEx Readers Lounge',
    description: 'The official BookEx community for book lovers! Share recommendations, discuss your favourites, and find your next great read.',
    memberCount: 3,
    imageUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=BookExLounge',
    coverImage: '',
    rules: '1. Be respectful.\n2. No spam.\n3. Keep discussions book-related.\n4. No piracy links.',
    visibility: 'public',
    postingPermissions: 'members_only',
    commentPermissions: 'members_only',
    invitePermissions: 'anyone',
    createdBy: adminId.toHexString(),
    members: [
      { userId: adminId.toHexString(), role: 'creator', joinedAt: now() },
      { userId: alice.toHexString(),   role: 'admin',   joinedAt: now() },
      { userId: bob.toHexString(),     role: 'member',  joinedAt: now() },
    ],
    pendingRequests: [],
    channels: [
      { _id: channelForumId, name: 'general-discussion', type: 'forum', description: 'General book talk', order: 0, createdAt: now() },
      { _id: channelChatId,  name: 'live-chat',          type: 'chat',  description: 'Real-time community chat', order: 1, createdAt: now() },
    ],
    createdAt: now(),
    updatedAt: now(),
  };

  await col.deleteMany({});
  await col.insertOne(community);
  console.log('✅  Communities: inserted 1 (BookEx Readers Lounge)');
}

// ── 4. POSTS ──────────────────────────────────────────
async function seedPosts(db) {
  const col = db.collection('posts');

  const posts = [
    {
      _id: post1Id,
      authorId: alice.toHexString(),
      author: { _id: alice.toHexString(), name: 'Alice Khan', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Alice', role: 'admin' },
      content: "Just finished **The Name of the Wind** by Patrick Rothfuss and I'm absolutely blown away 🤯. If you haven't read it yet, what are you waiting for? The magic system alone is worth it. Who else is a Kingkiller Chronicle fan here?",
      communityId: communityId.toHexString(),
      channelId: channelForumId,
      likes: 4,
      likedBy: [bob.toHexString(), carol.toHexString(), dan.toHexString(), adminId.toHexString()],
      commentCount: 2,
      createdAt: now(),
      isPinned: true,
      pinnedAt: now(),
      pinnedBy: adminId.toHexString(),
      status: 'published',
    },
    {
      _id: post2Id,
      authorId: bob.toHexString(),
      author: { _id: bob.toHexString(), name: 'Bob Sheikh', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Bob', role: 'member' },
      content: "Looking to exchange **Sapiens** by Yuval Harari (like-new condition, Islamabad). Would love a **mystery** or **historical fiction** book in return. Drop a comment or send me a message if you're interested! 📚",
      communityId: communityId.toHexString(),
      channelId: channelForumId,
      likes: 2,
      likedBy: [alice.toHexString(), adminId.toHexString()],
      commentCount: 1,
      createdAt: now(),
      status: 'published',
    },
  ];

  await col.deleteMany({});
  await col.insertMany(posts);
  console.log(`✅  Posts: inserted ${posts.length}`);
}

// ── 5. COMMENTS ───────────────────────────────────────
async function seedComments(db) {
  const col = db.collection('comments');

  const comments = [
    {
      _id: new ObjectId(),
      postId: post1Id.toHexString(),
      communityId: communityId.toHexString(),
      author: { _id: bob.toHexString(), name: 'Bob Sheikh', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Bob' },
      content: "Huge fan! Book 2 (Wise Man's Fear) is even better in my opinion. Can't wait for Doors of Stone 🙏",
      likes: 1,
      likedBy: [alice.toHexString()],
      createdAt: now(),
    },
    {
      _id: new ObjectId(),
      postId: post1Id.toHexString(),
      communityId: communityId.toHexString(),
      author: { _id: adminId.toHexString(), name: 'BookEx Admin', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin' },
      content: 'Welcome to the lounge everyone! Great first post 🎉 Feel free to list your books in the exchange channel too.',
      likes: 2,
      likedBy: [alice.toHexString(), bob.toHexString()],
      createdAt: now(),
    },
    {
      _id: new ObjectId(),
      postId: post2Id.toHexString(),
      communityId: communityId.toHexString(),
      author: { _id: alice.toHexString(), name: 'Alice Khan', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Alice' },
      content: "I have Gone Girl (mystery) in like-new condition based in Lahore — up for exchange! I'll send you a proposal 😊",
      likes: 0,
      likedBy: [],
      createdAt: now(),
    },
  ];

  await col.deleteMany({});
  await col.insertMany(comments);
  console.log(`✅  Comments: inserted ${comments.length}`);
}

// ── 6. EXCHANGE ───────────────────────────────────────
async function seedExchanges(db) {
  const col = db.collection('exchanges');

  const exchange = {
    _id: exchangeId,
    proposerId: bob.toHexString(),
    receiverId: alice.toHexString(),
    proposerBookId: bookIds[5].toHexString(),   // Bob's "Gone Girl"
    receiverBookId: bookIds[11].toHexString(),  // Alice's "Sherlock Holmes"
    status: 'proposed',
    statusHistory: [
      { status: 'proposed', changedAt: now(), changedBy: bob.toHexString(), note: 'Exchange proposed' },
    ],
    message: "Hey Alice! I'd love to exchange my copy of Gone Girl for your Sherlock Holmes collection. Both mystery fans — sounds like a perfect match! 😄",
    createdAt: now(),
    updatedAt: now(),
  };

  await col.deleteMany({});
  await col.insertOne(exchange);
  console.log('✅  Exchanges: inserted 1 (proposed)');
}

// ── 7. NOTIFICATIONS ──────────────────────────────────
async function seedNotifications(db) {
  const col = db.collection('notifications');

  const notifications = [
    {
      _id: new ObjectId(),
      userId: alice.toHexString(),
      type: 'exchange_proposal',
      title: 'New Exchange Proposal',
      message: 'Bob Sheikh wants to exchange "Gone Girl" for your "Sherlock Holmes" collection.',
      link: `/exchange`,
      read: false,
      relatedId: exchangeId.toHexString(),
      relatedType: 'exchange',
      createdAt: now(),
    },
    {
      _id: new ObjectId(),
      userId: adminId.toHexString(),
      type: 'community_activity',
      title: 'New Member Joined',
      message: 'Bob Sheikh joined the BookEx Readers Lounge.',
      link: `/community/${communityId.toHexString()}`,
      read: true,
      relatedId: communityId.toHexString(),
      relatedType: 'community',
      createdAt: now(),
    },
    {
      _id: new ObjectId(),
      userId: bob.toHexString(),
      type: 'community_activity',
      title: 'Welcome to BookEx Readers Lounge!',
      message: 'You have successfully joined the BookEx Readers Lounge community.',
      link: `/community/${communityId.toHexString()}`,
      read: false,
      relatedId: communityId.toHexString(),
      relatedType: 'community',
      createdAt: now(),
    },
  ];

  await col.deleteMany({});
  await col.insertMany(notifications);
  console.log(`✅  Notifications: inserted ${notifications.length}`);
}

// ── 8. REVIEWS ────────────────────────────────────────
async function seedReviews(db) {
  const col = db.collection('reviews');

  const reviews = [
    {
      _id: new ObjectId(),
      reviewerId: bob.toHexString(),
      revieweeId: alice.toHexString(),
      rating: 5,
      comment: 'Alice was fantastic to exchange with — book was exactly as described and communication was fast. Highly recommend!',
      createdAt: now(),
    },
    {
      _id: new ObjectId(),
      reviewerId: alice.toHexString(),
      revieweeId: bob.toHexString(),
      rating: 4,
      comment: 'Great exchange experience. Bob was responsive and the book was in good condition.',
      createdAt: now(),
    },
  ];

  await col.deleteMany({});
  await col.insertMany(reviews);
  console.log(`✅  Reviews: inserted ${reviews.length}`);
}

// ── 9. INDEXES ────────────────────────────────────────
async function ensureIndexes(db) {
  // Users
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ username: 1 }, { sparse: true });

  // Books
  await db.collection('books').createIndex({ sellerId: 1, status: 1 });
  await db.collection('books').createIndex({ city: 1, status: 1 });
  await db.collection('books').createIndex({ genre: 1, status: 1 });
  await db.collection('books').createIndex(
    { title: 'text', author: 'text', description: 'text' },
    { name: 'books_text_search' }
  );

  // Communities
  await db.collection('communities').createIndex({ createdBy: 1 });
  await db.collection('communities').createIndex({ 'members.userId': 1 });

  // Posts
  await db.collection('posts').createIndex({ communityId: 1, channelId: 1, createdAt: -1 });
  await db.collection('posts').createIndex({ authorId: 1 });

  // Comments
  await db.collection('comments').createIndex({ postId: 1, createdAt: 1 });

  // Exchanges
  await db.collection('exchanges').createIndex({ proposerId: 1, status: 1 });
  await db.collection('exchanges').createIndex({ receiverId: 1, status: 1 });

  // Notifications
  await db.collection('notifications').createIndex({ userId: 1, read: 1, createdAt: -1 });

  // Reviews
  await db.collection('reviews').createIndex({ revieweeId: 1 });

  console.log('✅  Indexes: created/verified');
}

// ── MAIN ──────────────────────────────────────────────
async function main() {
  console.log('\n🌱 BookEx Seed Script');
  console.log('─────────────────────────────────────');
  console.log(`📡 Connecting to: ${MONGO_URI.substring(0, 45)}...`);

  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  console.log('✅  Connected to MongoDB\n');

  const db = client.db(DB_NAME);

  await seedUsers(db);
  await seedBooks(db);
  await seedCommunities(db);
  await seedPosts(db);
  await seedComments(db);
  await seedExchanges(db);
  await seedNotifications(db);
  await seedReviews(db);
  await ensureIndexes(db);

  await client.close();

  console.log('\n─────────────────────────────────────');
  console.log('🎉 Seed complete!\n');
  console.log('Demo accounts (all passwords: User@1234):');
  console.log('  👑 admin@bookex.com     (Admin)');
  console.log('  📚 alice@bookex.com     (Lahore  — 3 books listed)');
  console.log('  🔍 bob@bookex.com       (Islamabad — 3 books listed)');
  console.log('  💕 carol@bookex.com     (Lahore  — 2 books listed)');
  console.log('  📖 dan@bookex.com       (Karachi — 3 books listed)');
  console.log('\nAdmin password: Admin@1234');
  console.log('─────────────────────────────────────\n');
}

main().catch((err) => { console.error('❌ Seed failed:', err); process.exit(1); });
