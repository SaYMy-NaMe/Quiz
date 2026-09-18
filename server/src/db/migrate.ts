import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '@/services/logger';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Ensures the directory behind a `file:` SQLite URL exists so Prisma can create the database. */
export function ensureSqliteDirectory(databaseUrl: string): void {
  if (!databaseUrl.startsWith('file:')) return;
  const raw = databaseUrl.slice('file:'.length).split('?')[0] ?? '';
  if (!raw || raw === ':memory:') return;
  // Prisma resolves relative sqlite paths from the prisma/ directory.
  const file = path.isAbsolute(raw) ? raw : path.resolve(serverRoot, 'prisma', raw);
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

/**
 * Automated schema creation: applies every pending migration in prisma/migrations at
 * startup (`prisma migrate deploy`). On a fresh SQLite file this creates the database and
 * all tables/indexes; on an existing one it only applies what is missing. Works unchanged
 * against PostgreSQL.
 */
export function migrateDatabase(databaseUrl: string): void {
  ensureSqliteDirectory(databaseUrl);
  const prismaCli = path.join(serverRoot, 'node_modules', 'prisma', 'build', 'index.js');
  logger.info('Applying database migrations…');
  const output = execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  const summary = output.split('\n').filter((l) => /migration|No pending|already in sync/i.test(l)).join(' · ');
  logger.info(summary || 'Database schema up to date');
}
