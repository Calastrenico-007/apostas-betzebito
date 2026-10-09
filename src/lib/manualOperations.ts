export type ManualMarketKind = 'match' | 'prediction' | 'special';

export type ManualMarketStatus = 'pendente' | 'ativo' | 'fechado' | 'cancelado' | 'resolvido';

export interface ManualMarketTemplate {
  id: string;
  kind: ManualMarketKind;
  title: string;
  question: string;
  options: Array<{ id: string; label: string; odds: number }>;
  closesAt: string | null;
  status: ManualMarketStatus;
  notes?: string;
}

export const MANUAL_MARKET_KINDS: Array<{ value: ManualMarketKind; label: string }> = [
  { value: 'match', label: 'Jogo / jogo manual' },
  { value: 'prediction', label: 'Previsão / quantidade' },
  { value: 'special', label: 'Evento especial' },
];

export const MANUAL_MARKET_DEFAULTS: ManualMarketTemplate = {
  id: 'manual-market-template',
  kind: 'special',
  title: 'Evento manual',
  question: 'Qual será o resultado?',
  options: [
    { id: 'opt-1', label: 'Opção A', odds: 1.8 },
    { id: 'opt-2', label: 'Opção B', odds: 2.2 },
  ],
  closesAt: null,
  status: 'pendente',
  notes: 'Ajustar conforme o admin e deixar a API externa para depois.',
};

export function createManualMarketTemplate(overrides: Partial<ManualMarketTemplate> = {}): ManualMarketTemplate {
  return {
    ...MANUAL_MARKET_DEFAULTS,
    ...overrides,
    options: overrides.options ?? MANUAL_MARKET_DEFAULTS.options,
  };
}

export function validateManualResult(_result: string): boolean {
  return Boolean(_result && _result.trim().length > 0);
}

/**
 * TODO: integrar com API externa quando houver feed / dados de resultado.
 * Esta camada foi deixada pronta para permitir crescimento sem quebrar a operação manual.
 */
export const API_INTEGRATION_PLACEHOLDER = {
  status: 'not-configured',
  provider: 'manual-admin',
  notes: 'Adicionar API externa depois do MVP operacional local.',
};
