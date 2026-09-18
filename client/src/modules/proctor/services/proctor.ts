/**
 * Observer Pattern: the proctor watches the document for focus-loss signals
 * and publishes `violation` events. Consumers (the runtime hook) decide what
 * to do — warn, report to the server, auto-submit.
 */
export type ViolationKind = 'visibility' | 'blur' | 'fullscreen-exit' | 'shortcut' | 'contextmenu';

export interface ViolationEvent {
  kind: ViolationKind;
  at: number;
  /** Blocked-but-not-counted events (shortcuts, context menu) are `soft`. */
  soft: boolean;
}

export type ProctorListener = (event: ViolationEvent) => void;

export interface Proctor {
  subscribe(listener: ProctorListener): () => void;
  arm(): void;
  disarm(): void;
  isFullscreen(): boolean;
  requestFullscreen(): Promise<boolean>;
  exitFullscreen(): Promise<void>;
}

export interface ProctorOptions {
  /** Ignore duplicate hard signals within this window (blur + visibilitychange fire together). */
  cooldownMs?: number;
  target?: Document;
  win?: Window;
}

/** Keyboard shortcuts commonly used to leave or inspect the page. */
const BLOCKED_SHORTCUTS: Array<(e: KeyboardEvent) => boolean> = [
  (e) => e.key === 'F12',
  (e) => e.key === 'F11',
  (e) => (e.ctrlKey || e.metaKey) && ['t', 'n', 'w', 'r', 'p', 's', 'u', 'l', 'h', 'j', 'k'].includes(e.key.toLowerCase()),
  (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c', 'n', 't'].includes(e.key.toLowerCase()),
  (e) => e.altKey && (e.key === 'Tab' || e.key === 'F4'),
  (e) => e.metaKey && e.key === 'Tab',
  (e) => e.key === 'Escape',
];

export function createProctor({ cooldownMs = 1500, target = document, win = window }: ProctorOptions = {}): Proctor {
  const listeners = new Set<ProctorListener>();
  let armed = false;
  let lastHard = 0;

  const publish = (kind: ViolationKind, soft: boolean) => {
    const at = Date.now();
    if (!soft) {
      if (at - lastHard < cooldownMs) return;
      lastHard = at;
    }
    listeners.forEach((l) => l({ kind, at, soft }));
  };

  const onVisibility = () => {
    if (target.visibilityState === 'hidden') publish('visibility', false);
  };
  const onBlur = () => {
    // A blur while still visible = window/app switch (Alt+Tab, Cmd+Tab, DevTools).
    if (target.visibilityState === 'visible') publish('blur', false);
  };
  const onFullscreenChange = () => {
    if (!target.fullscreenElement) publish('fullscreen-exit', false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (BLOCKED_SHORTCUTS.some((match) => match(e))) {
      e.preventDefault();
      e.stopPropagation();
      publish('shortcut', true);
    }
  };
  const onContextMenu = (e: Event) => {
    e.preventDefault();
    publish('contextmenu', true);
  };
  const onCopy = (e: Event) => e.preventDefault();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    arm() {
      if (armed) return;
      armed = true;
      target.addEventListener('visibilitychange', onVisibility);
      win.addEventListener('blur', onBlur);
      target.addEventListener('fullscreenchange', onFullscreenChange);
      target.addEventListener('keydown', onKeyDown, true);
      target.addEventListener('contextmenu', onContextMenu, true);
      target.addEventListener('copy', onCopy, true);
      target.addEventListener('cut', onCopy, true);
    },
    disarm() {
      if (!armed) return;
      armed = false;
      target.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('blur', onBlur);
      target.removeEventListener('fullscreenchange', onFullscreenChange);
      target.removeEventListener('keydown', onKeyDown, true);
      target.removeEventListener('contextmenu', onContextMenu, true);
      target.removeEventListener('copy', onCopy, true);
      target.removeEventListener('cut', onCopy, true);
    },
    isFullscreen: () => Boolean(target.fullscreenElement),
    async requestFullscreen() {
      const el = target.documentElement;
      if (target.fullscreenElement) return true;
      if (!el.requestFullscreen) return false;
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        return true;
      } catch {
        return false;
      }
    },
    async exitFullscreen() {
      if (target.fullscreenElement && target.exitFullscreen) {
        await target.exitFullscreen().catch(() => undefined);
      }
    },
  };
}
