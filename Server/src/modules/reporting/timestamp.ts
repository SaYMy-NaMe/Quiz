/** ISO-8601 with millisecond precision, always UTC — unambiguous in spreadsheets. */
export const toIso = (iso: string): string => new Date(iso).toISOString();

/** Excel stores dates as serials; passing a Date lets the cell keep a real date type. */
export const toDate = (iso: string): Date => new Date(iso);

export const formatHms = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
};

export const safeFilename = (title: string): string =>
  title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60) || 'quiz';
