/**
 * End-to-end examinee flow in jsdom, exactly as a fresh incognito tab would see it:
 * no session, no localStorage, the quiz fetched from the public API by token.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '@/router/routes';
import { useAttemptStore } from '@/store/attempt.store';
import { useTimerStore } from '@/store/timer.store';
import { config } from '@/config';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const quiz = {
  id: 'quiz1',
  title: 'Incognito Quiz',
  description: 'desc',
  durationSeconds: 300,
  accessMode: 'public',
  examineeFields: [{ fieldId: 'name', label: 'Name', type: 'text', required: true }],
  questionCount: 1,
};
const questions = [{ id: 'q1', prompt: '2+2', promptType: 'text', options: [{ id: 'o1', text: '4' }, { id: 'o2', text: '5' }], points: 1 }];
const now = () => new Date().toISOString();

interface Call { method: string; url: string; body: unknown; headers: Record<string, string> }
const calls: Call[] = [];
let attemptStatus: 'in_progress' | 'submitted' = 'in_progress';
let requestFullscreen = vi.fn(() => Promise.resolve());
let exitFullscreen = vi.fn(() => Promise.resolve());

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
  // Requests are absolute when VITE_API_URL is set; normalise to the API-relative path.
  const url = config.apiOrigin && raw.startsWith(config.apiOrigin) ? raw.slice(config.apiOrigin.length) : raw;
  const method = init?.method ?? 'GET';
  const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
  calls.push({ method, url, body, headers: (init?.headers as Record<string, string> | undefined) ?? {} });
  const attempt = () => ({ id: 'att1', quizId: quiz.id, examinee: { name: 'Stu' }, status: attemptStatus, startedAt: now(), expiresAt: new Date(Date.now() + 300_000).toISOString(), violations: 0 });
  if (url === `/api/share/${TOKEN}`) return json({ quiz });
  if (url.endsWith('/attempts/validate')) return json({ examinee: (body as { examinee: unknown }).examinee });
  if (url.endsWith('/attempts') && method === 'POST') return json({ attempt: attempt(), questions, serverTime: now() }, 201);
  if (url.endsWith('/attempts/att1')) return json({ attempt: attempt(), questions, serverTime: now() });
  if (url.endsWith('/violations')) return json({ violations: 1, threshold: 2, shouldSubmit: false });
  if (url.endsWith('/submit')) {
    attemptStatus = 'submitted';
    return json({ receipt: { submissionId: 'sub1', score: 1, maxScore: 1, durationSeconds: 3, submittedAt: now(), reason: (body as { reason: string }).reason } });
  }
  if (url.endsWith('/result')) return json({ receipt: { submissionId: 'sub1', score: 1, maxScore: 1, durationSeconds: 3, submittedAt: now(), reason: 'manual' } });
  return json({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
}

// jsdom's AbortSignal is not Node's, so Node's `Request` rejects react-router's loader signal.
// Bridge it: construct without the signal and expose the original via a property.
const NodeRequest = globalThis.Request;
class BridgedRequest extends NodeRequest {
  readonly #signal: AbortSignal | undefined;
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init ? { ...init, signal: null } : undefined);
    this.#signal = init?.signal ?? undefined;
  }
  override get signal(): AbortSignal {
    return this.#signal ?? super.signal;
  }
}

describe('examinee flow from a copied share link (no session)', () => {
  beforeEach(() => {
    vi.stubGlobal('Request', BridgedRequest);
    calls.length = 0;
    attemptStatus = 'in_progress';
    localStorage.clear();
    useAttemptStore.setState({ token: null, attempt: null, questions: [], answers: {}, receipt: null });
    useTimerStore.getState().stop();
    vi.stubGlobal('fetch', vi.fn(fakeFetch));
    // jsdom has no Fullscreen API; emulate a browser that grants it.
    let fs: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fs });
    requestFullscreen = vi.fn(() => { fs = document.documentElement; return Promise.resolve(); });
    exitFullscreen = vi.fn(() => { fs = null; return Promise.resolve(); });
    document.documentElement.requestFullscreen = requestFullscreen;
    document.exitFullscreen = exitFullscreen;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('opens Step 1, starts the timed exam on "Start Quiz", records a violation, submits and releases the lock', async () => {
    const router = createMemoryRouter(routes, { initialEntries: [`/quiz/v/${TOKEN}`] });
    render(<RouterProvider router={router} />);

    // Step 1 — quiz resolved from the public API, metadata form rendered, no auth involved.
    await screen.findByRole('heading', { name: 'Incognito Quiz' });
    expect(calls[0]).toMatchObject({ method: 'GET', url: `/api/share/${TOKEN}` });
    expect(calls.some((c) => c.url.includes('/auth/'))).toBe(false);
    expect(calls.some((c) => 'Authorization' in c.headers)).toBe(false);
    expect(useTimerStore.getState().status).toBe('idle');

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Stu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2 gate — validated on the server, nothing started yet.
    await screen.findByRole('button', { name: /Start Quiz/ });
    expect(calls.some((c) => c.url.endsWith('/attempts/validate'))).toBe(true);
    expect(calls.some((c) => c.url.endsWith('/attempts') && c.method === 'POST')).toBe(false);
    expect(useTimerStore.getState().status).toBe('idle');

    fireEvent.click(screen.getByRole('button', { name: /Start Quiz/ }));

    // Timer running, fullscreen requested, question visible.
    await screen.findByText('2+2');
    expect(requestFullscreen).toHaveBeenCalled();
    await waitFor(() => expect(useTimerStore.getState().status).toBe('running'));
    expect(screen.getByRole('timer').textContent).toMatch(/0[45]:\d\d/);

    // Tab switch → proctor warning + server report.
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await screen.findByRole('heading', { name: /Warning 1 of 2/ });
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/violations'))).toBe(true));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent.click(screen.getByRole('button', { name: 'Return to test' }));

    // Answer and submit.
    fireEvent.click(screen.getByLabelText('4'));
    fireEvent.click(screen.getAllByRole('button', { name: /^Submit/ })[0]!);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit now' }));

    // Step 3 — result page, lock released.
    await screen.findByText('1/1');
    expect(calls.find((c) => c.url.endsWith('/submit'))?.body).toMatchObject({ answers: { q1: 'o1' }, reason: 'manual' });
    expect(exitFullscreen).toHaveBeenCalled();
    expect(useTimerStore.getState().status).toBe('idle');
    const violationCalls = calls.filter((c) => c.url.endsWith('/violations')).length;
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(calls.filter((c) => c.url.endsWith('/violations')).length).toBe(violationCalls);
  });
});
