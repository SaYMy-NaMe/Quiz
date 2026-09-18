import { useRouteLoaderData } from 'react-router-dom';
import type { ShareLoaderData } from './share-loader';

export const EXAMINEE_ROUTE_ID = 'examinee';

/**
 * The share loader runs on the parent `quiz/v/:token` route. Child pages must read it by
 * route id — `useLoaderData()` would return the child's own (nonexistent) loader data,
 * crash on destructuring, and surface as the route's 404 error element.
 */
export function useShareData(): ShareLoaderData {
  const data = useRouteLoaderData(EXAMINEE_ROUTE_ID) as ShareLoaderData | undefined;
  if (!data) throw new Error('useShareData must be used under the examinee route');
  return data;
}
