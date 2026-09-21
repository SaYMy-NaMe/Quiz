import type { LoaderFunctionArgs } from 'react-router-dom';
import { examineeApi } from '@/modules/examinee/services/attempt.api';
import { HttpError } from '@/utils/api';
import type { PublicQuiz } from '@/types';

export interface ShareLoaderData {
  token: string;
  quiz: PublicQuiz;
}

/**
 * Tokenized link resolution guard. The quiz is ALWAYS fetched from the public API
 * (`GET /api/quizzes/v/:token`, no credentials) so a copied link works in any browser.
 * Unknown/unpublished tokens → 404 page; other failures propagate so the error page can retry.
 */
export async function shareLoader({ params, request }: LoaderFunctionArgs): Promise<ShareLoaderData> {
  const token = params.token ?? '';
  try {
    const { quiz } = await examineeApi.resolve(token, request.signal);
    return { token, quiz };
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 403)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- react-router routes Response throws to errorElement
      throw new Response('Not Found', { status: 404 });
    }
    throw err;
  }
}
