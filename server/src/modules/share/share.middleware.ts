import type { RequestHandler } from 'express';
import type { ShareService, ResolvedShare } from './share.service';

declare global {
  namespace Express {
    interface Request {
      share?: ResolvedShare;
    }
  }
}

/**
 * Access middleware for tokenized routes: resolves `:token` (+ optional
 * `?invite=` / body.inviteToken) and attaches the quiz to `req.share`.
 */
export function resolveShare(share: ShareService): RequestHandler {
  return (req, _res, next) => {
    const token = req.params.token ?? '';
    const query = req.query.invite;
    const body = (req.body as { inviteToken?: unknown } | undefined)?.inviteToken;
    const invite = typeof query === 'string' ? query : typeof body === 'string' ? body : undefined;
    share
      .resolve(token, invite)
      .then((resolved) => {
        req.share = resolved;
        next();
      })
      .catch(next);
  };
}
