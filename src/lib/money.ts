/**
 * Divide um valor em parcelas que somam exatamente o total.
 * Os centavos que sobram vão para as primeiras parcelas: R$ 100,00 em 3x = 33,34 + 33,33 + 33,33.
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new Error('Total inválido.');
  if (!Number.isInteger(count) || count < 1) throw new Error('Quantidade de parcelas inválida.');
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatBRL = (cents: number) => brl.format(cents / 100);

/** Percentual com 1 casa decimal (0.1234 -> 12.3). Retorna null quando a base é zero. */
export function percent(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}
