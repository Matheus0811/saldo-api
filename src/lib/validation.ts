import { z } from 'zod';

import { unprocessable } from './errors.js';

// Mensagens de validação em português (Zod 4). Mensagens definidas no próprio schema têm prioridade.
z.config({
  customError: (raw) => {
    const issue = raw as unknown as Record<string, any>;
    switch (issue.code) {
      case 'invalid_type':
        return issue.input === undefined ? 'Campo obrigatório.' : `Tipo inválido: esperado ${issue.expected}.`;
      case 'too_small':
        if (issue.origin === 'string') return `Use pelo menos ${issue.minimum} caractere(s).`;
        if (issue.origin === 'array') return `Informe pelo menos ${issue.minimum} item(ns).`;
        return `O valor deve ser no mínimo ${issue.minimum}.`;
      case 'too_big':
        if (issue.origin === 'string') return `Use no máximo ${issue.maximum} caracteres.`;
        return `O valor deve ser no máximo ${issue.maximum}.`;
      case 'invalid_format':
        return issue.format === 'email' ? 'E-mail inválido.' : 'Formato inválido.';
      case 'invalid_value':
        return `Valor inválido. Use um destes: ${(issue.values as unknown[]).join(', ')}.`;
      case 'unrecognized_keys':
        return `Campo(s) não permitido(s): ${(issue.keys as string[]).join(', ')}.`;
      default:
        return undefined;
    }
  },
});

/** Valida `data` com o schema; em caso de erro lança 422 com a lista de campos inválidos. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.map(String).join('.') || null,
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
