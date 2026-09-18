import { describe, it, expect, vi, afterEach } from 'vitest';
import { createProctor, type ViolationEvent } from './proctor';

describe('proctor observer', () => {
  afterEach(() => vi.useRealTimers());

  it('publishes hard violations for visibility/blur/fullscreen-exit with a cooldown', () => {
    vi.useFakeTimers();
    const p = createProctor({ cooldownMs: 1000 });
    const events: ViolationEvent[] = [];
    p.subscribe((e) => events.push(e));
    p.arm();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur')); // hidden => blur ignored, and within cooldown anyway
    expect(events.map((e) => e.kind)).toEqual(['visibility']);

    vi.advanceTimersByTime(1100);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    window.dispatchEvent(new Event('blur'));
    expect(events.map((e) => e.kind)).toEqual(['visibility', 'blur']);

    vi.advanceTimersByTime(1100);
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(events.at(-1)?.kind).toBe('fullscreen-exit');
    expect(events.every((e) => !e.soft)).toBe(true);

    p.disarm();
    vi.advanceTimersByTime(1100);
    window.dispatchEvent(new Event('blur'));
    expect(events).toHaveLength(3);
  });

  it('blocks shortcuts and context menu as soft events', () => {
    const p = createProctor();
    const events: ViolationEvent[] = [];
    p.subscribe((e) => events.push(e));
    p.arm();
    const key = new KeyboardEvent('keydown', { key: 'F12', cancelable: true });
    document.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    const combo = new KeyboardEvent('keydown', { key: 't', ctrlKey: true, cancelable: true });
    document.dispatchEvent(combo);
    expect(combo.defaultPrevented).toBe(true);
    const plain = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    document.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    const ctx = new Event('contextmenu', { cancelable: true });
    document.dispatchEvent(ctx);
    expect(ctx.defaultPrevented).toBe(true);
    expect(events.map((e) => e.kind)).toEqual(['shortcut', 'shortcut', 'contextmenu']);
    expect(events.every((e) => e.soft)).toBe(true);
    p.disarm();
  });
});
