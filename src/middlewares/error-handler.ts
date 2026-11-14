import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/errors.js';

const pgCode = (error: unknown): string | undefined => {
  const err = error as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
};

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Rota ${req.method} ${req.path} não existe.` } });
}

// Express identifica o tratador de erros pelos 4 parâmetros.
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
    return;
  }

  const err = error as { type?: string; status?: number };
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido.' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Requisição grande demais.' } });
    return;
  }

  const code = pgCode(error);
  if (code === '23505') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Já existe um registro com esses dados.' } });
    return;
  }
  if (code === '23503') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Registro relacionado não encontrado ou em uso.' } });
    return;
  }

  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente em instantes.' } });
}
