import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/services/logger';
import { connectDatabase, disconnectDatabase } from '@/db/mongoose';

async function main(): Promise<void> {
  // The API is useless without its database, so a failed connection is fatal — but loud and specific.
  await connectDatabase(env.MONGODB_URI);
  const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV, clientOrigin: env.CLIENT_ORIGIN }, 'Quiz server listening'));

  const shutdown = () => {
    logger.info('Shutting down');
    server.close(() => void disconnectDatabase().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error({ cause: err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined }, `Fatal startup error: ${message}`);
  // Plain stderr copy so the diagnosis is readable even without a pino pretty-printer.
  console.error(`\n✖ Server did not start.\n${message}\n`);
  process.exit(1);
});
