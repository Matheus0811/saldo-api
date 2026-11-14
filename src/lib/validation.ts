import { z, type ZodTypeAny } from 'zod';

import { unprocessable } from './errors.js';

// Mensagens de validação em português.
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return {
        message: issue.received === 'undefined' ? 'Campo obrigatório.' : `Tipo inválido: esperado ${issue.expected}.`,
      };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: `Use pelo menos ${issue.minimum} caractere(s).` };
      if (issue.type === 'array') return { message: `Informe pelo menos ${issue.minimum} item(ns).` };
      return { message: `O valor deve ser no mínimo ${issue.minimum}.` };
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Use no máximo ${issue.maximum} caracteres.` };
      return { message: `O valor deve ser no máximo ${issue.maximum}.` };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'E-mail inválido.' };
      return { message: 'Formato inválido.' };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `Valor inválido. Use um destes: ${issue.options.join(', ')}.` };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `Campo(s) não permitido(s): ${issue.keys.join(', ')}.` };
    default:
      return { message: ctx.defaultError };
  }
});

/** Valida `data` com o schema; em caso de erro lança 422 com a lista de campos inválidos. */
export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || null,
      message: issue.message,
    }));
    throw unprocessable('Dados inválidos. Confira os campos destacados.', details);
  }
  return result.data;
}

// ---------- Schemas reutilizáveis ----------
const isRealDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine(isRealDate, 'Data inexistente.');

export const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM.');

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB.');

/** Valor em centavos: inteiro positivo de até R$ 10 milhões. */
export const cents = z.number().int('Use centavos inteiros (ex.: 1250 = R$ 12,50).').positive().max(1_000_000_000);

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');
