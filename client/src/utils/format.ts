const dateTime = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export const formatTimestamp = (iso: string): string => dateTime.format(new Date(iso));

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export const formatPercent = (score: number, max: number): string =>
  max > 0 ? `${Math.round((score / max) * 100)}%` : '—';
