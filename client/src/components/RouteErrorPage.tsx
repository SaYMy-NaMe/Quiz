import { Link, isRouteErrorResponse, useRouteError, useRevalidator } from 'react-router-dom';
import { HttpError } from '@/utils/api';

/**
 * Route-level error boundary. Only a genuine 404/403 renders as "not found";
 * network failures and server errors get an honest message with a retry so an
 * outage is never mistaken for a dead link.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const revalidator = useRevalidator();

  const notFound = (isRouteErrorResponse(error) && (error.status === 404 || error.status === 403)) || (error instanceof HttpError && (error.status === 404 || error.status === 403));

  if (notFound) {
    return (
      <main className="page page--center">
        <div className="card card--narrow" role="alert">
          <h1>404</h1>
          <p>This quiz link is invalid, has been closed by the instructor, or requires a personal invite link.</p>
          <Link className="btn btn--primary" to="/">Go home</Link>
        </div>
      </main>
    );
  }

  const detail = error instanceof HttpError ? `Server responded ${error.status}: ${error.message}` : error instanceof Error ? error.message : 'Unknown error';
  return (
    <main className="page page--center">
      <div className="card card--narrow" role="alert">
        <h1>Couldn't load this page</h1>
        <p className="muted">We couldn't reach the quiz server. Check your connection and try again — the link itself may be fine.</p>
        <p className="small mono muted">{detail}</p>
        <div className="row">
          <button className="btn btn--primary" onClick={() => revalidator.revalidate()} disabled={revalidator.state === 'loading'}>
            {revalidator.state === 'loading' ? 'Retrying…' : 'Try again'}
          </button>
          <button className="btn" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    </main>
  );
}
