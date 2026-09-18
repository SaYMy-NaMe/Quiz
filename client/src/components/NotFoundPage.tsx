import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="page page--center">
      <div className="card card--narrow" role="alert">
        <h1>404</h1>
        <p>This page doesn't exist or you don't have access to it.</p>
        <Link className="btn btn--primary" to="/">
          Go home
        </Link>
      </div>
    </main>
  );
}
