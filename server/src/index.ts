import { createApp } from '@/app';
import { createContainer } from '@/container';
import { env } from '@/config/env';
import { logger } from '@/services/logger';

const container = createContainer();
const app = createApp(container);

// Housekeeping: drop expired sessions at boot and hourly.
container.auth.purgeExpiredSessions();
setInterval(() => container.auth.purgeExpiredSessions(), 60 * 60 * 1000).unref();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Quiz server listening');
});
