import { MAX_OPTIONS, MIN_OPTIONS } from '@shared';
import type { DraftQuestion } from '../types';
import { useEditorStore } from '../store/editor.store';
import { ImageUploader } from './ImageUploader';

interface QuestionEditorProps {
  question: DraftQuestion;
  index: number;
  total: number;
  errors?: Record<string, string>;
}

export function QuestionEditor({ question, index, total, errors = {} }: QuestionEditorProps) {
  const {
    updateQuestion, removeQuestion, moveQuestion, addOption, removeOption, updateOption, setCorrect,
  } = useEditorStore();
  const qk = question.key;
  const promptId = `q-${qk}-prompt`;

  return (
    <section className="builder-item" aria-labelledby={`q-${qk}-title`}>
      <div className="builder-item__head">
        <h3 id={`q-${qk}-title`}>Question {index + 1}</h3>
        <div className="row">
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveQuestion(qk, -1)} disabled={index === 0} aria-label="Move up">↑</button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveQuestion(qk, 1)} disabled={index === total - 1} aria-label="Move down">↓</button>
          <button type="button" className="btn btn--sm btn--danger" onClick={() => removeQuestion(qk)} disabled={total === 1}>Remove</button>
        </div>
      </div>

      <div className="row" role="radiogroup" aria-label="Prompt type" style={{ marginBottom: '0.75rem' }}>
        {(['text', 'image'] as const).map((t) => (
          <label key={t} className="checkbox">
            <input type="radio" name={`ptype-${qk}`} checked={question.promptType === t} onChange={() => updateQuestion(qk, { promptType: t })} />
            {t === 'text' ? 'Text prompt' : 'Image prompt'}
          </label>
        ))}
      </div>

      {question.promptType === 'image' && (
        <ImageUploader value={question.imageUrl} onChange={(imageUrl) => updateQuestion(qk, { imageUrl })} />
      )}
      {errors.imageUrl && <span className="field__error" role="alert">{errors.imageUrl}</span>}

      <div className="field">
        <label className="field__label" htmlFor={promptId}>
          {question.promptType === 'image' ? 'Caption (optional)' : 'Prompt'}
          {question.promptType === 'text' && <span className="req" aria-hidden="true">*</span>}
        </label>
        <textarea id={promptId} className="textarea" value={question.prompt} onChange={(e) => updateQuestion(qk, { prompt: e.target.value })} aria-invalid={errors.prompt ? 'true' : undefined} />
        {errors.prompt && <span className="field__error" role="alert">{errors.prompt}</span>}
      </div>

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
          Options ({MIN_OPTIONS}–{MAX_OPTIONS}) — select the correct answer
        </legend>
        {question.options.map((o, i) => (
          <div className="option-row" key={o.key}>
            <input
              type="radio"
              name={`correct-${qk}`}
              checked={question.correctKey === o.key}
              onChange={() => setCorrect(qk, o.key)}
              aria-label={`Mark option ${i + 1} as correct`}
            />
            <input
              className="input"
              placeholder={`Option ${i + 1}`}
              value={o.text}
              onChange={(e) => updateOption(qk, o.key, e.target.value)}
              aria-invalid={errors[`options.${i}`] ? 'true' : undefined}
              aria-label={`Option ${i + 1} text`}
            />
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => removeOption(qk, o.key)} disabled={question.options.length <= MIN_OPTIONS} aria-label={`Remove option ${i + 1}`}>✕</button>
          </div>
        ))}
        {errors.options && <span className="field__error" role="alert">{errors.options}</span>}
        <div className="row row--between">
          <button type="button" className="btn btn--sm" onClick={() => addOption(qk)} disabled={question.options.length >= MAX_OPTIONS}>+ Add option</button>
          <label className="row small">
            Points
            <input type="number" className="input" style={{ width: 80 }} min={0.5} step={0.5} value={question.points} onChange={(e) => updateQuestion(qk, { points: Number(e.target.value) || 1 })} aria-label="Points" />
          </label>
        </div>
      </fieldset>
    </section>
  );
}
