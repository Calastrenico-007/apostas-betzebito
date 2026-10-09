'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { errMsg, selectionBettable } from '@/lib/format';
import { useRealtime } from '@/lib/hooks/useRealtime';
import { parseBetRules, type BetRules } from '@/lib/betRules';
import type { PoolType } from '@/lib/types';

export interface SlipItem {
  selectionId: string;
  marketId: string;
  eventId: string;
  eventTitle: string;
  marketName: string;
  label: string;
  odds: number | null;
  poolType: PoolType;
  available: boolean;
  changed: 'up' | 'down' | null;
}

export type SlipMode = 'simples' | 'multipla';

interface PlaceResult { ok: number; errors: string[] }

interface SlipCtx {
  items: SlipItem[];
  mode: SlipMode;
  setMode: (m: SlipMode) => void;
  stake: number;
  setStake: (n: number) => void;
  open: boolean;
  setOpen: (b: boolean) => void;
  has: (selectionId: string) => boolean;
  toggle: (item: Omit<SlipItem, 'available' | 'changed'>) => void;
  remove: (selectionId: string) => void;
  clear: () => void;
  acceptChanges: () => void;
  hasChanges: boolean;
  totalOdds: number;
  bonusApplied: boolean;
  betRules: BetRules | null;
  rulesLoading: boolean;
  rulesError: string | null;
  multipleError: string | null;
  place: () => Promise<PlaceResult>;
}

const Ctx = createContext<SlipCtx | null>(null);
const LS_KEY = 'feirabet-boletim-v1';

export function BetslipProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SlipItem[]>([]);
  const [mode, setMode] = useState<SlipMode>('simples');
  const [stake, setStake] = useState<number>(50);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [betRules, setBetRules] = useState<BetRules | null>(null);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const readBetRules = useCallback(async () => {
    setRulesLoading(true);
    if (!isSupabaseConfigured) {
      setRulesError('Configura a ligação ao Supabase para carregar as regras de aposta.');
      setRulesLoading(false);
      return null;
    }
    const { data, error } = await getSupabase().rpc('get_bet_rules');
    setRulesLoading(false);
    if (error) {
      setRulesError(errMsg(error));
      return null;
    }

    const parsed = parseBetRules(data);
    if (!parsed) {
      setRulesError('As regras de taxa e bónus recebidas são inválidas.');
      return null;
    }

    setRulesError(null);
    setBetRules(parsed);
    return parsed;
  }, []);

  useEffect(() => {
    void readBetRules();
  }, [readBetRules]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { items?: SlipItem[]; mode?: SlipMode; stake?: number };
        if (Array.isArray(p.items)) setItems(p.items);
        if (p.mode) setMode(p.mode);
        if (p.stake) setStake(p.stake);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_KEY, JSON.stringify({ items, mode, stake }));
  }, [items, mode, stake, hydrated]);

  // muda automaticamente para múltipla quando há 2+ seleções (o utilizador pode voltar a simples)
  const count = items.length;
  useEffect(() => {
    if (count >= 2) setMode((m) => (m === 'simples' && count === 2 ? 'multipla' : m));
    if (count <= 1) setMode('simples');
  }, [count]);

  const idsKey = items.map((i) => i.selectionId).join(',');

  // sincroniza odds/estado das seleções do boletim com a base de dados
  const sync = useCallback(async () => {
    if (!idsKey || !isSupabaseConfigured) return;
    const { data } = await getSupabase()
      .from('selections')
      .select('id, odds, result, market:markets(status, pool_type, event:events(status, closes_at))')
      .in('id', idsKey.split(','));
    if (!data) return;
    type Row = { id: string; odds: number | null; result: 'pendente'; market: { status: 'aberto'; pool_type: PoolType; event: { status: 'agendado'; starts_at: string | null; closes_at: string | null } } | null };
    const map = new Map((data as unknown as Row[]).map((r) => [r.id, r]));
    setItems((prev) =>
      prev.map((it) => {
        const r = map.get(it.selectionId);
        if (!r || !r.market || !r.market.event) return { ...it, available: false };
        const newOdds = r.odds == null ? null : Number(r.odds);
        const available = selectionBettable(r.market.event, r.market, r);
        let changed = it.changed;
        if (it.poolType === 'fixa' && newOdds != null && it.odds != null && newOdds !== it.odds) {
          changed = newOdds > it.odds ? 'up' : 'down';
        }
        return { ...it, odds: newOdds, available, changed };
      }),
    );
  }, [idsKey]);

  useEffect(() => {
    sync();
  }, [sync]);
  useRealtime(['selections', 'markets', 'events'], sync, Boolean(idsKey));

  const has = useCallback((id: string) => items.some((i) => i.selectionId === id), [items]);

  const toggle = useCallback((item: Omit<SlipItem, 'available' | 'changed'>) => {
    setItems((prev) => {
      if (prev.some((i) => i.selectionId === item.selectionId)) return prev.filter((i) => i.selectionId !== item.selectionId);
      const withoutSameMarket = prev.filter((i) => i.marketId !== item.marketId);
      if (withoutSameMarket.length >= 15) return prev;
      return [...withoutSameMarket, { ...item, available: true, changed: null }];
    });
  }, []);

  const remove = useCallback((id: string) => setItems((p) => p.filter((i) => i.selectionId !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const acceptChanges = useCallback(() => setItems((p) => p.map((i) => ({ ...i, changed: null }))), []);
  const hasChanges = items.some((i) => i.changed);

  const baseTotalOdds = useMemo(() => items.reduce((a, i) => a * (i.odds ? Number(i.odds) : 1), 1), [items]);
  const bonusApplied = Boolean(
    mode === 'multipla' &&
    betRules &&
    items.length >= betRules.multiple_bonus_min_selections &&
    !items.some((item) => item.poolType === 'mutua'),
  );
  const totalOdds = baseTotalOdds * (1 + (bonusApplied ? (betRules?.multiple_bonus_percent ?? 0) : 0) / 100);

  const multipleError = useMemo(() => {
    if (items.length < 2) return 'Adiciona pelo menos 2 seleções para uma múltipla';
    if (items.some((i) => i.poolType === 'mutua')) return 'Apostas mútuas só podem ser feitas como simples';
    const ev = new Set(items.map((i) => i.eventId));
    if (ev.size !== items.length) return 'Não podes combinar duas seleções do mesmo evento numa múltipla';
    return null;
  }, [items]);

  const place = useCallback(async (): Promise<PlaceResult> => {
    const sb = getSupabase();
    const errors: string[] = [];
    let ok = 0;
    const amount = Math.round(Number(stake) * 100) / 100;
    if (!amount || amount < 1) return { ok: 0, errors: ['Valor mínimo: 1 moeda'] };

    const latestRules = await readBetRules();
    if (!latestRules) {
      return { ok: 0, errors: ['Não foi possível validar as regras de taxa e bónus. Tenta novamente.'] };
    }
    if (
      !betRules ||
      latestRules.tax_percent !== betRules.tax_percent ||
      latestRules.multiple_bonus_min_selections !== betRules.multiple_bonus_min_selections ||
      latestRules.multiple_bonus_percent !== betRules.multiple_bonus_percent
    ) {
      return { ok: 0, errors: ['As regras foram atualizadas. Revê o retorno e submete a aposta novamente.'] };
    }

    if (mode === 'multipla') {
      if (multipleError) return { ok: 0, errors: [multipleError] };
      const { error } = await sb.rpc('place_bet', {
        selections: items.map((i) => i.selectionId),
        stake: amount,
        expected_odds: items.map((i) => i.odds),
        expected_tax_percent: betRules.tax_percent,
        expected_bonus_min_selections: betRules.multiple_bonus_min_selections,
        expected_bonus_percent: betRules.multiple_bonus_percent,
      });
      if (error) errors.push(errMsg(error));
      else {
        ok = 1;
        setItems([]);
      }
    } else {
      const placed: string[] = [];
      for (const it of items) {
        const { error } = await sb.rpc('place_bet', {
          selections: [it.selectionId],
          stake: amount,
          expected_odds: it.poolType === 'fixa' ? [it.odds] : null,
          expected_tax_percent: betRules.tax_percent,
          expected_bonus_min_selections: betRules.multiple_bonus_min_selections,
          expected_bonus_percent: betRules.multiple_bonus_percent,
        });
        if (error) errors.push(`${it.label}: ${errMsg(error)}`);
        else {
          ok++;
          placed.push(it.selectionId);
        }
      }
      setItems((p) => p.filter((i) => !placed.includes(i.selectionId)));
    }
    if (errors.length) sync();
    return { ok, errors };
  }, [items, mode, stake, multipleError, sync, betRules, readBetRules]);

  const value: SlipCtx = {
    items, mode, setMode, stake, setStake, open, setOpen, has, toggle, remove, clear,
    acceptChanges, hasChanges, totalOdds, bonusApplied, betRules, rulesLoading, rulesError, multipleError, place,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBetslip() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useBetslip fora do BetslipProvider');
  return c;
}
