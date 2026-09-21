import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/services/logger';
import { connectDatabase, disconnectDatabase } from '@/db/mongoose';

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Quiz server listening'));

  const shutdown = () => {
    logger.info('Shutting down');
    server.close(() => void disconnectDatabase().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
