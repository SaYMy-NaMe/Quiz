import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { quizApi } from '@/modules/quiz/services/quiz.api';
import type { QuizSummary } from '@/modules/quiz/types';

export function Component() {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  useEffect(() => {
    void quizApi.list().then((r) => setQuizzes(r.quizzes));
  }, []);
  return (
    <>
      <Navbar />
      <main className="page">
        <div className="row row--between">
          <h1>Dashboard</h1>
          <Link className="btn btn--primary" to="/dashboard/quizzes/new">+ New quiz</Link>
        </div>
        <ul>
          {quizzes.map((q) => (
            <li key={q.id}>
              <Link to={`/dashboard/quizzes/${q.id}/edit`}>{q.title}</Link> <span className={`badge badge--${q.status}`}>{q.status}</span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
