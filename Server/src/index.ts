import { createApp } from '@/app';
import { createContainer } from '@/container';
import { env } from '@/config/env';
import { logger } from '@/services/logger';
import { migrateDatabase } from '@/db/migrate';

async function main(): Promise<void> {
  // Schema is created / migrated programmatically before the first request.
  if (env.AUTO_MIGRATE) migrateDatabase(env.DATABASE_URL);

  const container = createContainer();
  await container.db.$connect();
  const app = createApp(container);

  // Housekeeping: drop expired sessions at boot and hourly.
  await container.auth.purgeExpiredSessions();
  setInterval(() => void container.auth.purgeExpiredSessions(), 60 * 60 * 1000).unref();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV, db: env.DATABASE_URL.split('@').pop() }, 'Quiz server listening');
  });

  const shutdown = () => {
    logger.info('Shutting down');
    server.close(() => void container.db.$disconnect().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
