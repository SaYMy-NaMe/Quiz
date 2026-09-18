import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/RootLayout';
import { NotFoundPage } from '@/components/NotFoundPage';
import { RequireAuth, RedirectIfAuthenticated } from '@/modules/auth';
import { shareLoader } from './share-loader';

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
          { path: 'dashboard', lazy: () => import('@/modules/dashboard/pages/DashboardPage') },
          { path: 'dashboard/quizzes/:id', lazy: () => import('@/modules/dashboard/pages/QuizOverviewPage') },
          {
            path: 'dashboard/quizzes/new',
            lazy: () => import('@/modules/quiz/pages').then((m) => ({ Component: m.QuizEditorPage })),
          },
          {
            path: 'dashboard/quizzes/:id/edit',
            lazy: () => import('@/modules/quiz/pages').then((m) => ({ Component: m.QuizEditorPage })),
          },
        ],
      },
      {
        path: 'quiz/v/:token',
        loader: shareLoader,
        errorElement: <NotFoundPage />,
        children: [
          { index: true, lazy: () => import('@/modules/examinee/pages/QuizEntryPage') },
          { path: 'test', lazy: () => import('@/modules/examinee/pages/QuizTestPage') },
          { path: 'result', lazy: () => import('@/modules/examinee/pages/QuizResultPage') },
          { path: 'leaderboard', lazy: () => import('@/modules/leaderboard/pages/PublicLeaderboardPage') },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
