import type { CategoryType } from '../../db/schema.js';

export const DEFAULT_CATEGORIES: { name: string; type: CategoryType; color: string; icon: string }[] = [
  { name: 'Salário', type: 'income', color: '#16A34A', icon: 'briefcase' },
  { name: 'Freelance', type: 'income', color: '#0EA5E9', icon: 'laptop' },
  { name: 'Rendimentos', type: 'income', color: '#14B8A6', icon: 'trending-up' },
  { name: 'Outras receitas', type: 'income', color: '#84CC16', icon: 'plus-circle' },
  { name: 'Moradia', type: 'expense', color: '#7C3AED', icon: 'home' },
  { name: 'Mercado', type: 'expense', color: '#F97316', icon: 'shopping-cart' },
  { name: 'Restaurantes', type: 'expense', color: '#EF4444', icon: 'utensils' },
  { name: 'Transporte', type: 'expense', color: '#3B82F6', icon: 'car' },
  { name: 'Contas de casa', type: 'expense', color: '#EAB308', icon: 'zap' },
  { name: 'Saúde', type: 'expense', color: '#EC4899', icon: 'heart-pulse' },
  { name: 'Educação', type: 'expense', color: '#6366F1', icon: 'graduation-cap' },
  { name: 'Lazer', type: 'expense', color: '#F43F5E', icon: 'party-popper' },
  { name: 'Assinaturas', type: 'expense', color: '#8B5CF6', icon: 'repeat' },
  { name: 'Compras', type: 'expense', color: '#D946EF', icon: 'shopping-bag' },
  { name: 'Outras despesas', type: 'expense', color: '#64748B', icon: 'tag' },
];
