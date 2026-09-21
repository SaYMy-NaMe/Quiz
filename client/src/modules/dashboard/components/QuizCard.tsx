import { Link } from 'react-router-dom';
import type { QuizSummary } from '@/types';
import { CopyLinkButton, buildShareUrl } from '@/modules/share';
import { formatPercent } from '@/utils/format';

interface Props {
  quiz: QuizSummary;
  onDelete: (quiz: QuizSummary) => void;
}

export function QuizCard({ quiz, onDelete }: Props) {
  return (
    <article className="card" aria-labelledby={`quiz-${quiz.id}`}>
      <div className="card__header">
        <div>
          <h3 id={`quiz-${quiz.id}`} style={{ marginBottom: 4 }}>
            <Link to={`/dashboard/quizzes/${quiz.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{quiz.title}</Link>
          </h3>
          <div className="row" style={{ gap: '0.4rem' }}>
            <span className={`badge badge--${quiz.status}`}>{quiz.status}</span>
          </div>
        </div>
      </div>
      {quiz.description && <p className="muted small">{quiz.description}</p>}
      <div className="row small muted" style={{ gap: '1rem', marginBottom: '0.75rem' }}>
        <span>{quiz.questionCount} questions</span>
        <span>{quiz.submissionCount} responses</span>
        <span>avg {quiz.averageScore !== null ? `${quiz.averageScore}/${quiz.maxScore} (${formatPercent(quiz.averageScore, quiz.maxScore)})` : '—'}</span>
      </div>
      <div className="row">
        <Link className="btn btn--sm btn--primary" to={`/dashboard/quizzes/${quiz.id}`}>Overview</Link>
        <Link className="btn btn--sm" to={`/dashboard/quizzes/${quiz.id}/edit`}>Edit</Link>
        {quiz.shareToken && quiz.status === 'published' && (
          <CopyLinkButton text={buildShareUrl(quiz.shareToken)} size="btn--sm" />
        )}
        <button type="button" className="btn btn--sm btn--ghost" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={() => onDelete(quiz)}>
          Delete
        </button>
      </div>
    </article>
  );
}
