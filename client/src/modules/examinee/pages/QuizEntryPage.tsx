import { useLoaderData } from 'react-router-dom';
import type { ShareLoaderData } from '@/router/share-loader';

/** Placeholder entry; the 2-stage wizard lands in the examinee-ui stage. */
export function Component() {
  const { quiz } = useLoaderData() as ShareLoaderData;
  return (
    <main className="page page--center">
      <div className="card card--narrow">
        <h1>{quiz.title}</h1>
        <p className="muted">{quiz.description}</p>
        <p>
          {quiz.questionCount} questions · {Math.round(quiz.durationSeconds / 60)} minutes
        </p>
      </div>
    </main>
  );
}
