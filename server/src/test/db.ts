import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createContainer, type Container } from '@/container';

let counter = 0;

/** Clones the migrated template database into a fresh file and opens a Prisma client on it. */
export function createTestDb(): PrismaClient {
  const template = process.env.QUIZ_TEST_TEMPLATE_DB;
  if (!template) throw new Error('Test template database missing — is src/test/global-setup.ts configured?');
  const file = path.join(os.tmpdir(), `quiz-test-${process.pid}-${Date.now()}-${counter++}.db`);
  fs.copyFileSync(template, file);
  const client = new PrismaClient({ datasourceUrl: `file:${file}` });
  cleanups.push(async () => {
    await client.$disconnect();
    fs.rmSync(file, { force: true });
  });
  return client;
}

const cleanups: (() => Promise<void>)[] = [];

/** A fully wired container on an isolated database. */
export function createTestContainer(): Container {
  return createContainer({ db: createTestDb() });
}

export async function cleanupTestDbs(): Promise<void> {
  await Promise.all(cleanups.splice(0).map((fn) => fn()));
}
