import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/RootLayout';
import { NotFoundPage } from '@/components/NotFoundPage';
import { RequireAuth, RedirectIfAuthenticated } from '@/modules/auth';

/** Routes are lazily loaded so the examinee path never ships instructor code. */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, lazy: () => import('@/components/HomePage') },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: 'login', lazy: () => import('@/modules/auth/pages').then((m) => ({ Component: m.LoginPage })) },
          {
            path: 'register',
            lazy: () => import('@/modules/auth/pages').then((m) => ({ Component: m.RegisterPage })),
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: 'dashboard',
            lazy: () => import('@/modules/dashboard/pages/DashboardPlaceholder'),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
