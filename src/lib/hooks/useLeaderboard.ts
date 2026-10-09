'use client';
import { useCallback, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { LeaderRow } from '@/lib/types';
import { useRealtime } from './useRealtime';

/** Ranking via RPC get_leaderboard; atualiza com Realtime (feed de ganhos/apostas) e a cada pollMs. */
export function useLeaderboard(order: 'balance' | 'profit', limit = 50, pollMs = 20000) {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return setLoading(false);
    const { data } = await getSupabase().rpc('get_leaderboard', { p_order: order, p_limit: limit });
    setRows(((data as LeaderRow[]) || []).map((r) => ({ ...r, balance: Number(r.balance), profit: Number(r.profit) })));
    setLoading(false);
  }, [order, limit]);
  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);
  useRealtime(['activity'], load);
  return { rows, loading, reload: load };
}
