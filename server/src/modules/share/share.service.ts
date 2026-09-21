import type { RequestHandler } from 'express';
import type { PublicQuiz } from '@shared';
import { QuizModel, type QuizDoc } from '@/modules/quiz/quiz.model';
import { acceptsAttempts } from '@/modules/quiz/quiz.state';
import { TOKEN_PATTERN } from './token';
import { notFound } from '@/utils/errors';

declare global {
  namespace Express {
    interface Request {
      quizDoc?: QuizDoc;
    }
  }
}

/**
 * Resolves a share token to a published quiz. Unknown, malformed, unpublished and closed
 * tokens all produce the same 404 so the response never reveals whether a token exists.
 */
export async function resolveToken(token: string): Promise<QuizDoc> {
  const doc = TOKEN_PATTERN.test(token) ? await QuizModel.findOne({ shareToken: token }) : null;
  if (!doc || !acceptsAttempts(doc.status)) throw notFound();
  return doc;
}

/** Route middleware: `/:token` → `req.quizDoc`. */
export const resolveShare: RequestHandler = (req, _res, next) => {
  resolveToken(req.params.token ?? '')
    .then((doc) => {
      req.quizDoc = doc;
      next();
    })
    .catch(next);
};

export function toPublicQuiz(doc: QuizDoc): PublicQuiz {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    durationSeconds: doc.settings.durationSeconds,
    examineeFields: doc.examineeFields.map((f) => ({
      fieldId: f.fieldId,
      label: f.label,
      type: f.type,
      required: f.required,
      ...(f.options ? { options: [...f.options] } : {}),
      ...(f.placeholder ? { placeholder: f.placeholder } : {}),
    })),
    questionCount: doc.questions.length,
  };
}
