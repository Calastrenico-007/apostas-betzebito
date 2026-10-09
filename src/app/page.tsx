'use client';
import Link from 'next/link';
import { useState } from 'react';
import MatchCard from '@/components/MatchCard';
import SpecialEventCard from '@/components/SpecialEventCard';
import { useEvents } from '@/lib/hooks/useEvents';
import { useAuth } from '@/components/providers/AuthProvider';
import { getOperationMode } from '@/lib/operation-mode';

type Tab = 'tudo' | 'futebol' | 'especiais';

export default function HomePage() {
  const { user, profile } = useAuth();
  const mode = getOperationMode();
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
    <div className="space-y-6">
      {/* Hero Banner Esportivo Betzebi */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0c1624] via-[#09111b] to-[#060b11] p-5 sm:p-7 shadow-card">
        {/* Efeitos de luz sutis */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-12 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-light mb-3">
            <span>⚽ Betzebi Sportsbook</span>
            <span className="text-slate-500">·</span>
            <span>{mode.label}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            Plataforma desportiva com <span className="brand-wordmark">gestão manual de carteira</span>.
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
            {user ? (
              <>
                Olá, <strong className="text-white">{profile?.username || 'Apostador'}</strong>. Consulta os eventos disponíveis e gere pedidos de carteira sujeitos a validação manual.
              </>
            ) : (
              'Consulta os eventos disponíveis. Os pedidos de carteira são processados manualmente e a disponibilidade pública depende das validações necessárias.'
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {user ? (
              <Link href="/carteira" className="btn-primary">
                🪙 Ver Carteira
              </Link>
            ) : (
              <Link href="/registar" className="btn-primary">
                Criar Conta
              </Link>
            )}
            <Link href="/eventos/propor" className="btn-ghost">
              Propor Evento
            </Link>
          </div>
        </div>

        {/* 3 Cartões de Informação Operacional */}
        <div className="relative z-10 mt-6 grid gap-2.5 grid-cols-1 sm:grid-cols-3 pt-5 border-t border-white/[0.06]">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Modo</div>
            <div className="mt-1 text-xl font-black text-white">{mode.badge}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Processamento sujeito a validação manual</div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Regra de Fecho</div>
            <div className="mt-1 text-xl font-black text-brand-light">Apito Inicial</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Apostas fecham no início do jogo</div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pagamentos</div>
            <div className="mt-1 text-xl font-black text-white">E-Mola</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Confirmação manual pelo operador</div>
          </div>
        </div>
      </section>

      {/* Seletor de Categorias / Abas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {([
            ['tudo', '🔥 Destaques'],
            ['futebol', '⚽ Futebol'],
            ['especiais', '🎯 Previsões'],
          ] as [Tab, string][]).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`tab ${tab === k ? 'tab-on' : 'tab-off'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 'futebol' && availableLeagues.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedLeague('todas')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                selectedLeague === 'todas'
                  ? 'bg-brand/20 text-brand-light ring-1 ring-brand/30'
                  : 'bg-white/[0.03] text-slate-400 hover:text-white'
              }`}
            >
              Todas as Ligas
            </button>
            {availableLeagues.map((lg) => (
              <button
                key={lg}
                onClick={() => setSelectedLeague(lg)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  selectedLeague === lg
                    ? 'bg-brand/20 text-brand-light ring-1 ring-brand/30'
                    : 'bg-white/[0.03] text-slate-400 hover:text-white'
                }`}
              >
                {lg}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="card text-center py-10 text-slate-400 animate-pulse">
          A carregar mercados e cotações da Betzebi…
        </div>
      )}

      {/* Secção de Jogos Ao Vivo (Apenas exibida se houver partidas ao vivo) */}
      {liveMatches.length > 0 && (tab === 'tudo' || tab === 'futebol') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="badge-live">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                Em Direto
              </span>
              <h2 className="text-lg font-black text-white">Partidas Ao Vivo</h2>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{liveMatches.length} jogos</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {liveMatches.map((m) => (
              <MatchCard key={m.id} event={m} />
            ))}
          </div>
        </section>
      )}

      {/* Secção de Próximos Jogos de Futebol */}
      {(tab === 'tudo' || tab === 'futebol') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>⚽</span> Próximos Jogos (Apostas Abertas)
            </h2>
            <span className="text-xs text-slate-400">
              Encerram no pontapé de saída
            </span>
          </div>

          {filteredMatches.length === 0 ? (
            <div className="card text-center py-8 text-slate-400">
              Não existem partidas agendadas nesta categoria no momento.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredMatches.map((m) => (
                <MatchCard key={m.id} event={m} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Secção de Previsões & Eventos Especiais */}
      {(tab === 'tudo' || tab === 'especiais') && specials.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>🎯</span> Previsões & Eventos Especiais
            </h2>
            <Link href="/eventos" className="text-xs font-bold text-brand-light hover:underline">
              Ver Todas ({specials.length}) ›
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(tab === 'tudo' ? specials.slice(0, 4) : specials).map((e) => (
              <SpecialEventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.06] bg-[#09111b] p-4 text-xs text-slate-400">
        <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
          <span>ℹ️</span> Como apostar na Betzebi
        </div>
        <div className="grid gap-2 sm:grid-cols-4 text-slate-300">
          <div className="rounded-xl bg-white/[0.02] p-2.5 border border-white/[0.04]">
            <strong className="text-white block mb-0.5">1. Criação de Conta</strong>
            Cria uma conta com e-mail e palavra-passe.
          </div>
          <div className="rounded-xl bg-white/[0.02] p-2.5 border border-white/[0.04]">
            <strong className="text-white block mb-0.5">2. Aprovação da Conta</strong>
            Aguarda a análise do administrador; a aprovação não confirma automaticamente identidade nem idade.
          </div>
          <div className="rounded-xl bg-white/[0.02] p-2.5 border border-white/[0.04]">
            <strong className="text-white block mb-0.5">3. Montagem do Boletim</strong>
            Escolhe os mercados e firma a aposta somente com o mercado aberto.
          </div>
          <div className="rounded-xl bg-white/[0.02] p-2.5 border border-white/[0.04]">
            <strong className="text-white block mb-0.5">4. Liquidação</strong>
            O operador valida o resultado, confirma os pagamentos e fecha o ciclo de forma auditável.
          </div>
        </div>
      </section>
    </div>
  );
}
