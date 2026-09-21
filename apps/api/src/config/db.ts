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
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      w: 'majority',
    });
    logger.info({ host: conn.connection.host, name: conn.connection.name }, 'MongoDB connected successfully');
    return conn;
  } catch (err) {
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
