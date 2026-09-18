import { create } from 'zustand';
import { createCountdown, type Countdown } from '@/utils/countdown';

type TimerStatus = 'idle' | 'running' | 'expired';

/**
 * Timer state is isolated from attempt/answer state so that ticking never
 * re-renders the question list; only the clock subscribes to it.
 */
interface TimerState {
  status: TimerStatus;
  remaining: number;
  total: number;
  start: (opts: { expiresAt: string; startedAt: string; clockOffsetMs: number; onExpire: () => void }) => void;
  stop: () => void;
}

let countdown: Countdown | null = null;
let unsubscribe: (() => void) | null = null;

export const useTimerStore = create<TimerState>((set) => ({
  status: 'idle',
  remaining: 0,
  total: 0,

  start({ expiresAt, startedAt, clockOffsetMs, onExpire }) {
    unsubscribe?.();
    countdown?.stop();
    countdown = createCountdown({ expiresAt, clockOffsetMs });
    const total = Math.max(1, Math.round((new Date(expiresAt).getTime() - new Date(startedAt).getTime()) / 1000));
    unsubscribe = countdown.subscribe((e) => {
      if (e.type === 'tick') set({ remaining: e.remaining, status: e.remaining > 0 ? 'running' : 'expired' });
      else {
        set({ status: 'expired', remaining: 0 });
        onExpire();
      }
    });
    set({ total, status: 'running', remaining: countdown.remaining() });
    countdown.start();
  },

  stop() {
    unsubscribe?.();
    countdown?.stop();
    unsubscribe = null;
    countdown = null;
    set({ status: 'idle' });
  },
}));
