import { useEffect, useState, type FormEvent } from 'react';
import type { Quiz } from '@/modules/quiz/types';
import { shareApi, type Invite } from '../services/share.api';
import { buildShareUrl } from '../services/link-builder';
import { CopyLinkButton } from './CopyLinkButton';
import { HttpError } from '@/services/http';

interface Props {
  quiz: Quiz;
}

/** One-click share link generator + invite matrix for restricted quizzes. */
export function ShareLinkPanel({ quiz }: Props) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [emails, setEmails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const restricted = quiz.accessMode === 'restricted';

  useEffect(() => {
    if (!restricted) return;
    void shareApi.listInvites(quiz.id).then((r) => setInvites(r.invites)).catch(() => undefined);
  }, [quiz.id, restricted]);

  if (!quiz.shareToken) {
    return (
      <div className="alert alert--info">Publish the quiz to generate its private share link.</div>
    );
  }

  const link = buildShareUrl(quiz.shareToken);

  const addInvites = async (e: FormEvent) => {
    e.preventDefault();
    const list = emails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    setBusy(true);
    setError(null);
    try {
      const { invites: added } = await shareApi.addInvites(quiz.id, list);
      setInvites((prev) => {
        const map = new Map(prev.map((i) => [i.id, i]));
        added.forEach((i) => map.set(i.id, i));
        return [...map.values()];
      });
      setEmails('');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not add invites');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (inv: Invite) => {
    await shareApi.removeInvite(quiz.id, inv.id).catch(() => undefined);
    setInvites((prev) => prev.filter((i) => i.id !== inv.id));
  };

  return (
    <div className="stack">
      <div>
        <div className="row row--between">
          <h3>Share link</h3>
          <span className={`badge badge--${quiz.accessMode}`}>{restricted ? 'Restricted' : 'Anyone with the link'}</span>
        </div>
        {quiz.status !== 'published' && (
          <div className="alert alert--warning">The quiz is {quiz.status}; the link will return 404 until it is published.</div>
        )}
        <div className="link-box">
          <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
          <CopyLinkButton text={link} />
        </div>
        <p className="small muted" style={{ marginTop: '0.5rem' }}>
          {restricted
            ? 'Restricted quizzes only open with a personal invite link below. The bare link returns 404.'
            : 'Anyone holding this link can take the quiz. It is never listed anywhere.'}
        </p>
      </div>

      {restricted && (
        <div>
          <h3>Invited examinees</h3>
          <form onSubmit={(e) => void addInvites(e)} className="stack">
            <div className="field">
              <label className="field__label" htmlFor="invite-emails">Emails (comma, space or newline separated)</label>
              <textarea id="invite-emails" className="textarea" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="alice@school.edu, bob@school.edu" />
            </div>
            {error && <div className="alert alert--error" role="alert">{error}</div>}
            <div className="row row--end">
              <button className="btn btn--primary" type="submit" disabled={busy}>Generate invite links</button>
            </div>
          </form>
          {invites.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '1rem' }}>
              <table className="table">
                <thead>
                  <tr><th>Email</th><th>Personal link</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {invites.map((inv) => {
                    const personal = buildShareUrl(quiz.shareToken!, inv.token);
                    return (
                      <tr key={inv.id}>
                        <td>{inv.email}</td>
                        <td className="mono small" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{personal}</td>
                        <td>
                          <div className="row">
                            <CopyLinkButton text={personal} label="Copy" size="btn--sm" />
                            <button type="button" className="btn btn--sm btn--ghost" onClick={() => void remove(inv)}>Revoke</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
