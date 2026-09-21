import { MIN_MCQ_OPTIONS } from '@shared';
import type { DraftQuestion } from '@/types';
import { useEditorStore } from '@/store/editor.store';
import { ImageUploader } from './ImageUploader';

interface QuestionEditorProps {
  question: DraftQuestion;
  index: number;
  total: number;
  errors?: Record<string, string>;
}

const TYPE_LABEL: Record<DraftQuestion['type'], string> = { mcq: 'Multiple choice', short: 'Short answer', long: 'Long answer (paragraph)' };

/**
 * Google-Forms-style question card. MCQs take any number of choices (≥ 2) with an explicit
 * answer key; short answers can carry auto-grading keys; long answers are graded by hand.
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
          <textarea className="gf-input" rows={2} value={question.prompt} placeholder={question.promptType === 'image' ? 'Caption (optional)' : 'Question'} aria-label={`Question ${index + 1} prompt`} onChange={(e) => updateQuestion(qk, { prompt: e.target.value })} aria-invalid={errors.prompt ? 'true' : undefined} />
          {errors.prompt && <span className="field__error" role="alert">{errors.prompt}</span>}
        </div>
        <div className="stack" style={{ gap: '0.4rem' }}>
          <select className="select" value={question.type} aria-label="Question type" onChange={(e) => updateQuestion(qk, { type: e.target.value as DraftQuestion['type'] })}>
            {(Object.keys(TYPE_LABEL) as DraftQuestion['type'][]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
          <select className="select" value={question.promptType} aria-label="Prompt type" onChange={(e) => updateQuestion(qk, { promptType: e.target.value as DraftQuestion['promptType'] })}>
            <option value="text">Text prompt</option>
            <option value="image">Image prompt</option>
          </select>
        </div>
      </div>

      {question.promptType === 'image' && (
        <div style={{ marginTop: '0.75rem' }}>
          <ImageUploader label="Question image" value={question.imageUrl} onChange={(imageUrl) => updateQuestion(qk, { imageUrl })} />
          {errors.imageUrl && <span className="field__error" role="alert">{errors.imageUrl}</span>}
        </div>
      )}

      {question.type === 'mcq' && (
        <fieldset style={{ border: 'none', padding: 0, margin: '1rem 0 0' }}>
          <legend className="field__label" style={{ marginBottom: '0.4rem' }}>Choices · tick the radio to set the answer key</legend>
          {question.options.map((o, i) => {
            const isCorrect = question.correctKey === o.key;
            return (
              <div className="option-row" key={o.key} style={{ padding: '0.35rem 0.5rem', ...(isCorrect ? { background: 'var(--success-soft)', borderRadius: 8 } : {}) }}>
                <input type="radio" name={`correct-${qk}`} checked={isCorrect} onChange={() => setCorrect(qk, o.key)} aria-label={`Mark choice ${i + 1} as the correct answer`} />
                <div className="row" style={{ gap: '0.5rem', flexWrap: 'nowrap' }}>
                  <input className="gf-input" placeholder={`Option ${i + 1}`} value={o.text} onChange={(e) => updateOption(qk, o.key, { text: e.target.value })} aria-invalid={errors[`options.${i}`] ? 'true' : undefined} aria-label={`Choice ${i + 1} text`} />
                  <ImageUploader compact label={`Choice ${i + 1} image`} value={o.imageUrl} onChange={(imageUrl) => updateOption(qk, o.key, { imageUrl })} />
                  {isCorrect && <span className="badge badge--published">✓ Correct</span>}
                </div>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => removeOption(qk, o.key)} disabled={question.options.length <= MIN_MCQ_OPTIONS} aria-label={`Remove choice ${i + 1}`}>✕</button>
              </div>
            );
          })}
          {errors.options && <span className="field__error" role="alert">{errors.options}</span>}
          <div className="row row--between" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn btn--sm" onClick={() => addOption(qk)}>+ Add choice</button>
            <span className="small muted">Answer key: {correctIndex >= 0 ? `Option ${correctIndex + 1}` : 'not set'}</span>
          </div>
        </fieldset>
      )}

      {question.type === 'short' && (
        <div className="field" style={{ marginTop: '1rem' }}>
          <label className="field__label" htmlFor={`q-${qk}-keys`}>Accepted answers (one per line, case-insensitive)</label>
          <textarea id={`q-${qk}-keys`} className="textarea" rows={3} value={question.acceptedAnswers} onChange={(e) => updateQuestion(qk, { acceptedAnswers: e.target.value })} placeholder={'Paris\nparis, France'} />
          <span className="field__hint">Leave empty to grade this question by hand from the Responses tab.</span>
        </div>
      )}

      {question.type === 'long' && <p className="muted small" style={{ marginTop: '1rem' }}>Examinees write a paragraph. You grade it manually from the Responses tab.</p>}

      <div className="gf-toolbar">
        <label className="row small" style={{ marginRight: 'auto' }}>
          Points
          <input type="number" className="input" style={{ width: 80 }} min={0} step={0.5} value={question.points} onChange={(e) => updateQuestion(qk, { points: Math.max(0, Number(e.target.value) || 0) })} aria-label="Points" />
        </label>
        <label className="switch">
          <input type="checkbox" checked={question.required} onChange={(e) => updateQuestion(qk, { required: e.target.checked })} />
          <span>Required</span>
        </label>
        <span className="gf-toolbar__sep" aria-hidden="true" />
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveQuestion(qk, -1)} disabled={index === 0} aria-label="Move up">↑</button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveQuestion(qk, 1)} disabled={index === total - 1} aria-label="Move down">↓</button>
        <button type="button" className="btn btn--sm btn--ghost" style={{ color: 'var(--danger)' }} onClick={() => removeQuestion(qk)} disabled={total === 1}>🗑 Delete</button>
      </div>
    </section>
  );
}
