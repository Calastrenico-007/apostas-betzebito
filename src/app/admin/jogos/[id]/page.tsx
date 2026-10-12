'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import MarketEditor from '@/components/admin/MarketEditor';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/providers/ToastProvider';
import { getSupabase } from '@/lib/supabase/client';
import { dateTime, errMsg, isoToLocalInput, localInputToIso } from '@/lib/format';
import { useEvents } from '@/lib/hooks/useEvents';
import type { EventStatus } from '@/lib/types';

export default function AdminJogo() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { events, loading, reload } = useEvents({ id });
  const e = events[0];

  const [res, setRes] = useState({ home: '', away: '', htHome: '', htAway: '', totalCards: '' });
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0, minute: '' });
  const [kickoff, setKickoff] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!e) return;
    setKickoff(isoToLocalInput(e.starts_at));
    setLiveScore({
      home: e.home_score ?? 0,
      away: e.away_score ?? 0,
      minute: e.minute ?? '10\'',
    });
    setRes({
      home: e.home_score != null ? String(e.home_score) : '',
      away: e.away_score != null ? String(e.away_score) : '',
      htHome: e.ht_home_score != null ? String(e.ht_home_score) : '',
      htAway: e.ht_away_score != null ? String(e.ht_away_score) : '',
      totalCards: e.total_cards != null ? String(e.total_cards) : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.id]);

  if (loading) {
    return (
      <div className="card text-center py-12 text-slate-400 animate-pulse">
        A carregar consola de jogo…
      </div>
    );
  }

  if (!e) {
    return (
      <div className="card text-center py-12 text-slate-400">
        Jogo não encontrado.{' '}
        <Link href="/admin/jogos" className="text-brand-light font-bold hover:underline">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const settled = e.status === 'terminado' || e.status === 'cancelado';
  const sb = () => getSupabase();

  async function patch(p: Record<string, unknown>, msg?: string) {
    const { error } = await sb().from('events').update(p).eq('id', id);
    if (error) return toast(errMsg(error), 'erro');
    if (msg) toast(msg, 'ok');
    reload();
  }

  async function setStatus(status: EventStatus) {
    await patch({ status }, `Estado atualizado para: ${status}`);
  }

  async function saveLiveControls() {
    await patch(
      {
        home_score: liveScore.home,
        away_score: liveScore.away,
        minute: liveScore.minute.trim() || null,
      },
      'Marcador em direto atualizado com sucesso!',
    );
  }

  async function allMarkets(status: 'aberto' | 'suspenso') {
    const { error } = await sb()
      .from('markets')
      .update({ status })
      .eq('event_id', id)
      .eq('status', status === 'aberto' ? 'suspenso' : 'aberto');
    if (error) return toast(errMsg(error), 'erro');
    toast(
      status === 'suspenso'
        ? '🔒 Todos os mercados suspensos (Apostas bloqueadas)'
        : '▶ Todos os mercados reabertos para apostas',
      'ok',
    );
    reload();
  }

  async function settle() {
    const h = parseInt(res.home, 10);
    const a = parseInt(res.away, 10);
    const htH = res.htHome ? parseInt(res.htHome, 10) : null;
    const htA = res.htAway ? parseInt(res.htAway, 10) : null;
    const totalCards = res.totalCards.trim() ? Number(res.totalCards) : null;

    if (Number.isNaN(h) || Number.isNaN(a)) {
      return toast('Indica o resultado final completo', 'erro');
    }
    if (totalCards !== null && (!Number.isInteger(totalCards) || totalCards < 0)) {
      return toast('O total de cartões deve ser um número inteiro igual ou superior a zero', 'erro');
    }

    if (
      !confirm(
        `Confirmar resultado final ${e.home_team} ${h} - ${a} ${e.away_team}?\n\nTodas as apostas serão calculadas e liquidadas imediatamente. Esta ação é irreversível.`,
      )
    ) {
      return;
    }

    setBusy(true);
    const { error } = await sb().rpc('settle_football', {
      p_event: id,
      p_home: h,
      p_away: a,
      p_ht_home: htH,
      p_ht_away: htA,
      p_total_cards: totalCards,
    });
    setBusy(false);

    if (error) return toast(errMsg(error), 'erro');
    toast('Partida liquidada com sucesso! Todos os prémios foram creditados.', 'ok');
    reload();
  }

  async function voidMatch() {
    if (
      !confirm(
        'Anular a partida definitivamente? As apostas simples serão reembolsadas e nas múltiplas esta seleção contará como odd 1.00.',
      )
    ) {
      return;
    }
    const { error } = await sb().rpc('void_event', { p_event: id });
    if (error) return toast(errMsg(error), 'erro');
    toast('Partida anulada e reembolsos processados.', 'ok');
    reload();
  }

  async function remove() {
    if (!confirm('Apagar a partida do sistema? Só é permitido se ainda não tiver apostas.')) {
      return;
    }
    const { error } = await sb().from('events').delete().eq('id', id);
    if (error) {
      return toast(
        error.message.includes('foreign key')
          ? 'Esta partida já possui apostas associadas. Usa "Anular Partida" para reembolsar os apostadores.'
          : errMsg(error),
        'erro',
      );
    }
    toast('Partida apagada com sucesso.', 'ok');
    router.push('/admin/jogos');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs">
        <Link href="/admin/jogos" className="font-bold text-slate-400 hover:text-white transition">
          ‹ Voltar a Jogos
        </Link>
        <span className="text-slate-500 font-mono">ID: {e.id.slice(0, 8)}</span>
      </div>

      {/* Cartão de Resumo e Estado da Partida */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div>
            <div className="text-xs text-slate-400 font-semibold">
              {e.league} · Pontapé de Saída: {dateTime(e.starts_at)}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {e.home_team} vs {e.away_team}
            </h2>
          </div>
          <StatusBadge kind="futebol" status={e.status} minute={e.minute} />
        </div>

        {/* Controlos de Estado */}
        {!settled && (
          <div className="space-y-3">
            <div>
              <label className="label">Alterar Estado da Partida</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('agendado')}
                  className={`rounded-xl py-2 text-xs font-bold transition border ${
                    e.status === 'agendado'
                      ? 'border-brand bg-brand text-brand-ink font-black'
                      : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  Agendado (Aberto)
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('ao_vivo')}
                  className={`rounded-xl py-2 text-xs font-bold transition border ${
                    e.status === 'ao_vivo'
                      ? 'border-red-500 bg-red-500 text-white font-black'
                      : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  ● Passar Ao Vivo
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('fechado')}
                  className={`rounded-xl py-2 text-xs font-bold transition border ${
                    e.status === 'fechado'
                      ? 'border-amber-500 bg-amber-500 text-black font-black'
                      : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  🔒 Fechar Apostas
                </button>
              </div>
            </div>

            {/* Ajuste de Horário */}
            <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-white/[0.06]">
              <div className="flex-1 min-w-[200px]">
                <label className="label">Ajustar Pontapé de Saída</label>
                <input
                  type="datetime-local"
                  className="input !py-1.5 text-xs font-bold"
                  value={kickoff}
                  onChange={(ev) => setKickoff(ev.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-ghost !py-2 text-xs font-bold"
                onClick={() => {
                  const startsAt = localInputToIso(kickoff);
                  patch(
                    {
                      starts_at: startsAt,
                      status: startsAt && new Date(startsAt).getTime() <= Date.now() ? 'fechado' : 'agendado',
                    },
                    'Horário atualizado com sucesso!',
                  );
                }}
              >
                Guardar Horário
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Operação Ao Vivo: Marcador, Minuto e Controlo de Mercados */}
      {!settled && (
        <div className="card space-y-4 border-brand/20 bg-gradient-to-br from-[#0c1624] to-[#070e17]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>⚡</span> Controlo de Partida Ao Vivo (Marcador & VAR)
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => allMarkets('suspenso')}
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
              >
                🔒 Suspender Todos
              </button>
              <button
                type="button"
                onClick={() => allMarkets('aberto')}
                className="rounded-xl border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand-light hover:bg-brand/20"
              >
                ▶ Reabrir Todos
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-black/30 p-3 border border-white/[0.06] text-center">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Golos — {e.home_team}
              </div>
              <div className="flex items-center justify-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setLiveScore({ ...liveScore, home: Math.max(0, liveScore.home - 1) })}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.08] text-white font-black hover:bg-white/[0.15]"
                >
                  -
                </button>
                <span className="text-2xl font-black tabular-nums text-white min-w-[30px]">
                  {liveScore.home}
                </span>
                <button
                  type="button"
                  onClick={() => setLiveScore({ ...liveScore, home: liveScore.home + 1 })}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-ink font-black hover:bg-brand-light"
                >
                  +
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-black/30 p-3 border border-white/[0.06] text-center">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Golos — {e.away_team}
              </div>
              <div className="flex items-center justify-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setLiveScore({ ...liveScore, away: Math.max(0, liveScore.away - 1) })}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.08] text-white font-black hover:bg-white/[0.15]"
                >
                  -
                </button>
                <span className="text-2xl font-black tabular-nums text-white min-w-[30px]">
                  {liveScore.away}
                </span>
                <button
                  type="button"
                  onClick={() => setLiveScore({ ...liveScore, away: liveScore.away + 1 })}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-ink font-black hover:bg-brand-light"
                >
                  +
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-black/30 p-3 border border-white/[0.06]">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1 text-center">
                Minuto do Jogo
              </label>
              <input
                className="input !py-1 text-center text-sm font-black"
                value={liveScore.minute}
                placeholder="Ex: 35', 45'+2, HT, 88'"
                onChange={(ev) => setLiveScore({ ...liveScore, minute: ev.target.value })}
              />
              <div className="flex justify-center gap-1 mt-1.5">
                {['15\'', '45\'', 'HT', '75\'', '90\''].map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setLiveScore({ ...liveScore, minute: m })}
                    className="text-[10px] font-bold bg-white/[0.06] px-1.5 py-0.5 rounded text-slate-300 hover:text-white"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={saveLiveControls}
            className="btn-primary w-full text-xs font-black"
          >
            Guardar Placar & Minuto Ao Vivo
          </button>
        </div>
      )}

      {/* Editor de Mercados e Cotações */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span>📊</span> Mercados & Cotações da Partida ({e.markets.length})
          </h3>
        </div>

        {e.markets.map((m) => (
          <MarketEditor key={m.id} market={m} onChanged={reload} />
        ))}
      </div>

      {/* Painel de Confirmação de Resultado e Liquidação */}
      {!settled ? (
        <div className="card space-y-4 border-brand/40 bg-gradient-to-br from-[#0c1822] to-[#070e17]">
          <div className="border-b border-white/[0.08] pb-2">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span>🏁</span> Resultado Final & Liquidação de Apostas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ao confirmar o resultado, todas as apostas são avaliadas e os prémios creditados instantaneamente aos vencedores.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="label">Final — {e.home_team}</label>
              <input
                className="input text-center font-black text-base"
                inputMode="numeric"
                value={res.home}
                onChange={(ev) => setRes({ ...res, home: ev.target.value })}
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="label">Final — {e.away_team}</label>
              <input
                className="input text-center font-black text-base"
                inputMode="numeric"
                value={res.away}
                onChange={(ev) => setRes({ ...res, away: ev.target.value })}
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="label">Intervalo — Casa (Opcional)</label>
              <input
                className="input text-center font-bold text-sm"
                inputMode="numeric"
                value={res.htHome}
                onChange={(ev) => setRes({ ...res, htHome: ev.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <label className="label">Intervalo — Fora (Opcional)</label>
              <input
                className="input text-center font-bold text-sm"
                inputMode="numeric"
                value={res.htAway}
                onChange={(ev) => setRes({ ...res, htAway: ev.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <label className="label">Total de cartões (Opcional)</label>
              <input
                className="input text-center font-bold text-sm"
                inputMode="numeric"
                value={res.totalCards}
                onChange={(ev) => setRes({ ...res, totalCards: ev.target.value })}
                placeholder="Ex.: 5"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Se não for indicado, as apostas de cartões serão anuladas e reembolsadas.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary w-full text-sm font-black"
            disabled={busy}
            onClick={settle}
          >
            {busy ? 'A processar liquidação…' : '✓ Confirmar Resultado Final & Liquidar Apostas'}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-200">
          <div className="font-bold text-sm mb-1 text-white">✓ Partida já liquidada</div>
          Resultado oficial: {e.home_team} {e.home_score} - {e.away_score} {e.away_team}. Todos os pagamentos foram concluídos.
        </div>
      )}

      {/* Ações Destrutivas / Cancelamento */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3 text-xs">
        {!settled && (
          <button
            type="button"
            className="btn-danger text-xs font-bold"
            onClick={voidMatch}
          >
            Anular Partida (Reembolsar Apostadores)
          </button>
        )}
        <button
          type="button"
          className="btn-ghost !text-red-400 hover:!bg-red-500/10 text-xs ml-auto"
          onClick={remove}
        >
          Apagar Partida
        </button>
      </div>
    </div>
  );
}
