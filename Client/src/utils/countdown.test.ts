import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCountdown, formatClock } from './countdown';

describe('countdown', () => {
  afterEach(() => vi.useRealTimers());

  it('derives remaining from the deadline and emits expired once', () => {
    vi.useFakeTimers();
    const start = Date.now();
    const cd = createCountdown({ expiresAt: new Date(start + 3000).toISOString(), intervalMs: 100 });
    const events: string[] = [];
    cd.subscribe((e) => events.push(e.type === 'tick' ? `t${e.remaining}` : 'x'));
    cd.start();
    expect(cd.remaining()).toBe(3);
    vi.advanceTimersByTime(3500);
    expect(events).toEqual(['t3', 't2', 't1', 't0', 'x']);
    vi.advanceTimersByTime(1000);
    expect(events.filter((e) => e === 'x')).toHaveLength(1);
  });

  it('honours the server clock offset', () => {
    const now = 1_000_000;
    const cd = createCountdown({ expiresAt: new Date(now + 10_000).toISOString(), clockOffsetMs: 5_000, now: () => now });
    expect(cd.remaining()).toBe(5);
  });

  it('formats clocks', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(3661)).toBe('1:01:01');
  });
});
