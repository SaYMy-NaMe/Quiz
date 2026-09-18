import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared/index.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    globalSetup: ['src/test/global-setup.ts'],
    // Prisma's engine handles one SQLite file per client; files never share a database.
    fileParallelism: true,
  },
});
