import type { LoaderFunctionArgs } from 'react-router-dom';
import { shareApi } from '@/modules/share/services/share.api';
import { HttpError } from '@/utils/api';
import type { PublicQuiz } from '@/types';

export interface ShareLoaderData {
  token: string;
  invite: string | null;
  quiz: PublicQuiz;
}

/**
 * Tokenized link resolution guard. The quiz is ALWAYS fetched from the public API
 * (`GET /api/share/:token`, no credentials required) — never from localStorage or
 * client state — so a copied link works in a fresh tab, another browser or incognito.
 *
 * Unknown token / restricted without invite / unpublished → 404 page.
 * Anything else (network down, 5xx) propagates as-is so the error page can offer a retry
 * instead of pretending the link is dead.
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
