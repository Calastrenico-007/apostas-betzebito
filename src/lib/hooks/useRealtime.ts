'use client';
import { useEffect, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

/** Chama onChange (com debounce) sempre que alguma das tabelas mudar via Supabase Realtime. */
export function useRealtime(tables: string[], onChange: () => void, enabled = true, filter?: string) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = tables.join(',');
  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) return;
    const sb = getSupabase();
    let t: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => cb.current(), 250);
    };
    const ch = sb.channel(`rt-${key}-${Math.random().toString(36).slice(2, 9)}`);
    key.split(',').forEach((table) => {
      ch.on('postgres_changes', filter ? { event: '*', schema: 'public', table, filter } : { event: '*', schema: 'public', table }, fire);
    });
    ch.subscribe();
    return () => {
      if (t) clearTimeout(t);
      sb.removeChannel(ch);
    };
  }, [key, enabled, filter]);
}

/** Relógio que atualiza a cada intervalMs (para contagens decrescentes). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
