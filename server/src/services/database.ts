import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '@/config/env';

export type Db = DatabaseSyncType;

/**
 * `node:sqlite` is resolved through `process.getBuiltinModule` so that bundlers
 * (Vite/vitest) which predate the module never try to resolve the specifier.
 */
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS instructors (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_instructor ON sessions(instructor_id);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  access_mode TEXT NOT NULL DEFAULT 'public',
  share_token TEXT UNIQUE,
  duration_seconds INTEGER NOT NULL DEFAULT 600,
  reveal_answers INTEGER NOT NULL DEFAULT 0,
  leaderboard_visible INTEGER NOT NULL DEFAULT 1,
  examinee_fields TEXT NOT NULL DEFAULT '[]',
  questions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quizzes_owner ON quizzes(owner_id);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  UNIQUE(quiz_id, email)
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  examinee TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  violations INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON attempts(quiz_id);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id) ON DELETE CASCADE,
  examinee TEXT NOT NULL,
  answers TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL,
  duration_seconds INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  violations INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'manual'
);
CREATE INDEX IF NOT EXISTS idx_submissions_quiz ON submissions(quiz_id);

CREATE TABLE IF NOT EXISTS violation_events (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
`;

/** Opens (and migrates) the SQLite database using Node's built-in driver. */
export function openDatabase(dbPath: string = env.DATABASE_PATH): Db {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/** Runs `fn` inside a transaction, rolling back on throw. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
