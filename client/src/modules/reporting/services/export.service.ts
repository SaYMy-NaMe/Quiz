import { apiFetch, toHttpError } from '@/utils/api';

/**
 * Downloads the streamed workbook. We use apiFetch (not a bare <a href>) so the session
 * cookie is sent cross-origin and errors surface as JSON instead of a broken file.
 */
export async function downloadSubmissionsXlsx(quizId: string, fallbackName = 'submissions.xlsx'): Promise<void> {
  const res = await apiFetch(`/quizzes/${quizId}/export/xlsx`);
  if (!res.ok) throw await toHttpError(res);
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
