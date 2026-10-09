import type { EventStatus, EventKind, Market, SportEvent, Selection } from './types';

const TZ = 'Africa/Maputo';
const coinFmt = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formata valor numérico da carteira operacional */
export const coins = (n: number | string | null | undefined) => coinFmt.format(Number(n ?? 0));
export const coinsZeb = (n: number | string | null | undefined) => `${coins(n)} MT`;

/** Formata cotação decimal (ex: 1.85) */
export const odd = (n: number | string | null | undefined) => (n == null ? '—' : Number(n).toFixed(2));

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function timeOnly(iso: string | null | undefined) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function dayLabel(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const fmt = (x: Date) =>
    new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  if (fmt(d) === fmt(today)) return 'Hoje ' + timeOnly(iso);
  if (fmt(d) === fmt(tomorrow)) return 'Amanhã ' + timeOnly(iso);
  return dateTime(iso);
}

/** "fecha em 2h 05m" */
export function countdown(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'fechado';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(mm).padStart(2, '0')}m`;
  const s = Math.floor((ms % 60000) / 1000);
  return `${mm}m ${String(s).padStart(2, '0')}s`;
}

/** datetime-local (hora local do browser) -> ISO */
export function localInputToIso(v: string) {
  return v ? new Date(v).toISOString() : null;
}

/** ISO -> valor para <input type="datetime-local"> */
export function isoToLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function statusLabel(kind: EventKind, s: EventStatus) {
  if (kind === 'especial') {
    return (
      {
        pendente: 'Pendente',
        agendado: 'Aberto',
        ao_vivo: 'Ao vivo',
        fechado: 'Fechado',
        terminado: 'Resolvido',
        cancelado: 'Anulado',
        rejeitado: 'Rejeitado',
      } as const
    )[s] || s;
  }
  return (
    {
      pendente: 'Pendente',
      agendado: 'Agendado',
      ao_vivo: 'Ao vivo',
      fechado: 'Fechado',
      terminado: 'Terminado',
      cancelado: 'Cancelado',
      rejeitado: 'Rejeitado',
    } as const
  )[s] || s;
}

/**
 * Regra de negócio estrita:
 * As apostas fecham automaticamente quando o jogo começa (starts_at <= now)
 * ou quando atinge closes_at, ou se o status for fechado/terminado/cancelado.
 */
export function eventIsOpen(
  e: Pick<SportEvent, 'status' | 'closes_at' | 'starts_at'>,
  now = Date.now(),
) {
  const isAllowedStatus = e.status === 'agendado' || e.status === 'ao_vivo';
  const started = e.starts_at ? new Date(e.starts_at).getTime() <= now : false;
  const closed = e.closes_at ? new Date(e.closes_at).getTime() <= now : false;
  return isAllowedStatus && !started && !closed;
}

export function getEventBettingState(
  e: Pick<SportEvent, 'status' | 'closes_at' | 'starts_at'>,
  now = Date.now(),
) {
  const started = e.starts_at ? new Date(e.starts_at).getTime() <= now : false;
  const closed = e.closes_at ? new Date(e.closes_at).getTime() <= now : false;

  if (e.status === 'terminado') {
    return { isOpen: false, label: 'Terminado', tag: 'badge-settled' };
  }
  if (e.status === 'cancelado') {
    return { isOpen: false, label: 'Anulado', tag: 'badge-void' };
  }
  if (e.status === 'fechado') {
    return { isOpen: false, label: 'Apostas Fechadas', tag: 'badge-closed' };
  }
  if (started) {
    return { isOpen: false, label: 'Fechado ao início', tag: 'badge-closed' };
  }
  if (closed) {
    return { isOpen: false, label: 'Fechado', tag: 'badge-closed' };
  }
  if (e.status === 'ao_vivo') {
    return { isOpen: true, label: 'Ao Vivo', tag: 'badge-live' };
  }
  return { isOpen: true, label: 'Aberto', tag: 'badge-scheduled' };
}

export function selectionBettable(
  e: Pick<SportEvent, 'status' | 'closes_at' | 'starts_at'>,
  m: Pick<Market, 'status' | 'pool_type'>,
  s: Pick<Selection, 'odds' | 'result'>,
  now = Date.now(),
) {
  return (
    eventIsOpen(e, now) &&
    m.status === 'aberto' &&
    s.result === 'pendente' &&
    (m.pool_type === 'mutua' || (s.odds != null && Number(s.odds) >= 1.01))
  );
}

/** Pagamento estimado por moeda numa aposta mútua */
export function mutualMultiplier(m: Market, s: Selection, extraStake = 0) {
  const total = m.selections.reduce((a, x) => a + Number(x.pool || 0), 0) + extraStake;
  const mine = Number(s.pool || 0) + extraStake;
  if (mine <= 0) return null;
  return Math.max(1, (total * (1 - Number(m.commission || 0))) / mine);
}

export function normalizeEvent(e: SportEvent): SportEvent {
  const markets = [...(e.markets || [])]
    .sort((a, b) => a.sort - b.sort)
    .map((m) => ({ ...m, selections: [...(m.selections || [])].sort((a, b) => a.sort - b.sort) }));
  return { ...e, markets };
}

export const EVENT_SELECT = '*, markets(*, selections(*))';

export function errMsg(e: unknown) {
  if (!e) return 'Erro desconhecido';
  if (typeof e === 'string') return e;
  const m = (e as { message?: string }).message || 'Erro desconhecido';
  if (m.includes('Invalid login credentials')) return 'Email ou palavra-passe incorretos';
  if (m.includes('User already registered')) return 'Este email já se encontra registado';
  if (m.includes('Password should be')) return 'A palavra-passe deve conter pelo menos 6 caracteres';
  if (m.includes('Email not confirmed')) return 'Email pendente de confirmação';
  if (m.includes('Failed to fetch')) return 'Sem ligação ao servidor. Verifica a tua ligação à rede.';
  if (m.includes('Saldo insuficiente')) return 'Saldo insuficiente na carteira para esta aposta.';
  if (m.includes('já fecharam porque o jogo começou')) return 'As apostas para esta partida fecharam com o início do jogo.';
  return m;
}

export const CATEGORIES = ['Destaques', 'Moçambola', 'Premier League', 'La Liga', 'Champions League', 'Previsões Stand'];
