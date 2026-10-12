'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import OddsButton from '@/components/OddsButton';
import StatusBadge from '@/components/StatusBadge';
import BuildBetPanel from '@/components/BuildBetPanel';
import { dateTime, dayLabel, eventIsOpen } from '@/lib/format';
import { useEvents } from '@/lib/hooks/useEvents';

type MarketFilter = 'todos' | 'populares' | 'cartoes' | 'totais' | 'vencedor' | 'golos';

function marketMatchesFilter(key: string, filter: MarketFilter) {
  const isGoalsTotal = key.startsWith('ou');
  const isCardTotal = key.startsWith('cards_total_');
  const isHandicap = key.startsWith('hcp_');

  switch (filter) {
    case 'todos':
      return true;
    case 'populares':
      return ['1x2', 'dc', 'dnb', 'btts', 'goals_exact'].includes(key) || isGoalsTotal || isHandicap;
    case 'cartoes':
      return isCardTotal;
    case 'totais':
      return isGoalsTotal || key === 'goals_exact';
    case 'vencedor':
      return ['1x2', 'dc', 'dnb'].includes(key) || isHandicap;
    case 'golos':
      return isGoalsTotal || key === 'goals_exact' || key === 'btts' || key === 'ht1x2';
  }
}

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const { events, loading } = useEvents({ id });
  const e = events[0];
  const [filter, setFilter] = useState<MarketFilter>('populares');

  if (loading) {
    return (
      <div className="card text-center py-12 text-slate-400 animate-pulse">
        A carregar partida da Betzebi…
      </div>
    );
  }

  if (!e) {
    return (
      <div className="card text-center py-12 text-slate-400">
        Jogo não encontrado ou indisponível.{' '}
        <Link href="/" className="text-brand-light font-bold hover:underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  const now = Date.now();
  const started = e.starts_at ? new Date(e.starts_at).getTime() <= now : false;
  const showScore = e.status === 'ao_vivo' || e.status === 'terminado' || e.status === 'fechado';
  const isOpen = eventIsOpen(e, now);

  const visibleMarkets = e.markets.filter((m) => m.key !== 'builder' && marketMatchesFilter(m.key, filter));

  return (
    <div className="space-y-5">
      {/* Navegação Superior */}
      <div className="flex items-center justify-between text-xs">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-bold text-slate-400 hover:text-white transition"
        >
          ‹ Voltar a todos os jogos
        </Link>
        <span className="text-slate-500 uppercase tracking-wider font-semibold">
          {e.league || 'Competição Oficial'}
        </span>
      </div>

      {/* Scoreboard Estilo Broadcast */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0e1826] to-[#08101a] p-5 sm:p-7 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">⚽ {e.league}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{dayLabel(e.starts_at)}</span>
          </div>
          <StatusBadge
            kind={e.kind}
            status={e.status}
            minute={e.minute}
            started={started && e.status === 'agendado'}
          />
        </div>

        {/* Confronto */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6 py-2">
          {/* Equipa Casa */}
          <div className="text-center sm:text-left">
            <div className="inline-grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-2xl bg-white/[0.04] text-base sm:text-lg font-black text-white ring-1 ring-white/[0.08] mb-2">
              {e.home_team?.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Casa</div>
            <h1 className="mt-0.5 text-lg sm:text-2xl font-black text-white leading-snug">{e.home_team}</h1>
          </div>

          {/* Marcador Central */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-black/30 px-5 py-3 text-center min-w-[100px] sm:min-w-[140px]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {e.status === 'ao_vivo' ? `Ao Vivo ${e.minute || ''}` : 'Placar'}
            </div>
            <div className="mt-1 text-2xl sm:text-4xl font-black tabular-nums text-brand-light">
              {showScore ? `${e.home_score ?? 0} - ${e.away_score ?? 0}` : 'VS'}
            </div>
            {e.ht_home_score != null && (
              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                HT: {e.ht_home_score} - {e.ht_away_score}
              </div>
            )}
          </div>

          {/* Equipa Fora */}
          <div className="text-center sm:text-right">
            <div className="inline-grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-2xl bg-white/[0.04] text-base sm:text-lg font-black text-white ring-1 ring-white/[0.08] mb-2 sm:ml-auto">
              {e.away_team?.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Visitante</div>
            <h2 className="mt-0.5 text-lg sm:text-2xl font-black text-white leading-snug">{e.away_team}</h2>
          </div>
        </div>

        {/* Barra de Informação de Fecho das Apostas */}
        <div className="mt-5 border-t border-white/[0.06] pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div>
            Data e Hora oficial: <strong className="text-slate-200">{dateTime(e.starts_at)}</strong>
          </div>
          <div className="font-semibold">
            {isOpen ? (
              <span className="text-brand-light">✓ Apostas abertas até ao apito inicial</span>
            ) : (
              <span className="text-amber-400">🔒 Apostas encerradas para esta partida</span>
            )}
          </div>
        </div>
      </div>

      {isOpen && <BuildBetPanel event={e} />}

      {/* Abas de Filtro de Mercados */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-white/[0.08]">
        {([
          ['todos', 'Tudo'],
          ['populares', 'Populares'],
          ['cartoes', 'Cartões'],
          ['totais', 'Totais'],
          ['vencedor', 'Vencedor'],
          ['golos', 'Golos'],
        ] as [MarketFilter, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`tab ${filter === k ? 'tab-on' : 'tab-off'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grelha de Mercados */}
      <div className="space-y-3">
        {visibleMarkets.map((m) => (
          <section key={m.id} className="card !p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>⚡</span> {m.name}
              </h3>
              <div>
                {m.status === 'suspenso' && (
                  <span className="badge-closed">🔒 Suspenso</span>
                )}
                {m.status === 'resolvido' && (
                  <span className="badge-settled">✓ Resolvido</span>
                )}
                {m.status === 'anulado' && (
                  <span className="badge-void">Anulado</span>
                )}
              </div>
            </div>

            <div
              className={`grid gap-2 ${
                m.selections.length === 2
                  ? 'grid-cols-2'
                  : m.selections.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-4'
              }`}
            >
              {m.selections.map((s) => (
                <OddsButton key={s.id} event={e} market={m} selection={s} />
              ))}
            </div>
          </section>
        ))}

        {visibleMarkets.length === 0 && (
          <div className="card text-center py-6 text-slate-400">
            Nenhum mercado corresponde ao filtro selecionado.
          </div>
        )}
      </div>
    </div>
  );
}
