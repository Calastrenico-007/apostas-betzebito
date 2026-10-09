'use client';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { coins, errMsg, mutualMultiplier, odd } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import type { Market } from '@/lib/types';

/** Editor de um mercado: odds por seleção, suspender/reabrir, (opcional) editar nomes das opções. */
export default function MarketEditor({ market, editLabels, onChanged }: { market: Market; editLabels?: boolean; onChanged?: () => void }) {
  const toast = useToast();
  const [odds, setOdds] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const settled = market.status === 'resolvido' || market.status === 'anulado';
  const mutual = market.pool_type === 'mutua';
  const dirty = Object.keys(odds).length > 0 || Object.keys(labels).length > 0;
  const pool = market.selections.reduce((a, s) => a + Number(s.pool || 0), 0);

  async function save() {
    const sb = getSupabase();
    setBusy(true);
    const ids = Array.from(new Set([...Object.keys(odds), ...Object.keys(labels)]));
    const results = await Promise.all(
      ids.map((id) => {
        const patch: Record<string, unknown> = {};
        if (id in odds) {
          const v = odds[id].replace(',', '.').trim();
          patch.odds = v === '' ? null : Number(v);
          if (patch.odds !== null && (!Number.isFinite(patch.odds as number) || (patch.odds as number) < 1.01)) {
            return Promise.resolve({ error: { message: `Odd inválida: ${odds[id]} (mínimo 1.01)` } });
          }
        }
        if (id in labels) patch.label = labels[id].trim();
        return sb.from('selections').update(patch).eq('id', id);
      }),
    );
    setBusy(false);
    const err = results.find((r) => r.error);
    if (err?.error) return toast(errMsg(err.error), 'erro');
    setOdds({});
    setLabels({});
    toast('Alterações guardadas — já estão ao vivo', 'ok');
    onChanged?.();
  }

  async function setStatus(status: 'aberto' | 'suspenso') {
    const { error } = await getSupabase().from('markets').update({ status }).eq('id', market.id);
    if (error) return toast(errMsg(error), 'erro');
    onChanged?.();
  }

  async function setPoolType(pool_type: 'fixa' | 'mutua') {
    const { error } = await getSupabase().from('markets').update({ pool_type }).eq('id', market.id);
    if (error) return toast(errMsg(error), 'erro');
    onChanged?.();
  }

  return (
    <div className={`card !p-3 ${market.status === 'suspenso' ? '!border-gold/60' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">{market.name}</h3>
          <div className="text-xs text-muted">
            {mutual ? `Apostas mútuas · bolo ${coins(pool)} · comissão ${Math.round(Number(market.commission) * 100)}%` : 'Odds fixas'} ·{' '}
            <span className={market.status === 'aberto' ? 'text-brand-light' : market.status === 'suspenso' ? 'text-gold' : 'text-sky-300'}>{market.status}</span>
          </div>
        </div>
        {!settled && (
          <div className="flex gap-2">
            {editLabels && pool === 0 && (
              <button className="btn-ghost text-xs" onClick={() => setPoolType(mutual ? 'fixa' : 'mutua')}>
                Mudar p/ {mutual ? 'odds fixas' : 'mútuas'}
              </button>
            )}
            {market.status === 'aberto' ? (
              <button className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-black" onClick={() => setStatus('suspenso')}>
                🔒 Suspender
              </button>
            ) : (
              <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-ink" onClick={() => setStatus('aberto')}>
                ▶ Reabrir
              </button>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {market.selections.map((s) => (
          <div key={s.id} className={`rounded-lg bg-panel2 p-2 ${s.result === 'ganha' ? 'ring-2 ring-brand' : ''}`}>
            {editLabels && !settled ? (
              <input
                className="input mb-1 !py-1.5 text-sm"
                value={labels[s.id] ?? s.label}
                onChange={(e) => setLabels({ ...labels, [s.id]: e.target.value })}
              />
            ) : (
              <div className="mb-1 truncate text-xs text-muted">
                {s.label} {s.result !== 'pendente' && <strong className="text-white">· {s.result}</strong>}
              </div>
            )}
            {mutual ? (
              <div className="text-sm">
                Bolo <strong>{coins(s.pool)}</strong> · paga {(() => { const m = mutualMultiplier(market, s); return m ? `x${odd(m)}` : '—'; })()}
              </div>
            ) : (
              <input
                type="text"
                inputMode="decimal"
                disabled={settled}
                className={`input !py-1.5 text-center font-bold ${s.id in odds ? '!border-gold' : ''}`}
                value={odds[s.id] ?? (s.odds == null ? '' : String(s.odds))}
                placeholder="odd"
                onChange={(e) => setOdds({ ...odds, [s.id]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
      {dirty && (
        <div className="mt-2 flex gap-2">
          <button className="btn-primary flex-1 !py-2 text-sm" disabled={busy} onClick={save}>
            {busy ? 'A guardar…' : 'Guardar alterações'}
          </button>
          <button className="btn-ghost" onClick={() => { setOdds({}); setLabels({}); }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
