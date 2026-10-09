'use client';
import Link from 'next/link';
import { useState } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/providers/ToastProvider';
import { getSupabase } from '@/lib/supabase/client';
import { coins, dateTime, errMsg, localInputToIso } from '@/lib/format';
import { useEvents } from '@/lib/hooks/useEvents';

interface Opt {
  label: string;
  odds: string;
}

export default function AdminEventos() {
  const toast = useToast();
  const { events, reload } = useEvents({ kind: 'especial' });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [closes, setCloses] = useState('');
  const [pool, setPool] = useState<'fixa' | 'mutua'>('fixa');
  const [opts, setOpts] = useState<Opt[]>([
    { label: 'Sim', odds: '1.80' },
    { label: 'Não', odds: '2.00' },
  ]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'abertos' | 'pendentes' | 'resolvidos' | 'todos'>('abertos');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const clean = opts.filter((o) => o.label.trim());
    if (clean.length < 2) return toast('Adiciona pelo menos 2 opções válidas', 'erro');

    setBusy(true);
    const { error } = await getSupabase().rpc('create_special_event', {
      p_title: title.trim(),
      p_description: description.trim() || null,
      p_category: 'Previsão Stand',
      p_closes_at: localInputToIso(closes),
      p_options: clean.map((o) => o.label.trim()),
      p_odds: pool === 'fixa' ? clean.map((o) => Number(o.odds.replace(',', '.')) || null) : null,
      p_pool_type: pool,
    });
    setBusy(false);

    if (error) return toast(errMsg(error), 'erro');

    toast('Evento de previsão criado e publicado com sucesso!', 'ok');
    setTitle('');
    setDescription('');
    setCloses('');
    reload();
  }

  const list = events.filter((e) => {
    if (filter === 'todos') return true;
    if (filter === 'abertos') return ['ao_vivo', 'agendado', 'fechado'].includes(e.status);
    if (filter === 'pendentes') return e.status === 'pendente';
    return ['terminado', 'cancelado', 'rejeitado'].includes(e.status);
  }).sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  return (
    <div className="space-y-5">
      {/* Formulário de Criação de Previsão Especial */}
      <form onSubmit={create} className="card space-y-4">
        <div className="border-b border-white/[0.08] pb-3">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span>🎯</span> Criar Evento de Previsão Especial
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cria mercados de previsão com regras claras, informação verificável e prazo definido.
          </p>
        </div>

        <div>
          <label className="label">Pergunta / Enunciado do Evento</label>
          <input
            className="input !py-2 text-xs font-bold"
            value={title}
            maxLength={140}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Pergunta objetiva e verificável"
            required
          />
        </div>

        <div>
          <label className="label">Detalhes ou Regras Adicionais (Opcional)</label>
          <input
            className="input !py-2 text-xs"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Válido até ao fecho oficial do stand às 18h."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Fecho das Apostas (Data/Hora)</label>
            <input
              type="datetime-local"
              className="input !py-2 text-xs font-bold"
              value={closes}
              onChange={(e) => setCloses(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Modalidade de Aposta</label>
            <select
              className="input !py-2 text-xs font-bold"
              value={pool}
              onChange={(e) => setPool(e.target.value as 'fixa' | 'mutua')}
            >
              <option value="fixa">Odds Fixas (Cotações pré-definidas)</option>
              <option value="mutua">Apostas Mútuas (Bolo acumulado dividido pelos vencedores)</option>
            </select>
          </div>
        </div>

        {/* Opções e Odds */}
        <div className="space-y-2 pt-2 border-t border-white/[0.05]">
          <div className="flex items-center justify-between">
            <label className="label !mb-0">Opções de Desfecho {pool === 'fixa' && 'e Cotações'}</label>
            <button
              type="button"
              className="text-xs font-bold text-brand-light hover:underline"
              onClick={() => setOpts([...opts, { label: '', odds: '2.00' }])}
            >
              + Adicionar Opção
            </button>
          </div>

          <div className="space-y-2">
            {opts.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input !py-1.5 text-xs font-bold flex-1"
                  value={o.label}
                  placeholder={`Opção ${i + 1}`}
                  onChange={(e) =>
                    setOpts(opts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                  required
                />
                {pool === 'fixa' && (
                  <input
                    className="input !py-1.5 w-24 text-center text-xs font-black tabular-nums text-brand-light"
                    inputMode="decimal"
                    value={o.odds}
                    placeholder="Odd"
                    onChange={(e) =>
                      setOpts(opts.map((x, j) => (j === i ? { ...x, odds: e.target.value } : x)))
                    }
                    required
                  />
                )}
                {opts.length > 2 && (
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1.5 text-xs text-red-400 hover:text-white"
                    onClick={() => setOpts(opts.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full text-xs font-black mt-2"
          disabled={busy}
        >
          {busy ? 'A publicar evento…' : 'Publicar Evento de Previsão'}
        </button>
      </form>

      {/* Lista de Eventos Especiais */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
          <h3 className="text-sm font-black text-white uppercase tracking-wider">
            Eventos Registados ({list.length})
          </h3>

          <div className="flex gap-1.5 bg-black/30 p-1 rounded-xl border border-white/[0.06]">
            {(['abertos', 'pendentes', 'resolvidos', 'todos'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition capitalize ${
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
            const m = e.markets[0];
            const poolSize = m?.selections.reduce((a, s) => a + Number(s.pool || 0), 0) || 0;

            return (
              <Link
                key={e.id}
                href={`/admin/eventos/${e.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 p-3.5 hover:border-brand/40 hover:bg-[#101b2a] transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-sm truncate">{e.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-brand-light font-semibold">
                      {m?.pool_type === 'mutua' ? `Bolo: ${coins(poolSize)} ZEB` : 'Odds Fixas'}
                    </span>
                    <span>·</span>
                    <span>Criado: {dateTime(e.created_at)}</span>
                    {e.closes_at && <span>· Encerra: {dateTime(e.closes_at)}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge kind="especial" status={e.status} />
                  <span className="text-xs font-bold text-slate-400">Gerir ›</span>
                </div>
              </Link>
            );
          })}

          {list.length === 0 && (
            <div className="card text-center py-8 text-xs text-slate-400">
              Nenhum evento especial encontrado nesta categoria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
