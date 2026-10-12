'use client';

import { useState } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import { useBetslip } from '@/components/providers/BetslipProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg, odd, selectionBettable } from '@/lib/format';
import type { Market, MarketStatus, PoolType, SelResult, SportEvent } from '@/lib/types';

type Offer = {
  id: string;
  market_id: string;
  label: string;
  odds: number | null;
  result: SelResult;
  market: { id: string; name: string; pool_type: PoolType; status: MarketStatus } | null;
};

export default function BuildBetPanel({ event }: { event: SportEvent }) {
  const toast = useToast();
  const slip = useBetslip();
  const { user, profile } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const markets = event.markets.filter((market) => market.key !== 'builder' && market.pool_type === 'fixa');
  const selections = markets.flatMap((market) =>
    market.selections.map((selection) => ({ market, selection })),
  );

  function toggleSelection(market: Market, selectionId: string) {
    const sameMarket = selected.find((id) =>
      selections.some((item) => item.selection.id === id && item.market.id === market.id),
    );
    if (sameMarket === selectionId) {
      setSelected((current) => current.filter((id) => id !== selectionId));
      return;
    }
    if (sameMarket) {
      setSelected((current) => current.map((id) => id === sameMarket ? selectionId : id));
      return;
    }
    if (selected.length >= 6) return toast('O Build-a-Bet aceita no máximo 6 seleções.', 'erro');
    setSelected((current) => [...current, selectionId]);
  }

  async function requestQuote() {
    if (!user) return toast('Inicia sessão para criar um Build-a-Bet.', 'erro');
    if (profile?.role !== 'admin' && profile?.account_status !== 'aprovado') {
      return toast('A tua conta aguarda aprovação manual do administrador.', 'erro');
    }
    if (selected.length < 2) return toast('Escolhe pelo menos 2 seleções.', 'erro');

    setBusy(true);
    const sb = getSupabase();
    const { data, error } = await sb.rpc('request_build_bet', {
      p_event: event.id,
      p_selections: selected,
    });
    if (error) {
      setBusy(false);
      return toast(errMsg(error), 'erro');
    }
    if (typeof data !== 'string') {
      setBusy(false);
      return toast('Não foi possível confirmar o pedido Build-a-Bet.', 'erro');
    }

    const { data: offerData, error: offerError } = await sb
      .from('selections')
      .select('id, market_id, label, odds, result, market:markets(id, name, pool_type, status)')
      .eq('id', data)
      .single();
    setBusy(false);
    if (offerError) return toast(errMsg(offerError), 'erro');
    if (!offerData) return toast('A combinação Build-a-Bet não foi encontrada.', 'erro');

    const offer = offerData as unknown as Offer;
    if (!offer.market || offer.odds == null) {
      return toast(
        'Pedido registado. Quando o administrador definir a odd, carrega aqui novamente para adicionar a combinação ao boletim.',
        'ok',
      );
    }
    if (!selectionBettable(
      event,
      { status: offer.market.status, pool_type: offer.market.pool_type },
      { odds: Number(offer.odds), result: offer.result },
    )) {
      return toast('Esta combinação já não está disponível para apostas.', 'erro');
    }
    if (slip.items.some((item) => item.eventId === event.id)) {
      return toast('Remove primeiro as outras seleções desta partida do boletim.', 'erro');
    }

    slip.toggle({
      selectionId: offer.id,
      marketId: offer.market_id,
      eventId: event.id,
      eventTitle: event.title,
      marketName: 'Build-a-Bet',
      label: offer.label,
      odds: Number(offer.odds),
      poolType: offer.market.pool_type,
    });
    setSelected([]);
    setExpanded(false);
    toast(`Build-a-Bet adicionado ao boletim @${odd(offer.odds)}.`, 'ok');
  }

  return (
    <section className="card !p-0 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span>
          <span className="block text-sm font-black text-white">Build-a-Bet</span>
          <span className="mt-1 block text-xs text-slate-400">
            Combina seleções desta partida; a odd é aprovada pelo administrador.
          </span>
        </span>
        <span className="shrink-0 rounded-lg bg-brand/15 px-3 py-1.5 text-xs font-bold text-brand-light">
          {expanded ? 'Fechar' : 'Criar'}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/[0.08] p-4">
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {markets.map((market) => (
              <div key={market.id} className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
                <h3 className="mb-2 text-xs font-bold text-slate-300">{market.name}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {market.selections.map((selection) => {
                    const chosen = selected.includes(selection.id);
                    const selectedFromMarket = selected.some((id) =>
                      selections.some((item) => item.selection.id === id && item.market.id === market.id),
                    );
                    const available = selectionBettable(event, market, selection);

                    return (
                      <button
                        key={selection.id}
                        type="button"
                        disabled={!available || (!chosen && selectedFromMarket)}
                        onClick={() => toggleSelection(market, selection.id)}
                        className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                          chosen
                            ? 'border-brand bg-brand/20 text-white'
                            : 'border-white/[0.08] bg-panel2 text-slate-300 hover:border-brand/50'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        <span className="truncate">{selection.label}</span>
                        <span className="shrink-0 font-black text-brand-light">
                          {selection.odds == null ? '—' : odd(selection.odds)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
            <p className="text-xs text-slate-400">
              {selected.length}/6 seleções · a cotação combinada será definida manualmente
            </p>
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={busy || selected.length < 2}
              onClick={requestQuote}
            >
              {busy ? 'A verificar…' : 'Pedir odd / adicionar ao boletim'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Se esta combinação ainda não tiver cotação aprovada, ficará pendente e não poderá ser apostada até o administrador definir a odd.
          </p>
        </div>
      )}
    </section>
  );
}
