import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { env } from '../config/env.js';
import { unauthorized } from '../lib/errors.js';

/** Exige um token de acesso válido no cabeçalho `Authorization: Bearer <token>`. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let userId: number;
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload;
    userId = Number(payload.sub);
  } catch {
    throw unauthorized('Sessão expirada ou inválida. Faça login novamente.');
  }
  if (!Number.isInteger(userId) || userId <= 0) throw unauthorized();

  res.locals.userId = userId;
  next();
}

/** ID do usuário autenticado (definido por requireAuth). */
export function currentUserId(res: Response): number {
  return res.locals.userId as number;
}
