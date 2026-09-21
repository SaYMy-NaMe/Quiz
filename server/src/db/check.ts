import { env } from '@/config/env';
import { connectDatabase, disconnectDatabase, describeUri } from './mongoose';

/** `npm run db:check` — proves (or explains) the MongoDB connection without starting the API. */
connectDatabase(env.MONGODB_URI)
  .then(async (conn) => {
    const collections = await conn.connection.db!.listCollections().toArray();
    console.log(`✔ Connected to ${describeUri(env.MONGODB_URI)}\n  database: ${conn.connection.name}\n  collections: ${collections.map((c) => c.name).join(', ') || '(none yet — created on first write)'}`);
    await disconnectDatabase();
  })
  .catch((err: unknown) => {
    console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
