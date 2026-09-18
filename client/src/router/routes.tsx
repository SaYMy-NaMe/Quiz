import type { RouteObject } from 'react-router-dom';
import { RootLayout } from '@/components/RootLayout';
import { NotFoundPage } from '@/components/NotFoundPage';
import { RouteErrorPage } from '@/components/RouteErrorPage';
import { RequireAuth, RedirectIfAuthenticated } from '@/modules/auth';
import { shareLoader } from './share-loader';
import { EXAMINEE_ROUTE_ID } from './useShareData';

/**
 * Route table. Structure matters for access control:
 *
 *   /            public
 *   /login …     RedirectIfAuthenticated (anonymous only)
 *   /dashboard … RequireAuth (instructor only)
 *   /quiz/v/:token … PUBLIC — declared as a sibling of the guarded groups, never inside them,
 *                    so a copied share link opens for anyone with no session at all.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
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
        id: 'instructor',
        element: <RequireAuth />,
        children: [
          { path: 'dashboard', lazy: () => import('@/modules/dashboard/pages/DashboardPage') },
          { path: 'dashboard/quizzes/:id', lazy: () => import('@/modules/dashboard/pages/QuizOverviewPage') },
          {
            path: 'dashboard/quizzes/new',
            lazy: () => import('@/modules/builder/pages').then((m) => ({ Component: m.QuizEditorPage })),
          },
          {
            path: 'dashboard/quizzes/:id/edit',
            lazy: () => import('@/modules/builder/pages').then((m) => ({ Component: m.QuizEditorPage })),
          },
        ],
      },
      {
        id: EXAMINEE_ROUTE_ID,
        path: 'quiz/v/:token',
        loader: shareLoader,
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, lazy: () => import('@/modules/examinee/pages/QuizEntryPage') },
          { path: 'test', lazy: () => import('@/modules/examinee/pages/QuizTestPage') },
          { path: 'result', lazy: () => import('@/modules/examinee/pages/QuizResultPage') },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
