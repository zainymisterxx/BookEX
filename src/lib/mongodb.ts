import { MongoClient } from 'mongodb';
import redisCache from './redis-cache';
import dotenv from 'dotenv';

// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
console.log('MongoDB URI being used:', uri ? uri.substring(0, 50) + '...' : 'undefined');

// Server-only MongoDB configuration without client-side encryption
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15000, // increased for Azure VM cold-start / transient restarts
  connectTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof global & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Initialize Redis connection with better error handling
let redisConnected = false;
redisCache.connect()
  .then(() => {
    redisConnected = true;
    console.log('Redis connected successfully');
  })
  .catch((error) => {
    console.error('Failed to connect to Redis:', error);
    console.log('Application will continue without caching');
    redisConnected = false;
  });

// Export Redis connection status for other modules to check
export { redisConnected };

export default clientPromise;

export async function connectToMongoDB() {
  const client = await clientPromise;
  const db = client.db('bookex');
  return { client, db };
}
