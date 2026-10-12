'use client';
import Link from 'next/link';
import { useState } from 'react';
import MatchCard from '@/components/MatchCard';
import SpecialEventCard from '@/components/SpecialEventCard';
import { useEvents } from '@/lib/hooks/useEvents';

type Tab = 'tudo' | 'futebol' | 'especiais';

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('tudo');
  const [selectedLeague, setSelectedLeague] = useState<string>('todas');

  // Consulta eventos ativos (agendados, ao vivo e fechados recentemente)
  const { events, loading } = useEvents({ statuses: ['agendado', 'ao_vivo', 'fechado'] });

  const matches = events.filter((e) => e.kind === 'futebol');
  const liveMatches = matches.filter((m) => m.status === 'ao_vivo');
  const upcomingMatches = matches.filter((m) => m.status !== 'ao_vivo');
  const specials = events.filter((e) => e.kind === 'especial');

  // Ligas disponíveis dinamicamente
  const availableLeagues = Array.from(new Set(matches.map((m) => m.league || 'Futebol')));

  const filteredMatches = selectedLeague === 'todas'
    ? upcomingMatches
    : upcomingMatches.filter((m) => (m.league || 'Futebol') === selectedLeague);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Desporto</h1>
          <p className="mt-1 text-sm text-slate-400">Escolhe um jogo para ver as odds.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {liveMatches.length > 0 && (
            <span className="badge-live">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              {liveMatches.length} ao vivo
            </span>
          )}
          <span className="rounded-full border border-white/[0.08] px-2.5 py-1">
            {events.length} {events.length === 1 ? 'evento' : 'eventos'}
          </span>
        </div>
      </section>

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            ['tudo', 'Destaques'],
            ['futebol', 'Futebol'],
            ['especiais', 'Previsões'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`tab ${tab === key ? 'tab-on' : 'tab-off'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'futebol' && availableLeagues.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedLeague('todas')}
              aria-pressed={selectedLeague === 'todas'}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                selectedLeague === 'todas'
                  ? 'bg-brand/20 text-brand-light ring-1 ring-brand/30'
                  : 'bg-white/[0.03] text-slate-400 hover:text-white'
              }`}
            >
              Todas
            </button>
            {availableLeagues.map((league) => (
              <button
                key={league}
                type="button"
                onClick={() => setSelectedLeague(league)}
                aria-pressed={selectedLeague === league}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  selectedLeague === league
                    ? 'bg-brand/20 text-brand-light ring-1 ring-brand/30'
                    : 'bg-white/[0.03] text-slate-400 hover:text-white'
                }`}
              >
                {league}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="card animate-pulse py-8 text-center text-slate-400">
          A carregar jogos…
        </div>
      )}

      {!loading && (tab === 'tudo' || tab === 'futebol') && liveMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="badge-live">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              Ao vivo
            </span>
            <span className="text-xs text-slate-400">{liveMatches.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} event={match} />
            ))}
          </div>
        </section>
      )}

      {!loading && (tab === 'tudo' || tab === 'futebol') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Próximos jogos</h2>
            <span className="text-xs text-slate-500">{filteredMatches.length}</span>
          </div>
          {filteredMatches.length === 0 ? (
            <div className="rounded-xl border border-white/[0.07] bg-panel px-4 py-5 text-sm text-slate-400">
              Ainda não há jogos disponíveis.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredMatches.map((match) => (
                <MatchCard key={match.id} event={match} />
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && (tab === 'tudo' || tab === 'especiais') && specials.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Previsões</h2>
            <Link href="/eventos" className="text-xs font-bold text-brand-light hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(tab === 'tudo' ? specials.slice(0, 4) : specials).map((event) => (
              <SpecialEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {!loading && tab === 'especiais' && specials.length === 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-panel px-4 py-5 text-sm text-slate-400">
          Ainda não há previsões disponíveis.
        </div>
      )}
    </div>
  );
}
