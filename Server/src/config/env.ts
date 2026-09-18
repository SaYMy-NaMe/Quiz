import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Prisma connection string: `file:../data/quiz.db` (SQLite) or a postgresql:// URL. */
  DATABASE_URL: z.string().min(1).default('file:../data/quiz.db'),
  /** Apply pending Prisma migrations on startup. */
  AUTO_MIGRATE: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),
  UPLOAD_DIR: z.string().default('./uploads'),
  /** Primary client origin (kept for simple setups). */
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  /** Comma-separated additional origins; `https://*.vercel.app` style wildcards allowed. */
  CLIENT_ORIGINS: z.string().default(''),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(72),
  /** Directory of the built client to serve in production (empty disables static serving). */
  CLIENT_DIST: z.string().default('../Client/dist'),
  /** Cookie SameSite policy. Use 'none' (requires HTTPS=true) when the client is on another site. */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  /** Set to true only when the app is served over HTTPS (enables secure cookies + upgrade-insecure-requests). */
  HTTPS: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
});

export type Env = z.infer<typeof EnvSchema>;

/** Every origin the API should accept, de-duplicated. */
export const allowedOrigins = (e: Env): string[] =>
  [...new Set([e.CLIENT_ORIGIN, ...e.CLIENT_ORIGINS.split(',')].map((o) => o.trim()).filter(Boolean))];

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
