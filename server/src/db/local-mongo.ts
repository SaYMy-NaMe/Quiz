import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@/services/logger';

/**
 * Development fallback when Atlas is unreachable (e.g. IP not on the Network Access list):
 * `MONGODB_URI=local` boots an embedded MongoDB (mongodb-memory-server) that persists to
 * server/data/mongo, so data survives restarts without installing MongoDB.
 * Dev-only: mongodb-memory-server is a devDependency and is imported lazily.
 */
export async function startLocalMongo(): Promise<string> {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.resolve('data/mongo');
  fs.mkdirSync(dbPath, { recursive: true });
  const mongod = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger', port: 27017 } });
  const uri = `${mongod.getUri()}quiz_platform`;
  logger.warn({ uri, dbPath }, 'Using LOCAL embedded MongoDB (MONGODB_URI=local) — not Atlas');
  const stop = () => void mongod.stop();
  process.on('exit', stop);
  return uri;
}
