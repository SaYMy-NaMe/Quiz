import mongoose from 'mongoose';
import { logger } from '@/services/logger';

/**
 * MongoDB connection module. Mongoose auto-creates collections and indexes from the
 * schemas, so there is no migration step: the first write to Atlas materialises the schema.
 */
export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true });
    logger.info({ host: conn.connection.host, db: conn.connection.name }, 'MongoDB connected');
    return conn;
  } catch (err) {
    throw new Error(`${diagnose(err)}\n  → ${describeUri(uri)}`, { cause: err });
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

/** Turns the driver's low-level errors into the one-line diagnosis an operator needs. */
export function diagnose(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/tlsv1 alert internal error|Could not connect to any servers|ReplicaSetNoPrimary|ServerSelectionTimeout/i.test(msg)) {
    return 'Cannot connect to MongoDB Atlas: this machine\'s IP address is almost certainly not on the cluster\'s Network Access list. Atlas → Network Access → Add IP Address (use 0.0.0.0/0 for development).';
  }
  if (/bad auth|Authentication failed/i.test(msg)) return 'MongoDB Atlas rejected the credentials in MONGODB_URI (check the database user, password and URL-encoding of special characters).';
  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) return 'The cluster hostname in MONGODB_URI cannot be resolved (typo in the host, or no DNS/network).';
  if (/Invalid scheme/i.test(msg)) return 'MONGODB_URI must start with mongodb:// or mongodb+srv://.';
  return `MongoDB connection failed: ${msg}`;
}

/** URI with the password masked, for logs. */
export const describeUri = (uri: string): string => uri.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');
