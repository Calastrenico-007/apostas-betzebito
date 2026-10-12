'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/providers/ToastProvider';
import { getSupabase } from '@/lib/supabase/client';
import { dateTime, errMsg, localInputToIso } from '@/lib/format';
import { useEvents } from '@/lib/hooks/useEvents';

const SUGGESTED_LEAGUES = ['Moçambola', 'Premier League', 'La Liga', 'Champions League', 'Taça de Moçambique'];

export default function AdminJogos() {
  const router = useRouter();
  const toast = useToast();
  const { events } = useEvents({ kind: 'futebol' });

  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [league, setLeague] = useState('Moçambola');
  const [kickoff, setKickoff] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'ativos' | 'todos' | 'terminados'>('ativos');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!home.trim() || !away.trim() || !kickoff) {
      return toast('Preenche equipas e data/hora do pontapé de saída', 'erro');
    }

    setBusy(true);
    const startsAt = localInputToIso(kickoff);
    const startsAtDate = startsAt ? new Date(startsAt) : null;
    const isPast = startsAtDate && startsAtDate.getTime() <= Date.now();

    const { data, error } = await getSupabase()
      .from('events')
      .insert({
        kind: 'futebol',
        title: `${home.trim()} vs ${away.trim()}`,
        category: 'Futebol',
        league: league.trim() || 'Futebol',
        home_team: home.trim(),
        away_team: away.trim(),
        starts_at: startsAt,
        status: isPast ? 'fechado' : 'agendado',
      })
      .select('id')
      .single();

    setBusy(false);
    if (error) return toast(errMsg(error), 'erro');

    toast('Partida criada com mercados de futebol gerados automaticamente. Ajusta as odds agora.', 'ok');
    router.push(`/admin/jogos/${(data as { id: string }).id}`);
  }

  const list = events.filter((e) => {
    if (filter === 'todos') return true;
    if (filter === 'terminados') return e.status === 'terminado' || e.status === 'cancelado';
    return e.status === 'agendado' || e.status === 'ao_vivo' || e.status === 'fechado';
  }).sort((a, b) => ((a.starts_at || '') > (b.starts_at || '') ? -1 : 1));

  return (
    <div className="space-y-5">
      {/* Formulário de Criação de Jogo */}
      <form onSubmit={create} className="card space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span>⚽</span> Registar Nova Partida de Futebol
          </h2>
          <span className="text-[11px] text-brand-light font-bold">
            Gera mercados de futebol automaticamente
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Equipa da Casa</label>
            <input
              className="input !py-2 text-xs font-bold"
              value={home}
              onChange={(e) => setHome(e.target.value)}
              placeholder="Ex: Costa do Sol"
              required
            />
          </div>

          <div>
            <label className="label">Equipa Visitante</label>
            <input
              className="input !py-2 text-xs font-bold"
              value={away}
              onChange={(e) => setAway(e.target.value)}
              placeholder="Ex: Ferroviário de Maputo"
              required
            />
          </div>

          <div>
            <label className="label">Liga / Competição</label>
            <input
              className="input !py-2 text-xs font-bold"
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              placeholder="Competição"
              required
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {SUGGESTED_LEAGUES.map((l) => (
                <button
                  type="button"
                  key={l}
                  onClick={() => setLeague(l)}
                  className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Data e Hora do Pontapé de Saída</label>
            <input
              type="datetime-local"
              className="input !py-2 text-xs font-bold"
              value={kickoff}
              onChange={(e) => setKickoff(e.target.value)}
              required
            />
            <p className="mt-1 text-[10px] text-slate-400">
              As apostas fecham automaticamente quando este horário for atingido.
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full text-xs font-black"
          disabled={busy}
        >
          {busy ? 'A criar partida…' : 'Criar Partida & Configurar Cotações'}
        </button>
      </form>

      {/* Lista de Partidas Registadas */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
          <h3 className="text-sm font-black text-white uppercase tracking-wider">
            Partidas Registadas ({list.length})
          </h3>

          <div className="flex gap-1.5 bg-black/30 p-1 rounded-xl border border-white/[0.06]">
            {(['ativos', 'todos', 'terminados'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition capitalize ${
                  filter === f
                    ? 'bg-brand text-brand-ink font-black shadow-glow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {list.map((e) => {
            const missingOdds = e.markets
              .flatMap((m) => m.selections)
              .filter((s) => s.odds == null).length;

            return (
              <Link
                key={e.id}
                href={`/admin/jogos/${e.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 p-3.5 hover:border-brand/40 hover:bg-[#101b2a] transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white text-sm truncate">{e.title}</span>
                    {e.status !== 'agendado' && (
                      <span className="font-black tabular-nums text-brand-light text-sm">
                        ({e.home_score ?? 0} - {e.away_score ?? 0})
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                    <span>{e.league}</span>
                    <span>·</span>
                    <span>{dateTime(e.starts_at)}</span>
                    {missingOdds > 0 && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.2 text-[10px] font-bold text-amber-300">
                        ⚠️ {missingOdds} odds por definir
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge kind="futebol" status={e.status} minute={e.minute} />
                  <span className="text-xs font-bold text-slate-400">Gerir ›</span>
                </div>
              </Link>
            );
          })}

          {list.length === 0 && (
            <div className="card text-center py-8 text-xs text-slate-400">
              Nenhuma partida encontrada nesta categoria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
