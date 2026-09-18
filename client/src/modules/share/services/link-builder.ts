/** Builds absolute examinee links; the token is the only way into a quiz. */
export function buildShareUrl(token: string, inviteToken?: string): string {
  const url = new URL(`/quiz/v/${token}`, window.location.origin);
  if (inviteToken) url.searchParams.set('invite', inviteToken);
  return url.toString();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts / older browsers.
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
}
