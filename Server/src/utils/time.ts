export const nowIso = (): string => new Date().toISOString();

export const addSeconds = (iso: string, seconds: number): string =>
  new Date(new Date(iso).getTime() + seconds * 1000).toISOString();

export const secondsBetween = (fromIso: string, toIso: string): number =>
  Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
