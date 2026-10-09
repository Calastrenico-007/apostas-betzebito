'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { coins, coinsZeb } from '@/lib/format';
import { useRealtime } from '@/lib/hooks/useRealtime';

interface Stats {
  users: number;
  openBets: number;
  pendingEvents: number;
  liveMatches: number;
  openEvents: number;
  staked: number;
  pendingWalletRequests: number;
}

export default function AdminHome() {
  const [s, setS] = useState<Stats | null>(null);
  const isInternalTest =
    process.env.NEXT_PUBLIC_PRIVATE_TEST_MODE === 'true' ||
    process.env.NEXT_PUBLIC_PRIVATE_TEST_MODE === '1';

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [u, ob, p, lm, oe, st, wr] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('bets').select('id', { count: 'exact', head: true }).eq('status', 'aberta'),
      sb.from('events').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      sb.from('events').select('id', { count: 'exact', head: true }).eq('kind', 'futebol').eq('status', 'ao_vivo'),
      sb.from('events').select('id', { count: 'exact', head: true }).eq('kind', 'especial').eq('status', 'ao_vivo'),
      sb.from('bets').select('stake').eq('status', 'aberta').limit(5000),
      sb.from('wallet_requests').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
    ]);

    setS({
      users: u.count || 0,
      openBets: ob.count || 0,
      pendingEvents: p.count || 0,
      liveMatches: lm.count || 0,
      openEvents: oe.count || 0,
      staked: ((st.data as { stake: number }[]) || []).reduce((a, b) => a + Number(b.stake), 0),
      pendingWalletRequests: wr.count || 0,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime(['events', 'bets', 'profiles', 'wallet_requests'], load);

  const cards = s
    ? [
        {
          label: 'Apostas em Aberto',
          value: s.openBets,
          detail: 'Aguardando apito final',
          href: '/admin/jogos',
          badge: 'Ativas',
        },
        {
          label: 'Moedas em Jogo',
          value: coinsZeb(s.staked),
          detail: 'Volume retido em apostas',
          href: '/admin/jogos',
        },
        {
          label: 'Pedidos de Carteira',
          value: s.pendingWalletRequests,
          detail: 'Depósitos e levantamentos',
          href: '/admin/utilizadores',
          hot: s.pendingWalletRequests > 0,
          badge: s.pendingWalletRequests > 0 ? 'Ação Necessária' : 'Zero',
        },
        {
          label: 'Jogos Ao Vivo',
          value: s.liveMatches,
          detail: 'Em andamento no momento',
          href: '/admin/jogos',
        },
        {
          label: 'Total de Apostadores',
          value: s.users,
          detail: 'Contas registadas no sistema',
          href: '/admin/utilizadores',
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand/25 bg-gradient-to-r from-brand/10 via-[#0c1624] to-[#08101a] p-4 text-xs text-slate-300 shadow-card">
        <div className="flex items-center gap-2 font-black uppercase tracking-wider text-brand-light text-sm mb-1">
          <span>⚙</span> Painel Operacional Betzebi
        </div>
        {isInternalTest && (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-200">
            MODO TESTE INTERNO · CRÉDITO MANUAL · NÃO PÚBLICO
          </div>
        )}
        <p className="leading-relaxed">
          As apostas encerram no início de cada partida. O administrador mantém os eventos e resultados e processa manualmente os pedidos de depósito e levantamento.
        </p>
      </div>

      {/* Grid de KPIs do Painel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`card group hover:border-white/[0.16] hover:bg-[#101b2a] transition-all ${
              c.hot ? '!border-amber-500/40 !bg-amber-500/5' : ''
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">{c.label}</span>
              {c.badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    c.hot
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-white/[0.04] text-slate-400'
                  }`}
                >
                  {c.badge}
                </span>
              )}
            </div>

            <div
              className={`mt-2 text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                c.hot ? 'text-amber-300' : 'text-white'
              }`}
            >
              {c.value}
            </div>

            <div className="mt-1 text-[11px] text-slate-400 group-hover:text-slate-300">
              {c.detail}
            </div>
          </Link>
        ))}
      </div>

      {/* Guia Rápido de Procedimentos do Operador */}
      <div className="card space-y-3.5">
        <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
          <span>📋</span> Manual Rápido de Operação no Stand
        </h2>

        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3 space-y-1">
            <strong className="text-brand-light block text-sm">1. Gerir Jogos & Odds</strong>
            <p className="text-slate-400">
              Cria as partidas em <Link href="/admin/jogos" className="text-white underline">Jogos</Link>. Ajusta as cotações desejadas. Quando a partida começar, passa para Ao Vivo e suspende mercados em golos.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3 space-y-1">
            <strong className="text-brand-light block text-sm">2. Confirmar e-Mola</strong>
            <p className="text-slate-400">
              Em <Link href="/admin/utilizadores" className="text-white underline">Utilizadores</Link>, confirma cada transferência na conta e-Mola antes de aprovar depósitos; paga levantamentos antes de concluir os pedidos.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3 space-y-1">
            <strong className="text-brand-light block text-sm">3. Liquidar e Pagar</strong>
            <p className="text-slate-400">
              Ao apito final da partida, insere o resultado final exato (e resultado ao intervalo). O sistema calcula e credita automaticamente os ganhadores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
