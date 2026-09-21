import { describe, it, expect } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { routes } from './routes';

/** Returns the chain of ancestor routes leading to the route with `id`. */
function ancestorsOf(id: string, list: RouteObject[], chain: RouteObject[] = []): RouteObject[] | null {
  for (const r of list) {
    if (r.id === id) return chain;
    if (r.children) {
      const found = ancestorsOf(id, r.children, [...chain, r]);
      if (found) return found;
    }
  }
  return null;
}

describe('route table access control', () => {
  it('declares the public examinee route outside every auth guard', () => {
    const chain = ancestorsOf('examinee', routes);
    expect(chain).not.toBeNull();
    // Only the root layout sits above it — never the instructor (RequireAuth) group or the
    // anonymous-only (RedirectIfAuthenticated) group.
    expect(chain!.map((r) => r.id ?? r.path)).toEqual(['/']);
    expect(chain!.some((r) => r.id === 'instructor')).toBe(false);
  });

  it('keeps the dashboard behind the instructor guard', () => {
    const dashboard = routes[0]!.children!.find((r) => r.id === 'instructor')!;
    expect(dashboard.children!.map((r) => r.path)).toContain('dashboard');
  });
});
