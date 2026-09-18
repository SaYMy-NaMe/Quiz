import type { PublicQuestion, GradedQuestionResult } from '@/types';
import { assetUrl } from '@/config';

interface Props {
  question: PublicQuestion;
  index: number;
  selected: string | undefined;
  onSelect?: (optionId: string) => void;
  /** When present the renderer is in review mode and highlights the answer key. */
  result?: GradedQuestionResult | undefined;
}

export function McqRenderer({ question, index, selected, onSelect, result }: Props) {
  const review = Boolean(result);
  return (
    <article className="question" id={`q-${question.id}`} aria-labelledby={`q-${question.id}-p`}>
      <div className="row row--between">
        <span className="question__number">Question {index + 1}</span>
        <span className="muted small">
          {review && result ? `${result.earned}/${result.points}` : `${question.points} pt${question.points === 1 ? '' : 's'}`}
        </span>
      </div>
      {question.promptType === 'image' && question.imageUrl && (
        <img src={assetUrl(question.imageUrl)} alt={question.prompt || `Question ${index + 1} image`} className="question__image" loading="lazy" decoding="async" />
      )}
      {question.prompt && (
        <p className="question__prompt" id={`q-${question.id}-p`}>
          {question.prompt}
        </p>
      )}
      <div role="radiogroup" aria-labelledby={`q-${question.id}-p`}>
        {question.options.map((o) => {
          const isSelected = selected === o.id;
          let cls = 'option';
          if (review && result) {
            if (o.id === result.correctOptionId) cls += ' option--correct';
            else if (isSelected && !result.correct) cls += ' option--wrong';
          } else if (isSelected) cls += ' option--selected';
          return (
            <label key={o.id} className={cls}>
              <input type="radio" name={`q-${question.id}`} value={o.id} checked={isSelected} disabled={review} onChange={() => onSelect?.(o.id)} />
              {o.imageUrl && <img src={assetUrl(o.imageUrl)} alt={o.text || 'Choice image'} className="option__image" loading="lazy" decoding="async" />}
              {o.text && <span>{o.text}</span>}
            </label>
          );
        })}
      </div>
    </article>
  );
}
