'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import MarketEditor from '@/components/admin/MarketEditor';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/providers/ToastProvider';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg, isoToLocalInput, localInputToIso } from '@/lib/format';
import { useEvents } from '@/lib/hooks/useEvents';

export default function AdminEvento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { events, loading, reload } = useEvents({ id });
  const e = events[0];

  const [form, setForm] = useState({ title: '', description: '', closes: '' });
  const [winner, setWinner] = useState('');
  const [newOpt, setNewOpt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!e) return;
    setForm({
      title: e.title,
      description: e.description ?? '',
      closes: isoToLocalInput(e.closes_at),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.id]);

  if (loading) {
    return (
      <div className="card text-center py-12 text-slate-400 animate-pulse">
        A carregar evento de previsão…
      </div>
    );
  }

  if (!e) {
    return (
      <div className="card text-center py-12 text-slate-400">
        Evento não encontrado.{' '}
        <Link href="/admin/eventos" className="text-brand-light font-bold hover:underline">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const m = e.markets[0];
  const final = ['terminado', 'cancelado', 'rejeitado'].includes(e.status);
  const sb = () => getSupabase();

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast(errMsg(error), 'erro');
      return false;
    }
    toast(ok, 'ok');
    reload();
    return true;
  }

  const saveInfo = () =>
    run(
      () =>
        sb()
          .from('events')
          .update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            category: 'Previsão Stand',
            closes_at: localInputToIso(form.closes),
          })
          .eq('id', id),
      'Dados do evento atualizados!',
    );

  async function addOption() {
    if (!m || !newOpt.trim()) return;
    const ok = await run(
      () =>
        sb().from('selections').insert({
          market_id: m.id,
          key: `opt${Date.now()}`,
          label: newOpt.trim(),
          sort: m.selections.length + 1,
        }),
      'Opção adicionada com sucesso!',
    );
    if (ok) setNewOpt('');
  }

  async function delOption(selId: string) {
    if (!confirm('Remover esta opção do mercado?')) return;
    await run(() => sb().from('selections').delete().eq('id', selId), 'Opção removida.');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs">
        <Link
          href={e.status === 'pendente' ? '/admin/propostas' : '/admin/eventos'}
          className="font-bold text-slate-400 hover:text-white transition"
        >
          ‹ Voltar a Eventos
        </Link>
        <span className="text-slate-500 font-mono">ID: {e.id.slice(0, 8)}</span>
      </div>

      {/* Cartão de Detalhes do Evento */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div>
            <span className="text-xs text-brand-light font-bold uppercase tracking-wider">
              Mercado de Previsão
            </span>
            <h2 className="text-xl font-black text-white mt-0.5">{e.title}</h2>
          </div>
          <StatusBadge kind="especial" status={e.status} />
        </div>

        {e.proposed_by && (
          <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-gold">
            💡 Evento proposto por um visitante. Revê o enunciado, opções e odds antes de aprovar para o lobby público.
          </div>
        )}

        {!final && (
          <div className="space-y-3">
            <div>
              <label className="label">Enunciado / Pergunta</label>
              <input
                className="input !py-2 text-xs font-bold"
                value={form.title}
                maxLength={140}
                onChange={(ev) => setForm({ ...form, title: ev.target.value })}
              />
            </div>

            <div>
              <label className="label">Regras & Detalhes Adicionais</label>
              <input
                className="input !py-2 text-xs"
                value={form.description}
                onChange={(ev) => setForm({ ...form, description: ev.target.value })}
              />
            </div>

            <div>
              <label className="label">Fecho Automático das Apostas</label>
              <input
                type="datetime-local"
                className="input !py-2 text-xs font-bold"
                value={form.closes}
                onChange={(ev) => setForm({ ...form, closes: ev.target.value })}
              />
            </div>

            <button
              type="button"
              className="btn-ghost w-full text-xs font-bold"
              disabled={busy}
              onClick={saveInfo}
            >
              Guardar Alterações do Evento
            </button>
          </div>
        )}
      </div>

      {/* Editor de Mercados & Odds */}
      {m && <MarketEditor market={m} editLabels={!final} onChanged={reload} />}

      {/* Adicionar Nova Opção */}
      {m && !final && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Opções Registadas ({m.selections.length})
            </h3>
          </div>

          <div className="space-y-1.5">
            {m.selections.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-black/30 border border-white/[0.05] px-3 py-2 text-xs"
              >
                <span className="font-bold text-white">{s.label}</span>
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-white"
                  onClick={() => delOption(s.id)}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              className="input !py-1.5 text-xs font-bold flex-1"
              placeholder="Nome da nova opção…"
              value={newOpt}
              onChange={(ev) => setNewOpt(ev.target.value)}
            />
            <button
              type="button"
              className="btn-primary !py-1.5 text-xs font-black"
              onClick={addOption}
            >
              + Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Controlo de Aprovação de Proposta */}
      {e.status === 'pendente' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="btn-primary text-xs font-black"
            disabled={busy}
            onClick={() => run(() => sb().rpc('approve_event', { p_event: id }), 'Evento aprovado e publicado com sucesso!')}
          >
            ✓ Aprovar & Publicar no Lobby
          </button>
          <button
            type="button"
            className="btn-danger text-xs font-black"
            disabled={busy}
            onClick={() => run(() => sb().rpc('reject_event', { p_event: id }), 'Proposta rejeitada.')}
          >
            ✕ Rejeitar Proposta
          </button>
        </div>
      )}

      {/* Resolução e Fecho do Evento */}
      {(e.status === 'ao_vivo' || e.status === 'agendado' || e.status === 'fechado') && m && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {e.status === 'fechado' ? (
              <button
                type="button"
                className="btn-primary text-xs font-black"
                onClick={() => run(() => sb().from('events').update({ status: 'ao_vivo' }).eq('id', id), 'Apostas reabertas!')}
              >
                ▶ Reabrir Apostas
              </button>
            ) : (
              <button
                type="button"
                className="btn-gold text-xs font-black"
                onClick={() => run(() => sb().from('events').update({ status: 'fechado' }).eq('id', id), 'Apostas encerradas!')}
              >
                🔒 Fechar Apostas Agora
              </button>
            )}

            <button
              type="button"
              className="btn-danger text-xs font-black"
              onClick={() =>
                confirm('Anular este evento e reembolsar todos os apostadores?') &&
                run(() => sb().rpc('void_event', { p_event: id }), 'Evento anulado — moedas reembolsadas.')
              }
            >
              Anular & Reembolsar
            </button>
          </div>

          {/* Selecionar Opção Vencedora e Liquidar */}
          <div className="card space-y-3 border-brand/40 bg-gradient-to-br from-[#0c1822] to-[#070e17]">
            <div className="border-b border-white/[0.08] pb-2">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>🏁</span> Resolução Final: Seleciona o Desfecho Vencedor
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Escolhe a opção que ocorreu na realidade para liquidar o bolo e pagar os vencedores.
              </p>
            </div>

            <div className="space-y-2">
              {m.selections.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl p-3 text-xs font-bold transition border ${
                    winner === s.id
                      ? 'border-brand bg-brand/20 text-brand-light'
                      : 'border-white/[0.06] bg-black/20 text-slate-300 hover:bg-black/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="winner"
                      className="accent-emerald-500"
                      checked={winner === s.id}
                      onChange={() => setWinner(s.id)}
                    />
                    <span>{s.label}</span>
                  </div>
                  <span className="font-black tabular-nums">
                    {s.odds ? `@${s.odds}` : `Bolo: ${s.pool} ZEB`}
                  </span>
                </label>
              ))}
            </div>

            <button
              type="button"
              className="btn-primary w-full text-xs font-black"
              disabled={!winner || busy}
              onClick={() => {
                const label = m.selections.find((s) => s.id === winner)?.label;
                if (
                  confirm(
                    `Confirmar desfecho vencedor: "${label}"?\n\nTodas as apostas serão pagas imediatamente e esta ação é irreversível.`,
                  )
                ) {
                  run(() => sb().rpc('settle_special', { p_event: id, p_winner: winner }), 'Evento liquidado e prémios pagos com sucesso!');
                }
              }}
            >
              {busy ? 'A processar pagamentos…' : '✓ Confirmar Vencedor & Creditar Prémios'}
            </button>
          </div>
        </div>
      )}

      {/* Apagar Evento */}
      {(e.status === 'pendente' || e.status === 'rejeitado') && (
        <button
          type="button"
          className="btn-ghost !text-red-400 text-xs hover:!bg-red-500/10"
          onClick={async () => {
            if (!confirm('Apagar definitivamente este evento?')) return;
            const { error } = await sb().from('events').delete().eq('id', id);
            if (error) return toast(errMsg(error), 'erro');
            router.push('/admin/eventos');
          }}
        >
          Apagar Evento
        </button>
      )}
    </div>
  );
}
