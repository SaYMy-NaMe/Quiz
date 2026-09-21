import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach, inject } from 'vitest';

const dbName = `quiz_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName });
});

/** Every test starts from empty collections (indexes are kept). */
afterEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
