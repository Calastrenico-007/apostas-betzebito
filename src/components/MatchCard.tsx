'use client';
import Link from 'next/link';
import OddsButton from './OddsButton';
import StatusBadge from './StatusBadge';
import { dayLabel, eventIsOpen } from '@/lib/format';
import type { SportEvent } from '@/lib/types';

export default function MatchCard({ event }: { event: SportEvent }) {
  const main = event.markets.find((m) => m.key === '1x2');
  const live = event.status === 'ao_vivo';
  const showScore = live || event.status === 'terminado' || event.status === 'fechado';
  const extraMarkets = Math.max(0, event.markets.length - 1);
  const now = Date.now();
  const started = event.starts_at ? new Date(event.starts_at).getTime() <= now : false;
  const isOpen = eventIsOpen(event, now);

  return (
    <div className="group rounded-2xl border border-white/[0.08] bg-[#0c1522] p-3.5 shadow-card transition-all duration-200 hover:border-white/[0.14] hover:bg-[#0f1a2a]">
      {/* Cabeçalho do Card */}
      <div className="mb-2.5 flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-semibold tracking-wide text-slate-300">
          ⚽ {event.league || 'Futebol'}
        </span>
        <StatusBadge
          kind="futebol"
          status={event.status}
          minute={event.minute}
          started={started && event.status === 'agendado'}
        />
      </div>

      {/* Confronto e Placar */}
      <Link
        href={`/jogo/${event.id}`}
        className="block rounded-xl bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.05]"
      >
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/[0.06] text-[10px] font-black text-slate-300">
              {event.home_team?.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate font-bold text-white">{event.home_team}</span>
          </div>
          {showScore && (
            <span className="font-black tabular-nums text-brand-light text-base">
              {event.home_score ?? 0}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/[0.06] text-[10px] font-black text-slate-300">
              {event.away_team?.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate font-bold text-white">{event.away_team}</span>
          </div>
          {showScore && (
            <span className="font-black tabular-nums text-brand-light text-base">
              {event.away_score ?? 0}
            </span>
          )}
        </div>

        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>{dayLabel(event.starts_at)}</span>
          {!isOpen && (
            <span className="text-amber-400/90 font-medium">Apostas encerradas</span>
          )}
        </div>
      </Link>

      {/* Botões de Odds 1X2 */}
      {main && (
        <div className="mt-3 flex gap-1.5">
          {main.selections.map((s) => (
            <OddsButton
              key={s.id}
              event={event}
              market={main}
              selection={s}
              label={s.key.toUpperCase()}
              compact
            />
          ))}
        </div>
      )}

      {/* Rodapé com atalho de mais mercados */}
      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">
          {isOpen ? 'Fecha ao apito inicial' : 'Mercado fechado'}
        </span>
        <Link
          href={`/jogo/${event.id}`}
          className="font-bold text-brand-light transition hover:text-brand flex items-center gap-1"
        >
          {extraMarkets > 0 ? `+${extraMarkets} mercados` : 'Ver jogo'} ›
        </Link>
      </div>
    </div>
  );
}
