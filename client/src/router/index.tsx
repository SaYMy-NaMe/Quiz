import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

export { routes } from './routes';

/** Routes are lazily loaded so the examinee path never ships instructor code. */
export const router = createBrowserRouter(routes);
