import type { LoaderFunctionArgs } from 'react-router-dom';
import { shareApi } from '@/modules/share/services/share.api';
import { HttpError } from '@/services/http';
import type { PublicQuiz } from '@/modules/quiz/types';

export interface ShareLoaderData {
  token: string;
  invite: string | null;
  quiz: PublicQuiz;
}

/**
 * Tokenized link resolution guard: any failure (unknown token, restricted
 * without a valid invite, unpublished quiz) surfaces as the same 404 page.
 */
export async function shareLoader({ params, request }: LoaderFunctionArgs): Promise<ShareLoaderData> {
  const token = params.token ?? '';
  const invite = new URL(request.url).searchParams.get('invite');
  try {
    const { quiz } = await shareApi.resolve(token, invite, request.signal);
    return { token, invite, quiz };
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 403)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- react-router routes Response throws to errorElement
      throw new Response('Not Found', { status: 404 });
    }
    throw err;
  }
}
