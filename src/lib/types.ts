export type EventKind = 'futebol' | 'especial';
export type EventStatus = 'pendente' | 'agendado' | 'ao_vivo' | 'fechado' | 'terminado' | 'cancelado' | 'rejeitado';
export type MarketStatus = 'aberto' | 'suspenso' | 'resolvido' | 'anulado';
export type PoolType = 'fixa' | 'mutua';
export type SelResult = 'pendente' | 'ganha' | 'perdida' | 'anulada';
export type BetStatus = 'aberta' | 'ganha' | 'perdida' | 'anulada' | 'cashout';

export type WalletRequestType = 'deposito' | 'levantamento';
export type WalletRequestStatus = 'pendente' | 'aprovado' | 'rejeitado' | 'cancelado';
export type AccountStatus = 'pendente' | 'aprovado' | 'rejeitado';

export interface Profile {
  id: string;
  email: string | null;
  username: string;
  balance: number;
  role: 'user' | 'admin';
  account_status: AccountStatus;
  created_at: string;
}

export interface Selection {
  id: string;
  market_id: string;
  key: string;
  label: string;
  odds: number | null;
  pool: number;
  result: SelResult;
  sort: number;
}

export interface Market {
  id: string;
  event_id: string;
  key: string;
  name: string;
  line: number | null;
  pool_type: PoolType;
  commission: number;
  status: MarketStatus;
  sort: number;
  selections: Selection[];
}

export interface SportEvent {
  id: string;
  kind: EventKind;
  title: string;
  description: string | null;
  category: string;
  league: string | null;
  home_team: string | null;
  away_team: string | null;
  starts_at: string | null;
  closes_at: string | null;
  status: EventStatus;
  home_score: number | null;
  away_score: number | null;
  ht_home_score: number | null;
  ht_away_score: number | null;
  minute: string | null;
  proposed_by: string | null;
  winning_selection_id: string | null;
  featured: boolean;
  created_at: string;
  markets: Market[];
}

export interface BetLeg {
  id: string;
  bet_id: string;
  selection_id: string;
  market_id: string;
  event_id: string;
  odds_at_placement: number | null;
  result: SelResult;
  selection: (Selection & { market: (Omit<Market, 'selections'> & { event: Omit<SportEvent, 'markets'> }) | null }) | null;
}

export interface Bet {
  id: string;
  user_id: string;
  type: 'simples' | 'multipla';
  stake: number;
  total_odds: number | null;
  potential_return: number | null;
  tax_percent: number;
  bonus_percent: number;
  tax_amount: number;
  status: BetStatus;
  payout: number;
  created_at: string;
  settled_at: string | null;
  bet_legs: BetLeg[];
}

export interface Transaction {
  id: string;
  amount: number;
  balance_after: number;
  type: string;
  description: string | null;
  created_at: string;
}

export interface WalletRequest {
  id: string;
  user_id: string;
  type: WalletRequestType;
  amount: number;
  payment_method: string;
  account_holder_name: string | null;
  reference: string | null;
  status: WalletRequestStatus;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  seen: boolean;
  created_at: string;
}

export interface LeaderRow {
  user_id: string;
  username: string;
  balance: number;
  profit: number;
  bets_count: number;
  won_count: number;
}
