import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Spinner } from './Spinner';

export function RootLayout() {
  return (
    <Suspense fallback={<Spinner label="Loading…" fullscreen />}>
      <Outlet />
    </Suspense>
  );
}
