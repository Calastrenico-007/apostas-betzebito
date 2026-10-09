'use client';
import { useCallback, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { EVENT_SELECT, normalizeEvent } from '@/lib/format';
import type { EventKind, EventStatus, SportEvent } from '@/lib/types';
import { useRealtime } from './useRealtime';

interface Opts {
  kind?: EventKind;
  statuses?: EventStatus[];
  id?: string;
  limit?: number;
}

/** Lista de eventos com mercados e seleções, sempre atualizada por Realtime. */
export function useEvents(opts: Opts) {
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusesKey = (opts.statuses || []).join(',');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let q = getSupabase().from('events').select(EVENT_SELECT);
    if (opts.kind) q = q.eq('kind', opts.kind);
    if (opts.id) q = q.eq('id', opts.id);
    if (statusesKey) q = q.in('status', statusesKey.split(','));
    q = q.order('starts_at', { ascending: true, nullsFirst: false }).order('closes_at', { ascending: true, nullsFirst: false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) setError(error.message);
    else {
      setError(null);
      setEvents(((data || []) as SportEvent[]).map(normalizeEvent));
    }
    setLoading(false);
  }, [opts.kind, opts.id, opts.limit, statusesKey]);

  useEffect(() => {
    load();
  }, [load]);
  useRealtime(['events', 'markets', 'selections'], load);

  return { events, loading, error, reload: load };
}
