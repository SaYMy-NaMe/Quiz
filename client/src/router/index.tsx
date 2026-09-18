import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/components/RootLayout';
import { NotFoundPage } from '@/components/NotFoundPage';

/** Routes are lazily loaded so the examinee path never ships instructor code. */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, lazy: () => import('@/components/HomePage') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
