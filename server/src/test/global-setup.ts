import { MongoMemoryServer } from 'mongodb-memory-server';
import type { GlobalSetupContext } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/** One in-memory MongoDB for the whole run; each test file uses its own database name. */
export default async function setup({ provide }: GlobalSetupContext): Promise<() => Promise<void>> {
  const mongod = await MongoMemoryServer.create();
  provide('mongoUri', mongod.getUri());
  return async () => {
    await mongod.stop();
  };
}
