import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_PATH: z.string().default('./data/quiz.db'),
  UPLOAD_DIR: z.string().default('./uploads'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(72),
  /** Directory of the built client to serve in production (empty disables static serving). */
  CLIENT_DIST: z.string().default('../client/dist'),
});

export type Env = z.infer<typeof EnvSchema>;

/** Loads `.env` next to the server package when present (no dependency: Node ≥ 21.7). */
function loadDotEnv(): void {
  const file = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  try {
    process.loadEnvFile(file);
  } catch {
    /* malformed .env is ignored; explicit env vars still apply */
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

if (process.env.NODE_ENV !== 'test') loadDotEnv();
export const env: Env = loadEnv();
