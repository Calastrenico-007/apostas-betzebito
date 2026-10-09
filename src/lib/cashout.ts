import type { Bet } from './types';

/**
 * Cash-out foi desativado neste modo operacional manual.
 * Mantém-se este stub para permitir futuras integrações com API ou regras de mercado.
 */
export function cashoutQuote(_b: Bet): number | null {
  return null;
}
