import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';
import { logger } from '@/services/logger';

export type Db = PrismaClient;

/**
 * Database access goes through Prisma. The connection string (and, for a Postgres
 * move, the provider in prisma/schema.prisma) is the only thing that changes when
 * swapping SQLite for PostgreSQL/Supabase — repositories, services and routers stay put.
 */
export function createPrisma(datasourceUrl: string = env.DATABASE_URL): PrismaClient {
  return new PrismaClient({
    datasourceUrl,
    log: env.NODE_ENV === 'development' ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }] : [],
  });
}

/** Runs `fn` inside an interactive transaction. */
export const transaction = <T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> =>
  db.$transaction((tx) => fn(tx as Db));

/** Parses a JSON column with a typed fallback. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err }, 'Malformed JSON column');
    return fallback;
  }
}
