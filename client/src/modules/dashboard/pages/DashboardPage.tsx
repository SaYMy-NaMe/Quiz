import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Spinner } from '@/components/Spinner';
import { quizApi } from '@/modules/quiz/services/quiz.api';
import type { QuizSummary } from '@/modules/quiz/types';
import { QuizCard } from '../components/QuizCard';
import { DeleteQuizModal } from '../components/DeleteQuizModal';
import { StatTile } from '../components/StatTile';

export function Component() {
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<QuizSummary | null>(null);
  const [filter, setFilter] = useState<'all' | QuizSummary['status']>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setError(null);
    quizApi
      .list()
      .then((r) => setQuizzes(r.quizzes))
      .catch(() => setError('Could not load your quizzes.'));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (quizzes ?? []).filter((z) => (filter === 'all' || z.status === filter) && (!q || z.title.toLowerCase().includes(q)));
  }, [quizzes, filter, query]);

  const totals = useMemo(() => {
    const list = quizzes ?? [];
    return {
      quizzes: list.length,
      published: list.filter((z) => z.status === 'published').length,
      responses: list.reduce((n, z) => n + z.submissionCount, 0),
    };
  }, [quizzes]);

  return (
    <>
      <Navbar />
      <main className="page page--wide">
        <div className="row row--between" style={{ marginBottom: '1rem' }}>
          <h1>Your quizzes</h1>
          <Link className="btn btn--primary" to="/dashboard/quizzes/new">+ New quiz</Link>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '1.25rem' }}>
          <StatTile value={totals.quizzes} label="Quizzes" />
          <StatTile value={totals.published} label="Published" />
          <StatTile value={totals.responses} label="Total responses" />
        </div>

        <div className="row" style={{ marginBottom: '1rem' }}>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Search by title…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search quizzes" />
          <div className="tabs" style={{ border: 'none', margin: 0 }} role="tablist">
            {(['all', 'draft', 'published', 'closed'] as const).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={`tab ${filter === f ? 'tab--active' : ''}`} onClick={() => setFilter(f)}>
                {f[0]!.toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert alert--error" role="alert">{error} <button className="btn btn--sm" onClick={load}>Retry</button></div>}
        {quizzes === null && !error && <Spinner label="Loading quizzes…" />}
        {quizzes && quizzes.length === 0 && (
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>No quizzes yet</h2>
            <p className="muted">Create your first quiz, add questions and examinee fields, then publish it to get a private link.</p>
            <Link className="btn btn--primary" to="/dashboard/quizzes/new">Create a quiz</Link>
          </div>
        )}
        {quizzes && quizzes.length > 0 && visible.length === 0 && <p className="muted">No quizzes match this filter.</p>}
        <div className="grid">
          {visible.map((q) => (
            <QuizCard key={q.id} quiz={q} onDelete={setToDelete} />
          ))}
        </div>
      </main>
      {toDelete && (
        <DeleteQuizModal
          quizId={toDelete.id}
          title={toDelete.title}
          submissionCount={toDelete.submissionCount}
          onClose={() => setToDelete(null)}
          onDeleted={() => {
            setToDelete(null);
            setQuizzes((list) => (list ?? []).filter((z) => z.id !== toDelete.id));
          }}
        />
      )}
    </>
  );
}
