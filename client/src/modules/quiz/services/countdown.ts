/**
 * Observer Pattern: a countdown that publishes `tick` and `expired` events.
 * Remaining time is always derived from the absolute deadline (+ server clock
 * offset) rather than decremented, so refreshes, tab throttling and sleep
 * cannot drift the clock.
 */
export type CountdownEvent = { type: 'tick'; remaining: number } | { type: 'expired' };
export type CountdownListener = (event: CountdownEvent) => void;

export interface Countdown {
  subscribe(listener: CountdownListener): () => void;
  start(): void;
  stop(): void;
  remaining(): number;
}

export interface CountdownOptions {
  /** Absolute ISO deadline (server time). */
  expiresAt: string;
  /** Milliseconds to add to Date.now() to approximate the server clock. */
  clockOffsetMs?: number;
  intervalMs?: number;
  now?: () => number;
}

export function createCountdown({ expiresAt, clockOffsetMs = 0, intervalMs = 250, now = Date.now }: CountdownOptions): Countdown {
  const deadline = new Date(expiresAt).getTime();
  const listeners = new Set<CountdownListener>();
  let handle: ReturnType<typeof setInterval> | null = null;
  let expired = false;
  let lastPublished = -1;

  const remaining = () => Math.max(0, Math.ceil((deadline - (now() + clockOffsetMs)) / 1000));
  const publish = (e: CountdownEvent) => listeners.forEach((l) => l(e));

  const check = () => {
    const r = remaining();
    if (r !== lastPublished) {
      lastPublished = r;
      publish({ type: 'tick', remaining: r });
    }
    if (r <= 0 && !expired) {
      expired = true;
      stop();
      publish({ type: 'expired' });
    }
  };

  const stop = () => {
    if (handle !== null) {
      clearInterval(handle);
      handle = null;
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (handle !== null) return;
      check();
      if (!expired) handle = setInterval(check, intervalMs);
    },
    stop,
    remaining,
  };
}

export const formatClock = (seconds: number): string => {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
