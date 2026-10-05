import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { env } from './env.js';
import { logger } from './logger.js';

let replSet: MongoMemoryReplSet | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  let uri = env.MONGO_URI;

  if (env.NODE_ENV === 'test' && !process.env.MONGO_URI_TEST) {
    try {
      replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      uri = replSet.getUri();
      logger.info({ uri }, 'Connected to in-memory MongoDB replica set for testing');
    } catch (err) {
      logger.warn({ err }, 'Failed to start in-memory replica set, falling back to configured MONGO_URI');
    }
  }

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 6000,
      retryWrites: true,
      w: 'majority',
    });
    logger.info({ host: conn.connection.host, name: conn.connection.name }, 'MongoDB connected successfully');

    // Auto-seed if database is empty in development mode
    if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test') {
      try {
        const userCount = await conn.connection.db?.collection('users').countDocuments();
        if (userCount === 0) {
          logger.info('Empty database detected in development. Auto-seeding initial clinical fixtures...');
          const { seedDatabase } = await import('../seed/seed.js');
          await seedDatabase(false);
        }
      } catch (seedErr) {
        logger.warn({ err: seedErr }, 'Auto-seed check encountered an issue');
      }
    }

    return conn;
  } catch (err) {
    if (env.NODE_ENV !== 'production' && !replSet) {
      try {
        logger.warn('Local MongoDB unreachable. Starting in-memory MongoDB replica set for development...');
        replSet = await MongoMemoryReplSet.create({
          replSet: { count: 1, storageEngine: 'wiredTiger' },
        });
        uri = replSet.getUri();
        const conn = await mongoose.connect(uri);
        logger.info({ uri }, 'Connected to in-memory MongoDB replica set for development');
        logger.info('Auto-seeding in-memory database with synthetic clinical fixtures...');
        const { seedDatabase } = await import('../seed/seed.js');
        await seedDatabase(false);
        return conn;
      } catch (fallbackErr) {
        logger.error({ err: fallbackErr }, 'Failed to start in-memory MongoDB fallback');
      }
    }
    logger.error({ err }, 'MongoDB connection error');
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}
