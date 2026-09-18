import { nanoid } from 'nanoid';

/** Internal identifiers: 16 URL-safe chars is plenty for primary keys. */
export const newId = (): string => nanoid(16);
