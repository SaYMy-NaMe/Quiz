import { Link } from 'react-router-dom';
import { config } from '@/utils/constants';

export function Component() {
  return (
    <main className="page page--center">
      <div className="card card--narrow">
        <h1>{config.appName}</h1>
        <p>Timed, proctored quizzes distributed by private link.</p>
        <Link className="btn btn--primary" to="/login">
          Instructor sign in
        </Link>
      </div>
    </main>
  );
}
