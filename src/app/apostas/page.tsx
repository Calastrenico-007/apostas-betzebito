'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { getSupabase } from '@/lib/supabase/client';
import { coins, coinsZeb, dateTime, errMsg, odd } from '@/lib/format';
import { useRealtime } from '@/lib/hooks/useRealtime';
import type { Bet, BetStatus, SelResult } from '@/lib/types';

const BET_SELECT = '*, bet_legs(*, selection:selections(*, market:markets(*, event:events(*))))';

const STATUS_CONFIG: Record<BetStatus, { label: string; badge: string; border: string }> = {
  aberta: {
    label: 'Em Aberto',
    badge: 'border border-sky-500/30 bg-sky-500/10 text-sky-300',
    border: 'border-sky-500/20',
  },
  ganha: {
    label: '✓ Ganha',
    badge: 'border border-brand/30 bg-brand/15 text-brand-light font-black',
    border: 'border-brand/30',
  },
  perdida: {
    label: '✕ Perdida',
    badge: 'border border-red-500/30 bg-red-500/10 text-red-400',
    border: 'border-red-500/20',
  },
  anulada: {
    label: 'Anulada (Reembolso)',
    badge: 'border border-slate-500/30 bg-slate-500/10 text-slate-300',
    border: 'border-slate-500/20',
  },
  cashout: {
    label: 'Fechada',
    badge: 'border border-gold/30 bg-gold/10 text-gold',
    border: 'border-gold/20',
  },
};

const LEG_ICON: Record<SelResult, { icon: string; cls: string }> = {
  pendente: { icon: '⏳', cls: 'text-amber-400' },
  ganha: { icon: '✅', cls: 'text-brand-light' },
  perdida: { icon: '❌', cls: 'text-red-400' },
  anulada: { icon: '⚪', cls: 'text-slate-400' },
};

export default function MinhasApostasPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'abertas' | 'resolvidas' | 'todas'>('abertas');
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    let q = getSupabase()
      .from('bets')
      .select(BET_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (tab === 'abertas') {
      q = q.eq('status', 'aberta');
    } else if (tab === 'resolvidas') {
      q = q.neq('status', 'aberta');
    }

    const { data, error } = await q;
    if (error) toast(errMsg(error), 'erro');
    setBets((data as Bet[]) || []);
    setLoading(false);
  }, [user, tab, toast]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useRealtime(['bets', 'selections', 'markets', 'events'], load, Boolean(user));

  if (!authLoading && !user) {
    return (
      <div className="card text-center py-12 max-w-md mx-auto">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-2xl mx-auto mb-3">
          🎫
        </div>
        <h1 className="text-xl font-black text-white">Minhas Apostas</h1>
        <p className="mt-1 mb-5 text-sm text-slate-400">
          Inicia sessão para consultares o teu histórico de bilhetes e acompanhar os resultados.
        </p>
        <Link href="/login" className="btn-primary w-full">
          Iniciar Sessão
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-light">
            Registo de Bilhetes
          </p>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-black text-white">
            Minhas Apostas
          </h1>
        </div>

        {/* Abas */}
        <div className="flex gap-1.5 bg-black/30 p-1 rounded-xl border border-white/[0.06]">
          {(['abertas', 'resolvidas', 'todas'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === t
                  ? 'bg-brand text-brand-ink font-black shadow-glow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'abertas' ? 'Em Aberto' : t === 'resolvidas' ? 'Resolvidas' : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="card text-center py-10 text-slate-400 animate-pulse">
          A carregar bilhetes de aposta…
        </div>
      )}

      {!loading && bets.length === 0 && (
        <div className="card text-center py-12 space-y-3">
          <p className="text-sm text-slate-400">
            {tab === 'abertas'
              ? 'Não tens bilhetes de aposta em aberto no momento.'
              : 'Ainda não existem apostas registadas nesta secção.'}
          </p>
          <Link href="/" className="btn-primary text-xs">
            Explorar Jogos e Mercados ›
          </Link>
        </div>
      )}

      {/* Lista de Bilhetes de Aposta Estilo Sportsbook */}
      <div className="space-y-3.5">
        {bets.map((b) => {
          const st = STATUS_CONFIG[b.status] || STATUS_CONFIG.aberta;
          const isMulti = b.type === 'multipla';
          const mutual = b.bet_legs.some((l) => l.odds_at_placement == null);
          const taxPercent = Number(b.tax_percent) || 0;
          const taxAmount = Number(b.tax_amount) || 0;
          const bonusPercent = Number(b.bonus_percent) || 0;
          const grossPotential =
            b.total_odds == null ? null : Math.round(Number(b.stake) * Number(b.total_odds) * 100) / 100;
          const estimatedTax =
            grossPotential == null ? null : Math.round(grossPotential * taxPercent) / 100;

          return (
            <div
              key={b.id}
              className={`rounded-2xl border bg-[#0c1522] p-4 shadow-card transition-all ${st.border}`}
            >
              {/* Barra de Topo do Bilhete */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-xs uppercase tracking-wider">
                    {isMulti ? `Múltipla (${b.bet_legs.length} Seleções)` : 'Aposta Simples'}
                  </span>
                  <span className="text-slate-500 text-xs">·</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    #ZEB-{b.id.slice(0, 8)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">{dateTime(b.created_at)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${st.badge}`}>
                    {st.label}
                  </span>
                </div>
              </div>

              {/* Lista de Seleções do Bilhete */}
              <div className="space-y-2 mb-3">
                {b.bet_legs.map((l) => {
                  const ev = l.selection?.market?.event;
                  const legStatus = LEG_ICON[l.result] || LEG_ICON.pendente;

                  return (
                    <div
                      key={l.id}
                      className="rounded-xl border border-white/[0.05] bg-[#09111b] p-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-bold text-white">
                            <span>{legStatus.icon}</span>
                            <span className="truncate">{l.selection?.label}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {l.selection?.market?.name} · <strong className="text-slate-300">{ev?.title}</strong>
                            {ev?.kind === 'futebol' && ev.status !== 'agendado' && (
                              <span className="text-brand-light font-bold ml-1">
                                ({ev.home_score ?? 0} - {ev.away_score ?? 0})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 font-black tabular-nums text-brand-light text-xs">
                          {l.odds_at_placement == null ? 'Mútua' : odd(l.odds_at_placement)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resumo Financeiro do Bilhete */}
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-black/20 p-2.5 text-center text-xs border border-white/[0.05]">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Apostado</div>
                  <div className="font-black tabular-nums text-white mt-0.5">
                    {coinsZeb(b.stake)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Cotação</div>
                  <div className="font-black tabular-nums text-white mt-0.5">
                    {b.total_odds ? odd(b.total_odds) : 'Variável'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    {b.status === 'aberta'
                      ? 'Retorno líquido potencial'
                      : b.status === 'ganha' || b.status === 'cashout'
                      ? 'Pago líquido'
                      : 'Pago / reembolso'}
                  </div>
                  <div
                    className={`font-black tabular-nums mt-0.5 ${
                      b.payout > 0 || b.status === 'aberta' ? 'text-brand-light' : 'text-slate-400'
                    }`}
                  >
                    {b.status === 'aberta'
                      ? b.potential_return != null
                        ? coinsZeb(b.potential_return)
                        : mutual
                        ? 'Bolo Mútuo'
                        : '—'
                      : coinsZeb(b.payout)}
                  </div>
                </div>
              </div>

              {(bonusPercent > 0 ||
                (b.status === 'aberta' && taxPercent > 0) ||
                ((b.status === 'ganha' || b.status === 'cashout') && taxAmount > 0)) && (
                <div className="mt-2 space-y-1 text-right text-[10px] text-slate-400">
                  {bonusPercent > 0 && (
                    <p className="text-brand-light">Bónus da múltipla: +{bonusPercent}% nas odds totais</p>
                  )}
                  {b.status === 'aberta' && taxPercent > 0 && estimatedTax != null && (
                    <p>
                      Retenção estimada ({taxPercent}% sobre o retorno bruto): −{coinsZeb(estimatedTax)}
                    </p>
                  )}
                  {(b.status === 'ganha' || b.status === 'cashout') && taxAmount > 0 && (
                    <p>
                      Retenção aplicada ({taxPercent}% sobre o retorno bruto): −{coinsZeb(taxAmount)}
                    </p>
                  )}
                </div>
              )}

              {/* Nota Operacional */}
              <div className="mt-2 text-right text-[10px] text-slate-500">
                Liquidação auditada por operador admin · Odds travadas no registo
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
