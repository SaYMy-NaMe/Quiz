import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Vitest global setup: migrate ONE template SQLite database with the real Prisma migrations.
 * Each test file then clones the file (see ./db.ts), so every suite gets an isolated,
 * fully-migrated database without paying the migration cost per file.
 */
export const TEMPLATE_DB = path.join(os.tmpdir(), `quiz-test-template-${process.pid}.db`);

export default function setup(): () => void {
  fs.rmSync(TEMPLATE_DB, { force: true });
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: `file:${TEMPLATE_DB}` },
    stdio: 'pipe',
  });
  process.env.QUIZ_TEST_TEMPLATE_DB = TEMPLATE_DB;
  return () => {
    fs.rmSync(TEMPLATE_DB, { force: true });
  };
}
