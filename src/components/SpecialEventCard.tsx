'use client';
import OddsButton from './OddsButton';
import StatusBadge from './StatusBadge';
import { coins, countdown } from '@/lib/format';
import { useNow } from '@/lib/hooks/useRealtime';
import type { SportEvent } from '@/lib/types';

export default function SpecialEventCard({ event, big }: { event: SportEvent; big?: boolean }) {
  const now = useNow(1000);
  const market = event.markets[0];
  if (!market) return null;
  const mutual = market.pool_type === 'mutua';
  const pool = market.selections.reduce((a, s) => a + Number(s.pool || 0), 0);
  const closed = event.closes_at ? new Date(event.closes_at).getTime() <= now : false;

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#0c1522] shadow-card transition-all duration-200 hover:border-white/[0.14] hover:bg-[#0f1a2a] ${
        big ? 'p-5' : 'p-3.5'
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2 text-xs text-slate-300">
        <span className="inline-flex items-center gap-1 font-semibold text-brand-light">
          🎯 {event.category}
        </span>
        <div className="flex items-center gap-2">
          {mutual && (
            <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300">
              Aposta Mútua
            </span>
          )}
          <StatusBadge kind="especial" status={closed && event.status === 'ao_vivo' ? 'fechado' : event.status} />
        </div>
      </div>

      <h3 className={`font-bold leading-snug text-white ${big ? 'text-xl' : 'text-base'}`}>{event.title}</h3>
      {event.description && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{event.description}</p>}

      <div className={`mt-3 grid gap-1.5 ${market.selections.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
        {market.selections.map((s) => (
          <OddsButton key={s.id} event={event} market={market} selection={s} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-white/[0.05] pt-2.5">
        <span className="font-medium text-slate-300">
          {mutual ? `Bolo acumulado: ${coins(pool)} ZEB` : 'Mercado de Odds Fixas'}
        </span>
        {event.closes_at && (
          <span className="text-right">
            {closed ? 'Apostas encerradas' : `Encerra em ${countdown(event.closes_at, now)}`}
          </span>
        )}
      </div>
    </div>
  );
}
