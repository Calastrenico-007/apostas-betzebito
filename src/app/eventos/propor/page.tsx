'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import StatusBadge from '@/components/StatusBadge';
import { getSupabase } from '@/lib/supabase/client';
import { CATEGORIES, dateTime, errMsg, localInputToIso } from '@/lib/format';
import type { SportEvent } from '@/lib/types';

export default function ProporPage() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Previsões Stand');
  const [closes, setCloses] = useState('');
  const [pool, setPool] = useState<'fixa' | 'mutua'>('mutua');
  const [options, setOptions] = useState<string[]>(['Sim', 'Não']);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<SportEvent[]>([]);

  const loadMine = useCallback(async () => {
    if (!user) return;
    const { data } = await getSupabase()
      .from('events')
      .select('*, markets(*, selections(*))')
      .eq('proposed_by', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setMine((data as SportEvent[]) || []);
  }, [user]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (profile?.role !== 'admin' && profile?.account_status !== 'aprovado') {
      return toast('A tua conta aguarda aprovação manual do administrador.', 'erro');
    }
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) return toast('Indica pelo menos 2 opções de desfecho', 'erro');

    setBusy(true);
    const { error } = await getSupabase().rpc('create_special_event', {
      p_title: title.trim(),
      p_description: description.trim() || null,
      p_category: category,
      p_closes_at: localInputToIso(closes),
      p_options: opts,
      p_odds: null,
      p_pool_type: pool,
    });
    setBusy(false);

    if (error) return toast(errMsg(error), 'erro');

    toast('Proposta enviada com sucesso! Ficará pendente até o operador admin aprovar.', 'ok');
    setTitle('');
    setDescription('');
    setOptions(['Sim', 'Não']);
    setCloses('');
    loadMine();
  }

  if (!user) {
    return (
      <div className="card text-center py-12 max-w-md mx-auto space-y-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-2xl mx-auto">
          💡
        </div>
        <h1 className="text-xl font-black text-white">Propor Evento</h1>
        <p className="text-xs text-slate-400">
          Inicia sessão na tua conta para poderes sugerir perguntas ou previsões à organização.
        </p>
        <Link href="/login" className="btn-primary w-full text-xs font-bold">
          Iniciar Sessão
        </Link>
      </div>
    );
  }

  const accountApproved = profile?.role === 'admin' || profile?.account_status === 'aprovado';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/eventos" className="text-xs font-bold text-slate-400 hover:text-white transition">
          ‹ Voltar a Previsões
        </Link>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-white">
          Propor Evento ou Previsão
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Sugere um evento ou mercado. A administração analisa a proposta e só publica informação verificada.
        </p>
      </div>

      {!accountApproved && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs text-amber-100">
          A tua conta aguarda aprovação manual do administrador. Só depois da aprovação poderás enviar propostas.
        </div>
      )}

      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Pergunta / Enunciado *</label>
          <input
            className="input !py-2 text-xs font-bold"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            required
            placeholder="Ex: Quantas pessoas vão visitar o stand até às 16h?"
          />
        </div>

        <div>
          <label className="label">Regras de Decisão / Detalhes (Opcional)</label>
          <textarea
            className="input !py-2 text-xs"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explica como será validado o resultado na realidade..."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Categoria</label>
            <select
              className="input !py-2 text-xs font-bold"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Data/Hora Estimada de Fecho</label>
            <input
              type="datetime-local"
              className="input !py-2 text-xs font-bold"
              value={closes}
              onChange={(e) => setCloses(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Modalidade de Aposta Sugerida</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPool('mutua')}
              className={`rounded-xl p-3 text-left text-xs transition border ${
                pool === 'mutua'
                  ? 'border-brand bg-brand/15 text-white'
                  : 'border-white/[0.06] bg-black/20 text-slate-400 hover:bg-black/30'
              }`}
            >
              <strong className="block text-white mb-0.5">Aposta Mútua</strong>
              <span>O bolo é rateado proporcionalmente entre os vencedores</span>
            </button>

            <button
              type="button"
              onClick={() => setPool('fixa')}
              className={`rounded-xl p-3 text-left text-xs transition border ${
                pool === 'fixa'
                  ? 'border-brand bg-brand/15 text-white'
                  : 'border-white/[0.06] bg-black/20 text-slate-400 hover:bg-black/30'
              }`}
            >
              <strong className="block text-white mb-0.5">Odds Fixas</strong>
              <span>O administrador define as cotações multiplicadoras</span>
            </button>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-white/[0.05]">
          <label className="label">Opções de Desfecho (2 a 10)</label>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input !py-1.5 text-xs font-bold flex-1"
                  value={o}
                  maxLength={60}
                  onChange={(e) =>
                    setOptions(options.map((x, j) => (j === i ? e.target.value : x)))
                  }
                  placeholder={`Opção ${i + 1}`}
                  required
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="btn-ghost !px-3 text-xs text-red-400"
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 10 && (
            <button
              type="button"
              className="text-xs font-bold text-brand-light hover:underline mt-1"
              onClick={() => setOptions([...options, ''])}
            >
              + Adicionar mais uma opção
            </button>
          )}
        </div>

        <button
          type="submit"
          className="btn-primary w-full text-xs font-black mt-2"
          disabled={busy || !accountApproved}
        >
          {busy ? 'A submeter proposta…' : 'Submeter Proposta para Moderação'}
        </button>
      </form>

      {/* Minhas Propostas Submetidas */}
      {mine.length > 0 && (
        <section className="space-y-3 pt-3 border-t border-white/[0.08]">
          <h2 className="text-sm font-black uppercase tracking-wider text-white">
            As Minhas Propostas Submetidas ({mine.length})
          </h2>

          <div className="space-y-2">
            {mine.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl border border-white/[0.06] bg-[#0c1522] flex flex-wrap items-center justify-between gap-3 p-3.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{e.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {e.category} · Enviado em {dateTime(e.created_at)}
                  </div>
                </div>

                <StatusBadge kind="especial" status={e.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
