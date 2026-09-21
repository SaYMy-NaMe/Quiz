/** Application error carrying an HTTP status so the error middleware can map it. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'APP_ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Not found') => new AppError(404, message, 'NOT_FOUND');
export const forbidden = (message = 'Forbidden') => new AppError(403, message, 'FORBIDDEN');
export const unauthorized = (message = 'Unauthorized') => new AppError(401, message, 'UNAUTHORIZED');
export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, 'BAD_REQUEST', details);
export const conflict = (message: string) => new AppError(409, message, 'CONFLICT');
