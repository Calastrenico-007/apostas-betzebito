'use client';
import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { coins, coinsZeb } from '@/lib/format';
import { useLeaderboard } from '@/lib/hooks/useLeaderboard';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RankingPage() {
  const { user } = useAuth();
  const [order, setOrder] = useState<'balance' | 'profit'>('balance');
  const { rows, loading } = useLeaderboard(order, 100);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-light">
            Tabela de Classificação
          </p>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-black text-white">
            Classificação Geral
          </h1>
        </div>

        {/* Abas de Ordenação */}
        <div className="flex gap-1.5 bg-black/30 p-1 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => setOrder('balance')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              order === 'balance'
                ? 'bg-brand text-brand-ink font-black shadow-glow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🪙 Maior Saldo
          </button>
          <button
            onClick={() => setOrder('profit')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              order === 'profit'
                ? 'bg-brand text-brand-ink font-black shadow-glow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📈 Maior Lucro
          </button>
        </div>
      </div>

      {loading && (
        <div className="card text-center py-12 text-slate-400 animate-pulse">
          A carregar classificação dos apostadores…
        </div>
      )}

      {/* Pódio dos Top 3 (se houver dados) */}
      {!loading && top3.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {top3.map((r, i) => (
            <div
              key={r.user_id}
              className={`relative overflow-hidden rounded-2xl border p-4 text-center shadow-card transition-all ${
                i === 0
                  ? 'border-gold/40 bg-gradient-to-b from-[#182512] via-[#0f1b26] to-[#0a121c]'
                  : i === 1
                  ? 'border-slate-300/30 bg-gradient-to-b from-[#16212e] to-[#0a121c]'
                  : 'border-amber-700/30 bg-gradient-to-b from-[#1d1916] to-[#0a121c]'
              } ${r.user_id === user?.id ? 'ring-2 ring-brand' : ''}`}
            >
              <div className="text-3xl mb-1">{MEDALS[i]}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {i + 1}º Lugar
              </div>
              <div className="text-base font-black text-white mt-1 truncate">
                {r.username} {r.user_id === user?.id && <span className="text-brand-light text-xs">(Tu)</span>}
              </div>
              <div className="text-xl font-black tabular-nums text-white mt-2">
                {order === 'balance' ? coinsZeb(r.balance) : `${r.profit >= 0 ? '+' : ''}${coinsZeb(r.profit)}`}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {r.bets_count} apostas · {r.won_count} ganhas
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabela do Ranking Completo */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c1522] overflow-hidden shadow-card">
        <div className="p-3.5 border-b border-white/[0.06] flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span>Posição & Apostador</span>
          <span>{order === 'balance' ? 'Saldo Atual' : 'Lucro Líquido'}</span>
        </div>

        <div className="divide-y divide-white/[0.05]">
          {rows.map((r, i) => {
            const isMe = r.user_id === user?.id;

            return (
              <div
                key={r.user_id}
                className={`flex items-center justify-between p-3 text-xs transition-colors ${
                  isMe ? 'bg-brand/10' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-black ${
                      i < 3
                        ? 'bg-gold/20 text-gold'
                        : 'bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06]'
                    }`}
                  >
                    {MEDALS[i] || i + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="truncate font-bold text-white text-sm">
                      {r.username} {isMe && <span className="text-brand-light text-xs font-normal">(Tu)</span>}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {r.bets_count} apostas · {r.won_count} ganhas
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black tabular-nums text-sm text-white">
                    {order === 'balance'
                      ? coinsZeb(r.balance)
                      : `${r.profit >= 0 ? '+' : ''}${coinsZeb(r.profit)}`}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    {order === 'balance'
                      ? `${r.profit >= 0 ? '+' : ''}${coins(r.profit)} lucro`
                      : `Saldo ${coins(r.balance)}`}
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && rows.length === 0 && (
            <div className="text-center py-10 text-xs text-slate-400">
              Ainda não existem apostadores classificados no sistema.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
