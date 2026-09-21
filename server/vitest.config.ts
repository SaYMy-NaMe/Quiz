import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared/index.ts'), '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/* 2*/**', '**/* 2.*', '**/* 3*/**', '**/* 3.*'],
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-secret-at-least-16-chars', MONGODB_URI: 'mongodb://placeholder' },
    globalSetup: ['src/test/global-setup.ts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
