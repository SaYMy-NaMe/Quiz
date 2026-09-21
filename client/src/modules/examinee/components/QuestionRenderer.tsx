import type { PublicQuestion, GradedQuestionResult } from '@/types';
import { assetUrl } from '@/utils/constants';

interface Props {
  question: PublicQuestion;
  index: number;
  value: string | undefined;
  onChange?: (value: string) => void;
  /** When present the renderer is in review mode and shows the grading outcome. */
  result?: GradedQuestionResult | undefined;
}

/** Renders one question in exam mode (editable) or review mode (graded, read-only). */
export function QuestionRenderer({ question, index, value, onChange, result }: Props) {
  const review = Boolean(result);
  const labelId = `q-${question.id}-p`;
  return (
    <article className="question" id={`q-${question.id}`} aria-labelledby={labelId}>
      <div className="row row--between">
        <span className="question__number">
          Question {index + 1}
          {question.required && <span className="gf-required-dot" title="Required"> *</span>}
        </span>
        <span className="muted small">
          {review && result ? (result.needsReview ? 'awaiting review' : `${result.earned}/${result.points}`) : `${question.points} pt${question.points === 1 ? '' : 's'}`}
        </span>
      </div>
      {question.promptType === 'image' && question.imageUrl && (
        <img src={assetUrl(question.imageUrl)} alt={question.prompt || `Question ${index + 1} image`} className="question__image" loading="lazy" decoding="async" />
      )}
      {question.prompt && <p className="question__prompt" id={labelId}>{question.prompt}</p>}

      {question.type === 'mcq' ? (
        <div role="radiogroup" aria-labelledby={labelId}>
          {question.options.map((o) => {
            const selected = value === o.id;
            let cls = 'option';
            if (review && result) {
              if (o.id === result.correctOptionId) cls += ' option--correct';
              else if (selected && !result.correct) cls += ' option--wrong';
            } else if (selected) cls += ' option--selected';
            return (
              <label key={o.id} className={cls}>
                <input type="radio" name={`q-${question.id}`} value={o.id} checked={selected} disabled={review} onChange={() => onChange?.(o.id)} />
                {o.imageUrl && <img src={assetUrl(o.imageUrl)} alt={o.text || 'Choice image'} className="option__image" loading="lazy" decoding="async" />}
                {o.text && <span>{o.text}</span>}
              </label>
            );
          })}
        </div>
      ) : (
        <div>
          <textarea
            className="textarea"
            rows={question.type === 'long' ? 6 : 2}
            value={value ?? ''}
            readOnly={review}
            placeholder={question.type === 'long' ? 'Write your answer…' : 'Your answer'}
            aria-labelledby={labelId}
            onChange={(e) => onChange?.(e.target.value)}
          />
          {review && result?.acceptedAnswers && (
            <p className={`small ${result.correct ? 'alert alert--success' : 'alert alert--error'}`} style={{ marginTop: '0.5rem' }}>
              Accepted: {result.acceptedAnswers.join(' · ')}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
