// Environment is loaded and validated first: every other module reads `env` at import time.
import { env } from '@/config/env';
import { createApp } from '@/app';
import { logger } from '@/services/logger';
import { connectDatabase, disconnectDatabase } from '@/db/mongoose';
import { startLocalMongo } from '@/db/local-mongo';

// Nothing may die silently: log, then exit so the process manager restarts us.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

async function main(): Promise<void> {
  // The API is useless without its database, so a failed connection is fatal — but loud and specific.
  const uri = env.MONGODB_URI === 'local' ? await startLocalMongo() : env.MONGODB_URI;
  await connectDatabase(uri);

  const server = createApp().listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV, clientOrigin: env.CLIENT_ORIGIN }, 'Quiz server listening');
    console.log(`\n✔ Server running on http://localhost:${env.PORT}  (health: http://localhost:${env.PORT}/api/health)\n`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error(err.code === 'EADDRINUSE' ? `\n✖ Port ${env.PORT} is already in use. Stop the other process or set PORT in server/.env.\n` : `\n✖ ${err.message}\n`);
    process.exit(1);
  });

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
  console.error(`\n✖ Server did not start.\n${message}\n`);
  process.exit(1);
});
