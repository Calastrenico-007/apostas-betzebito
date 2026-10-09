'use client';
import { useCallback, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { coins, coinsZeb, countdown, mutualMultiplier, odd } from '@/lib/format';
import { useEvents } from '@/lib/hooks/useEvents';
import { useLeaderboard } from '@/lib/hooks/useLeaderboard';
import { useNow, useRealtime } from '@/lib/hooks/useRealtime';

const MEDAL = ['🥇', '🥈', '🥉'];

interface Activity {
  id: number;
  message: string;
  amount: number | null;
  created_at: string;
}

export default function TelaoPage() {
  const now = useNow(1000);
  const [origin, setOrigin] = useState('');
  const { rows: byBalance } = useLeaderboard('balance', 10, 15000);
  const { rows: byProfit } = useLeaderboard('profit', 5, 15000);
  const { events } = useEvents({ statuses: ['ao_vivo', 'agendado', 'fechado'] });
  const [feed, setFeed] = useState<Activity[]>([]);

  const loadFeed = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await getSupabase()
      .from('activity')
      .select('*')
      .order('id', { ascending: false })
      .limit(15);
    setFeed((data as Activity[]) || []);
  }, []);

  useEffect(() => {
    loadFeed();
    if (typeof window !== 'undefined') {
      setOrigin(window.location.host);
    }
  }, [loadFeed]);

  useRealtime(['activity'], loadFeed);

  const specials = events.filter((e) => e.kind === 'especial' && e.status === 'ao_vivo').slice(0, 4);
  const matches = events
    .filter((e) => e.kind === 'futebol')
    .sort((a, b) => (a.status === 'ao_vivo' ? -1 : 0) - (b.status === 'ao_vivo' ? -1 : 0))
    .slice(0, 4);

  function fullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-[#050a10] p-4 text-white lg:p-6 select-none"
      onDoubleClick={fullscreen}
    >
      {/* Cabeçalho do Telão */}
      <header className="mb-4 flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <span className="brand-mark !h-12 !w-12 !text-xl">B</span>
          <div>
            <div className="text-3xl font-black tracking-tight text-white">
              Bet<span className="text-brand-light">zebi</span>{' '}
              <span className="text-lg font-bold text-slate-400">· Ecrã de eventos</span>
            </div>
            <div className="text-xs font-semibold text-amber-400">
              Apostas desportivas · Operação manual · Idade mínima legal aplicável
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-4xl font-black tabular-nums tracking-tight text-white">
            {origin
              ? new Intl.DateTimeFormat('pt-PT', {
                  timeZone: 'Africa/Maputo',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }).format(new Date(now))
              : ''}
          </div>
          {origin && (
            <div className="text-sm font-bold text-brand-light">
              Acede e aposta agora: <span className="underline underline-offset-4">{origin}</span>
            </div>
          )}
        </div>
      </header>

      {/* Grid Central */}
      <div className="grid flex-1 gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        {/* Coluna da Esquerda: Classificação Top 10 e Maior Lucro */}
        <section className="rounded-3xl border border-white/[0.08] bg-[#0c1522] p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>🏆</span> Top 10 Apostadores (Saldo)
            </h2>
            <span className="rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-xs font-bold text-brand-light">
              Ao Vivo
            </span>
          </div>

          <div className="space-y-2">
            {byBalance.map((r, i) => (
              <div
                key={r.user_id}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 transition-all ${
                  i < 3
                    ? 'border border-gold/30 bg-gold/10'
                    : 'border border-white/[0.05] bg-white/[0.02]'
                }`}
              >
                <span className="w-8 text-center text-xl font-black">
                  {MEDAL[i] || i + 1}
                </span>
                <span className="flex-1 truncate text-lg font-black text-white">{r.username}</span>
                <span className="text-xl font-black tabular-nums text-brand-light">
                  {coinsZeb(r.balance)}
                </span>
              </div>
            ))}
            {byBalance.length === 0 && (
              <div className="text-slate-400 py-6 text-center text-sm">
                Regista-te e sê o primeiro a entrar no ranking!
              </div>
            )}
          </div>

          <h3 className="mb-2.5 mt-6 text-base font-black text-white flex items-center gap-1.5">
            <span>📈</span> Maior Lucro Líquido
          </h3>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {byProfit.map((r, i) => (
              <div
                key={r.user_id}
                className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs"
              >
                <span className="truncate font-bold text-white">
                  {i + 1}. {r.username}
                </span>
                <span
                  className={`font-black tabular-nums ${
                    r.profit >= 0 ? 'text-brand-light' : 'text-red-400'
                  }`}
                >
                  {r.profit >= 0 ? '+' : ''}
                  {coins(r.profit)} ZEB
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Coluna da Direita: Futebol & Previsões ao Vivo */}
        <section className="space-y-4">
          {/* Futebol */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#0c1522] p-5 shadow-card">
            <h2 className="mb-3.5 text-xl font-black text-white flex items-center gap-2">
              <span>⚽</span> Futebol & Jogos da Feira
            </h2>

            <div className="grid gap-2.5 xl:grid-cols-2">
              {matches.map((e) => {
                const m = e.markets.find((x) => x.key === '1x2');
                const isLive = e.status === 'ao_vivo';

                return (
                  <div
                    key={e.id}
                    className={`rounded-2xl border p-3.5 ${
                      isLive
                        ? 'border-red-500/30 bg-red-500/5'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-semibold text-slate-300">{e.league}</span>
                      {isLive ? (
                        <span className="badge-live">● Ao Vivo {e.minute ? `· ${e.minute}` : ''}</span>
                      ) : (
                        <span>Agendado</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-base font-bold text-white">
                      <span className="truncate">{e.home_team}</span>
                      {e.status !== 'agendado' && (
                        <span className="px-3 text-xl font-black text-brand-light tabular-nums">
                          {e.home_score ?? 0} - {e.away_score ?? 0}
                        </span>
                      )}
                      <span className="truncate text-right">{e.away_team}</span>
                    </div>

                    {m && (
                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                        {m.selections.map((s) => (
                          <div
                            key={s.id}
                            className="rounded-lg bg-black/40 border border-white/[0.06] py-1.5 px-2 flex justify-between items-center text-xs"
                          >
                            <span className="font-bold text-slate-400">{s.key.toUpperCase()}</span>
                            <span className="font-black tabular-nums text-brand-light">
                              {m.status === 'suspenso' ? '🔒' : odd(s.odds)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {matches.length === 0 && (
                <div className="text-slate-400 py-6 text-center text-sm">
                  Sem partidas agendadas no momento.
                </div>
              )}
            </div>
          </div>

          {/* Previsões Especiais */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#0c1522] p-5 shadow-card">
            <h2 className="mb-3.5 text-xl font-black text-white flex items-center gap-2">
              <span>🎯</span> Previsões & Eventos Especiais
            </h2>

            <div className="grid gap-2.5 xl:grid-cols-2">
              {specials.map((e) => {
                const m = e.markets[0];
                if (!m) return null;
                const pool = m.selections.reduce((a, s) => a + Number(s.pool || 0), 0);

                return (
                  <div key={e.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="mb-2 text-sm font-bold text-white leading-snug">{e.title}</div>
                    <div className="space-y-1.5">
                      {m.selections.map((s) => {
                        const v = m.pool_type === 'mutua' ? mutualMultiplier(m, s) : s.odds;
                        return (
                          <div
                            key={s.id}
                            className="flex justify-between items-center rounded-xl bg-black/30 border border-white/[0.05] px-3 py-1.5 text-xs"
                          >
                            <span className="font-semibold text-slate-200">{s.label}</span>
                            <span className="font-black tabular-nums text-brand-light">
                              {m.status === 'suspenso'
                                ? '🔒'
                                : m.pool_type === 'mutua'
                                ? v
                                  ? `x${odd(v)}`
                                  : '—'
                                : odd(v)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {specials.length === 0 && (
                <div className="text-slate-400 py-4 text-center text-xs">
                  Sem eventos especiais abertos de momento.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Ticker de Apostas & Ganhos em Tempo Real */}
      <footer className="mt-4 overflow-hidden whitespace-nowrap rounded-2xl border border-brand/30 bg-gradient-to-r from-brand-dark via-brand to-brand-light py-2.5 text-sm font-black text-brand-ink shadow-glow">
        <div className="inline-block animate-ticker">
          {feed.length
            ? feed.map((f) => `🎉 ${f.message}`).join('     •     ')
            : 'Betzebi · Pedidos de carteira por e-Mola sujeitos a confirmação manual'}
        </div>
      </footer>

      <p className="mt-2 text-center text-[10px] text-slate-500">
        Dá duplo clique em qualquer parte do ecrã para ativar o Modo Ecrã Inteiro (Fullscreen)
      </p>
    </div>
  );
}
