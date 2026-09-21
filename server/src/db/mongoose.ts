import mongoose from 'mongoose';
import { logger } from '@/services/logger';

/**
 * MongoDB connection module. Mongoose buffers model calls until the connection is up,
 * and auto-creates collections and indexes from the schemas (`autoIndex`), so there is no
 * separate migration step: the first write to Atlas materialises the schema.
 */
export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true });
  logger.info({ host: conn.connection.host, db: conn.connection.name }, 'MongoDB connected');
  return conn;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
