'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

let client: SupabaseClient | null = null;

/** Cliente Supabase do browser (singleton). Chamar apenas em efeitos/handlers. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://configurar.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'chave-em-falta',
    );
  }
  return client;
}
