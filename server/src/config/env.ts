import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Single source of configuration: `server/.env` (loaded here, no dotenv dependency) plus
 * the process environment. Only PORT / NODE_ENV / MONGODB_URI / JWT_SECRET / CLIENT_ORIGIN
 * are required in practice; the rest have sensible defaults.
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  /** Optional extra CORS origins, comma-separated; `https://*.vercel.app` wildcards allowed. */
  CLIENT_ORIGINS: z.string().default(''),
  UPLOAD_DIR: z.string().default('./uploads'),
  /** Built client to serve with an SPA fallback when present (single-service deployments). */
  CLIENT_DIST: z.string().default('../client/dist'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadDotEnv(): void {
  const file = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  try {
    process.loadEnvFile(file);
  } catch {
    /* malformed .env is ignored; explicit env vars still apply */
  }
}

if (process.env.NODE_ENV !== 'test') loadDotEnv();

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
}
export const env: Env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const allowedOrigins = [...new Set([env.CLIENT_ORIGIN, ...env.CLIENT_ORIGINS.split(',')].map((o) => o.trim()).filter(Boolean))];
