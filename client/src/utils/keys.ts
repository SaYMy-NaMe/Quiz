let counter = 0;
/** Cheap, collision-free keys for client-side draft entities. */
export const nextKey = (prefix = 'k'): string => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
