'use client';
import Link from 'next/link';
import { useState } from 'react';
import SpecialEventCard from '@/components/SpecialEventCard';
import { useEvents } from '@/lib/hooks/useEvents';
import { dateTime } from '@/lib/format';

export default function EventosPage() {
  const [cat, setCat] = useState<string>('Todas');
  const { events: open, loading } = useEvents({ kind: 'especial', statuses: ['ao_vivo', 'agendado', 'fechado'] });
  const { events: done } = useEvents({ kind: 'especial', statuses: ['terminado', 'cancelado'] });

  const cats = ['Todas', ...Array.from(new Set(open.map((e) => e.category)))];
  const list = cat === 'Todas' ? open : open.filter((e) => e.category === cat);
  const recent = [...done].sort((a, b) => (b.created_at > a.created_at ? 1 : -1)).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-light">
            Mercados especiais
          </p>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-black text-white">
            Apostas em eventos
          </h1>
        </div>

        <Link href="/eventos/propor" className="btn-primary text-xs font-black">
          + Propor Novo Evento
        </Link>
      </div>

      {/* Categorias */}
      {cats.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`tab ${cat === c ? 'tab-on' : 'tab-off'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="card text-center py-12 text-slate-400 animate-pulse">
          A carregar eventos de previsão da Betzebi…
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="card text-center py-12 text-slate-400 space-y-3">
          <p>Não existem eventos abertos nesta categoria de momento.</p>
          <Link href="/eventos/propor" className="btn-primary text-xs font-bold">
            Sê o primeiro a propor um evento!
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((e) => (
          <SpecialEventCard key={e.id} event={e} />
        ))}
      </div>

      {/* Resultados Recentes Resolvidos */}
      {recent.length > 0 && (
        <section className="space-y-3 pt-4 border-t border-white/[0.08]">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span>✓</span> Resultados recentes
          </h2>

          <div className="space-y-2">
            {recent.map((e) => {
              const win = e.markets.flatMap((m) => m.selections).find((s) => s.id === e.winning_selection_id);

              return (
                <div
                  key={e.id}
                  className="rounded-2xl border border-white/[0.06] bg-[#0c1522] flex flex-wrap items-center justify-between gap-3 p-3.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{e.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {e.category} · Concluído em {dateTime(e.created_at)}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                      e.status === 'cancelado'
                        ? 'bg-slate-500/20 text-slate-300'
                        : 'border border-brand/30 bg-brand/15 text-brand-light'
                    }`}
                  >
                    {e.status === 'cancelado' ? 'Anulado' : `✓ ${win?.label ?? 'Vencedor apurado'}`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
