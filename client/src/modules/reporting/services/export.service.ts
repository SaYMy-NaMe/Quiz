import { config } from '@/config';
import { HttpError } from '@/services/http';

/**
 * Downloads the streamed workbook. We use fetch (not a bare <a href>) so the
 * session cookie is sent and errors surface as JSON instead of a broken file.
 */
export async function downloadSubmissionsXlsx(quizId: string, fallbackName = 'submissions.xlsx'): Promise<void> {
  const res = await fetch(`${config.apiBaseUrl}/quizzes/${quizId}/export/xlsx`, { credentials: 'include' });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new HttpError(res.status, 'EXPORT_FAILED', message);
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
