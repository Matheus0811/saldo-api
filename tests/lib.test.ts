import { describe, expect, it } from 'vitest';

import { addMonths, monthRange, monthsBetween, shiftMonth } from '../src/lib/dates.js';
import { percent, splitInstallments } from '../src/lib/money.js';
import { budgetStatus } from '../src/modules/budgets/budgets.service.js';
import { withProgress } from '../src/modules/goals/goals.service.js';

describe('splitInstallments', () => {
  it('divide sem perder centavos', () => {
    expect(splitInstallments(10_000, 3)).toEqual([3_334, 3_333, 3_333]);
    expect(splitInstallments(10_000, 3).reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it('valor exato fica igual em todas as parcelas', () => {
    expect(splitInstallments(1_200, 4)).toEqual([300, 300, 300, 300]);
  });
});

describe('datas', () => {
  it('soma meses respeitando o fim do mês', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('calcula intervalo e diferença de meses', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthsBetween('2026-11', '2027-02')).toBe(3);
  });
});

describe('regras de negócio', () => {
  it('classifica o orçamento', () => {
    expect(budgetStatus(5_000, 10_000)).toBe('ok');
    expect(budgetStatus(8_000, 10_000)).toBe('warning');
    expect(budgetStatus(10_001, 10_000)).toBe('exceeded');
  });

  it('calcula quanto guardar por mês para a meta', () => {
    const goal = withProgress(
      {
        id: 1,
        userId: 1,
        name: 'Viagem',
        targetCents: 120_000,
        savedCents: 30_000,
        deadline: '2027-05-10',
        color: '#000000',
        createdAt: new Date(),
      },
      '2026-11-14',
    );
    expect(goal.progress).toBe(25);
    expect(goal.monthsLeft).toBe(6);
    expect(goal.monthlyNeededCents).toBe(15_000);
  });

  it('percentual com uma casa decimal', () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(5, 0)).toBeNull();
  });
});
