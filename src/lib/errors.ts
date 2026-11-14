/** Erro de negócio com status HTTP e código estável para o front-end tratar. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string) => new AppError(400, 'BAD_REQUEST', message);
export const unauthorized = (message = 'Faça login para continuar.') => new AppError(401, 'UNAUTHORIZED', message);
export const notFound = (message: string) => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, 'VALIDATION_ERROR', message, details);
