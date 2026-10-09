'use client';
import Link from 'next/link';
import { useToast } from '@/components/providers/ToastProvider';
import { getSupabase } from '@/lib/supabase/client';
import { dateTime, errMsg } from '@/lib/format';
import { useEvents } from '@/lib/hooks/useEvents';

export default function AdminPropostas() {
  const toast = useToast();
  const { events, loading, reload } = useEvents({ kind: 'especial', statuses: ['pendente'] });

  async function act(fn: 'approve_event' | 'reject_event', id: string) {
    const { error } = await getSupabase().rpc(fn, { p_event: id });
    if (error) return toast(errMsg(error), 'erro');
    toast(fn === 'approve_event' ? 'Proposta aprovada e publicada no lobby!' : 'Proposta rejeitada.', 'ok');
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-white/[0.08] pb-3">
        <h2 className="text-base font-black text-white">
          Propostas de Eventos Submetidas pelos Visitantes
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Revê as perguntas sugeridas pelos utilizadores. Para eventos de odds fixas, ajusta as cotações antes de aprovar.
        </p>
      </div>

      {loading && (
        <div className="card text-center py-10 text-slate-400 animate-pulse">
          A carregar propostas…
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="card text-center py-12 text-slate-400">
          <div className="text-2xl mb-1">🎉</div>
          Não existem propostas de eventos pendentes de momento.
        </div>
      )}

      <div className="space-y-3">
        {events.map((e) => {
          const m = e.markets[0];
          const needsOdds = m?.pool_type === 'fixa' && m.selections.some((s) => s.odds == null);

          return (
            <div key={e.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-white">{e.title}</h3>
                  <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-2">
                    <span>{e.category}</span>
                    <span>·</span>
                    <span className="font-semibold text-brand-light">
                      {m?.pool_type === 'mutua' ? 'Apostas Mútuas' : 'Odds Fixas'}
                    </span>
                    <span>·</span>
                    <span>Submetido: {dateTime(e.created_at)}</span>
                    {e.closes_at && <span>· Encerra: {dateTime(e.closes_at)}</span>}
                  </div>
                  {e.description && (
                    <p className="mt-2 text-xs text-slate-300 bg-black/20 p-2.5 rounded-xl border border-white/[0.05]">
                      {e.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Opções propostas */}
              <div className="flex flex-wrap gap-1.5">
                {m?.selections.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-lg bg-black/30 border border-white/[0.06] px-2.5 py-1 text-xs text-slate-200"
                  >
                    {s.label}{' '}
                    {s.odds != null && (
                      <strong className="text-brand-light ml-1 font-black">{s.odds}</strong>
                    )}
                  </span>
                ))}
              </div>

              {/* Botões de Ação */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.05]">
                <Link
                  href={`/admin/eventos/${e.id}`}
                  className="btn-ghost text-xs text-center"
                >
                  Editar / Odds
                </Link>
                <button
                  type="button"
                  className="btn-primary text-xs font-black"
                  disabled={needsOdds}
                  title={needsOdds ? 'Define as odds antes de aprovar' : ''}
                  onClick={() => act('approve_event', e.id)}
                >
                  ✓ Aprovar
                </button>
                <button
                  type="button"
                  className="btn-danger text-xs font-black"
                  onClick={() => act('reject_event', e.id)}
                >
                  ✕ Rejeitar
                </button>
              </div>

              {needsOdds && (
                <div className="text-[11px] font-bold text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  ⚠️ Faltam odds definidas para as opções. Clica em &quot;Editar / Odds&quot; ou muda o evento para Apostas Mútuas.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
