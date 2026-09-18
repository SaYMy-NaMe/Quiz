import type { Db } from '@/services/database';
import { openDatabase } from '@/services/database';

/**
 * Dependency-injection container. Every module exposes a `create*` factory that
 * receives its collaborators explicitly; nothing reaches for globals.
 */
export interface Container {
  db: Db;
}

export function createContainer(overrides: Partial<Container> = {}): Container {
  const db = overrides.db ?? openDatabase();
  return { db };
}
