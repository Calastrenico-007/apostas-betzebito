'use client';
import { useEffect, useRef, useState } from 'react';
import { useBetslip } from './providers/BetslipProvider';
import { mutualMultiplier, odd, selectionBettable } from '@/lib/format';
import type { Market, Selection, SportEvent } from '@/lib/types';

interface Props {
  event: SportEvent;
  market: Market;
  selection: Selection;
  label?: string;
  compact?: boolean;
}

export default function OddsButton({ event, market, selection, label, compact }: Props) {
  const slip = useBetslip();
  const selected = slip.has(selection.id);
  const bettable = selectionBettable(event, market, selection);
  const isMutual = market.pool_type === 'mutua';
  const value = isMutual ? mutualMultiplier(market, selection) : selection.odds;

  // Animação de variação de cotação
  const prev = useRef<number | null>(selection.odds);
  const [flash, setFlash] = useState<'' | 'animate-flashUp' | 'animate-flashDown'>('');
  useEffect(() => {
    const p = prev.current;
    const n = selection.odds;
    if (p != null && n != null && p !== n) {
      setFlash(n > p ? 'animate-flashUp' : 'animate-flashDown');
      const t = setTimeout(() => setFlash(''), 1200);
      prev.current = n;
      return () => clearTimeout(t);
    }
    prev.current = n;
  }, [selection.odds]);

  const won = selection.result === 'ganha';
  const lost = selection.result === 'perdida';
  const isSuspended = market.status === 'suspenso' || !bettable;

  return (
    <button
      type="button"
      disabled={!bettable}
      onClick={() =>
        slip.toggle({
          selectionId: selection.id,
          marketId: market.id,
          eventId: event.id,
          eventTitle: event.title,
          marketName: market.name,
          label: selection.label,
          odds: selection.odds == null ? null : Number(selection.odds),
          poolType: market.pool_type,
        })
      }
      className={`group relative flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border transition-all duration-150 ${
        compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'
      } ${
        selected
          ? 'border-brand bg-brand font-black text-brand-ink shadow-glow-sm'
          : 'border-white/[0.08] bg-[#0c1522] text-slate-200 hover:border-brand/40 hover:bg-[#121e30]'
      } ${won ? '!border-brand !bg-brand/20 !text-brand-light font-bold' : ''} ${
        lost ? 'opacity-35 line-through' : ''
      } disabled:cursor-not-allowed ${
        !won && !selected && isSuspended ? 'opacity-55 bg-black/30 hover:border-white/[0.08]' : ''
      } ${flash}`}
    >
      <span className={`truncate font-semibold ${selected ? 'text-brand-ink font-bold' : 'text-slate-200'}`}>
        {label ?? selection.label}
      </span>

      <span
        className={`shrink-0 font-black tabular-nums transition-colors ${
          selected ? 'text-brand-ink' : won ? 'text-brand-light' : 'text-brand-light group-hover:text-white'
        }`}
      >
        {isSuspended && selection.result === 'pendente' ? (
          <span className="text-[11px] text-slate-400 font-normal">🔒</span>
        ) : isMutual ? (
          value ? `x${odd(value)}` : 'novo'
        ) : (
          odd(value)
        )}
      </span>

      {won && (
        <span className="absolute -right-1 -top-1 rounded-full bg-brand px-1 text-[9px] font-black text-brand-ink">
          ✓
        </span>
      )}
    </button>
  );
}
