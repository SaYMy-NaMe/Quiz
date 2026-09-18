import { MAX_OPTIONS, MIN_OPTIONS } from '@shared';
import type { DraftQuestion } from '@/types';
import { useEditorStore } from '@/store/editor.store';
import { ImageUploader } from './ImageUploader';

interface QuestionEditorProps {
  question: DraftQuestion;
  index: number;
  total: number;
  errors?: Record<string, string>;
}

/**
 * Google-Forms-style MCQ card: prompt (text or image), 2–6 choices each with optional
 * image, and an explicit answer-key selector used for background grading.
 */
export function QuestionEditor({ question, index, total, errors = {} }: QuestionEditorProps) {
  const { updateQuestion, removeQuestion, moveQuestion, addOption, removeOption, updateOption, setCorrect } = useEditorStore();
  const qk = question.key;
  const correctIndex = question.options.findIndex((o) => o.key === question.correctKey);

  return (
    <section className="gf-card" aria-labelledby={`q-${qk}-title`}>
      <div className="gf-field-head">
        <div className="field" style={{ marginBottom: 0 }}>
          <span id={`q-${qk}-title`} className="question__number">Question {index + 1}</span>
          <textarea
            className="gf-input"
            rows={2}
            value={question.prompt}
            placeholder={question.promptType === 'image' ? 'Caption (optional)' : 'Question'}
            aria-label={`Question ${index + 1} prompt`}
            onChange={(e) => updateQuestion(qk, { prompt: e.target.value })}
            aria-invalid={errors.prompt ? 'true' : undefined}
          />
          {errors.prompt && <span className="field__error" role="alert">{errors.prompt}</span>}
        </div>
        <select className="select" value={question.promptType} aria-label="Prompt type" onChange={(e) => updateQuestion(qk, { promptType: e.target.value as DraftQuestion['promptType'] })}>
          <option value="text">Text prompt</option>
          <option value="image">Image prompt</option>
        </select>
      </div>

      {question.promptType === 'image' && (
        <div style={{ marginTop: '0.75rem' }}>
          <ImageUploader label="Question image" value={question.imageUrl} onChange={(imageUrl) => updateQuestion(qk, { imageUrl })} />
          {errors.imageUrl && <span className="field__error" role="alert">{errors.imageUrl}</span>}
        </div>
      )}

      <fieldset style={{ border: 'none', padding: 0, margin: '1rem 0 0' }}>
        <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
          Choices ({MIN_OPTIONS}–{MAX_OPTIONS}) · tick the radio to set the answer key
        </legend>
        {question.options.map((o, i) => {
          const isCorrect = question.correctKey === o.key;
          return (
            <div className="option-row" key={o.key} style={isCorrect ? { background: 'var(--success-soft)', borderRadius: 8, padding: '0.35rem 0.5rem' } : { padding: '0.35rem 0.5rem' }}>
              <input type="radio" name={`correct-${qk}`} checked={isCorrect} onChange={() => setCorrect(qk, o.key)} aria-label={`Mark choice ${i + 1} as the correct answer`} title="Correct answer" />
              <div className="row" style={{ gap: '0.5rem', flexWrap: 'nowrap' }}>
                <input className="gf-input" placeholder={`Option ${i + 1}`} value={o.text} onChange={(e) => updateOption(qk, o.key, { text: e.target.value })} aria-invalid={errors[`options.${i}`] ? 'true' : undefined} aria-label={`Choice ${i + 1} text`} />
                <ImageUploader compact label={`Choice ${i + 1} image`} value={o.imageUrl} onChange={(imageUrl) => updateOption(qk, o.key, { imageUrl })} />
                {isCorrect && <span className="badge badge--published">✓ Correct</span>}
              </div>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => removeOption(qk, o.key)} disabled={question.options.length <= MIN_OPTIONS} aria-label={`Remove choice ${i + 1}`}>✕</button>
            </div>
          );
        })}
        {errors.options && <span className="field__error" role="alert">{errors.options}</span>}
        <div className="row row--between" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn btn--sm" onClick={() => addOption(qk)} disabled={question.options.length >= MAX_OPTIONS}>+ Add choice</button>
          <span className="small muted">Answer key: {correctIndex >= 0 ? `Option ${correctIndex + 1}` : 'not set'}</span>
        </div>
      </fieldset>

      <div className="gf-toolbar">
        <label className="row small" style={{ marginRight: 'auto' }}>
          Points
          <input type="number" className="input" style={{ width: 80 }} min={0.5} step={0.5} value={question.points} onChange={(e) => updateQuestion(qk, { points: Number(e.target.value) || 1 })} aria-label="Points" />
        </label>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveQuestion(qk, -1)} disabled={index === 0} aria-label="Move up">↑</button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveQuestion(qk, 1)} disabled={index === total - 1} aria-label="Move down">↓</button>
        <button type="button" className="btn btn--sm btn--ghost" style={{ color: 'var(--danger)' }} onClick={() => removeQuestion(qk)} disabled={total === 1}>🗑 Delete</button>
      </div>
    </section>
  );
}
