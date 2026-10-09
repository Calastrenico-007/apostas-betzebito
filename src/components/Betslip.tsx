'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useBetslip } from './providers/BetslipProvider';
import { useAuth } from './providers/AuthProvider';
import { useToast } from './providers/ToastProvider';
import { coins, coinsZeb, odd } from '@/lib/format';

const QUICK_STAKES = [20, 50, 100, 250, 500];

export default function Betslip({ onDone }: { onDone?: () => void }) {
  const slip = useBetslip();
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const n = slip.items.length;
  const stake = Math.round((Number(slip.stake) || 0) * 100) / 100;
  const isMulti = slip.mode === 'multipla';
  const totalStake = isMulti ? stake : stake * n;
  const anyUnavailable = slip.items.some((i) => !i.available);
  const taxPercent = slip.betRules?.tax_percent ?? 0;
  const money = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
  const grossPotential = isMulti
    ? money(stake * slip.totalOdds)
    : slip.items.reduce(
        (total, item) =>
          total + (item.poolType === 'fixa' && item.odds ? money(stake * Number(item.odds)) : 0),
        0,
      );
  const estimatedTax = slip.betRules
    ? isMulti
      ? money(grossPotential * taxPercent / 100)
      : slip.items.reduce(
          (total, item) =>
            total +
            (item.poolType === 'fixa' && item.odds
              ? money(money(stake * Number(item.odds)) * taxPercent / 100)
              : 0),
          0,
        )
    : 0;
  const potential = money(grossPotential - estimatedTax);
  const hasMutual = slip.items.some((i) => i.poolType === 'mutua');
  const userBalance = profile ? Number(profile.balance) : 0;
  const accountApproved = profile?.role === 'admin' || profile?.account_status === 'aprovado';
  const insufficient = user ? totalStake > userBalance : false;
  async function submit() {
    if (!accountApproved) {
      return toast('A tua conta aguarda aprovação manual do administrador.', 'erro');
    }
    if (slip.hasChanges) {
      slip.acceptChanges();
      return;
    }
    setBusy(true);
    const r = await slip.place();
    setBusy(false);
    if (r.ok > 0) {
      toast(r.ok === 1 ? 'Aposta confirmada! Boa sorte 🍀' : `${r.ok} apostas confirmadas com sucesso! 🍀`, 'ok');
    }
    if (r.errors.length) {
      toast(r.errors.join(' · '), 'erro');
    }
    refreshProfile();
    if (r.ok > 0 && r.errors.length === 0) {
      onDone?.();
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c1522] shadow-card">
      {/* Topo do Bilhete */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-[#0a111c]">
        <div className="flex items-center gap-2">
          <span className="text-base text-brand-light">🧾</span>
          <h2 className="text-sm font-extrabold tracking-wide uppercase text-white">Boletim de Apostas</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand/20 px-2.5 py-0.5 text-xs font-black text-brand-light">
            {n}
          </span>
          {n > 0 && (
            <button
              onClick={slip.clear}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {n === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-slate-400">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.03] text-2xl text-slate-500 ring-1 ring-white/[0.06]">
            🧾
          </div>
          <p className="font-semibold text-slate-300">O teu boletim está vazio</p>
          <p className="mt-1 text-xs text-slate-500 max-w-[200px]">
            Clica em qualquer cotação para adicionar uma seleção simples ou múltipla.
          </p>
        </div>
      ) : (
        <>
          {/* Seletor de Modo Simples / Múltipla */}
          <div className="grid grid-cols-2 gap-1.5 p-2 bg-[#09101a] border-b border-white/[0.05]">
            {(['simples', 'multipla'] as const).map((m) => (
              <button
                key={m}
                onClick={() => slip.setMode(m)}
                disabled={m === 'multipla' && n < 2}
                className={`rounded-xl py-2 text-xs font-bold transition-all disabled:opacity-40 ${
                  slip.mode === m
                    ? 'bg-brand text-brand-ink shadow-glow-sm font-black'
                    : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                {m === 'simples' ? `Simples (${n})` : `Múltipla (${n})`}
              </button>
            ))}
          </div>

          {/* Lista de Seleções */}
          <div className="max-h-[38vh] flex-1 space-y-2 overflow-y-auto p-2.5 lg:max-h-[46vh]">
            {slip.items.map((i) => (
              <div
                key={i.selectionId}
                className={`rounded-xl border p-2.5 transition-colors ${
                  i.available
                    ? 'border-white/[0.07] bg-[#0f1a2a]'
                    : 'border-red-500/40 bg-red-500/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-white">{i.label}</div>
                    <div className="truncate text-[11px] text-slate-400">{i.marketName}</div>
                    <div className="truncate text-[10px] text-slate-500">{i.eventTitle}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`font-black tabular-nums text-xs ${
                        i.changed === 'up'
                          ? 'text-brand-light'
                          : i.changed === 'down'
                          ? 'text-red-400'
                          : 'text-brand-light'
                      }`}
                    >
                      {i.changed === 'up' ? '▲ ' : i.changed === 'down' ? '▼ ' : ''}
                      {i.poolType === 'mutua' ? 'Mútua' : odd(i.odds)}
                    </span>
                    <button
                      onClick={() => slip.remove(i.selectionId)}
                      className="text-slate-500 hover:text-white transition-colors"
                      aria-label="Remover seleção"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {!i.available && (
                  <div className="mt-1.5 text-[11px] font-bold text-red-400 flex items-center gap-1">
                    <span>🔒</span> Jogo iniciado ou mercado suspenso
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Secção de Apostas e Controlo Financeiro */}
          <div className="space-y-3 border-t border-white/[0.08] p-3 bg-[#0a111c]">
            {slip.rulesError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                Não foi possível carregar as regras de aposta: {slip.rulesError}
              </div>
            )}
            {slip.betRules && (
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2 text-[10px] text-slate-400">
                Múltiplas com {slip.betRules.multiple_bonus_min_selections}+ seleções:{' '}
                <strong className="text-brand-light">+{slip.betRules.multiple_bonus_percent}% nas odds</strong>
                {' · '}retenção de {slip.betRules.tax_percent}% sobre o valor pago em ganhos ou cash-outs.
              </div>
            )}
            {isMulti && slip.multipleError && (
              <div className="rounded-xl border border-gold/30 bg-gold/10 p-2 text-xs font-semibold text-gold">
                {slip.multipleError}
              </div>
            )}
            {slip.hasChanges && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2 text-xs font-semibold text-sky-300">
                As cotações foram atualizadas. Revê e aceita as alterações antes de validar.
              </div>
            )}

            {/* Valor da Aposta */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <label className="font-semibold uppercase tracking-wider text-slate-400">
                  {isMulti ? 'Valor da aposta' : 'Valor por seleção'} (ZEB)
                </label>
                {user && (
                  <span className="text-slate-400">
                    Saldo: <strong className="text-white">{coins(userBalance)}</strong>
                  </span>
                )}
              </div>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                value={slip.stake || ''}
                onChange={(e) => slip.setStake(Number(e.target.value))}
                className="input text-base font-bold text-white tabular-nums"
                placeholder="Ex: 50"
              />
              <div className="mt-1.5 grid grid-cols-6 gap-1">
                {QUICK_STAKES.map((q) => (
                  <button
                    key={q}
                    onClick={() => slip.setStake(q)}
                    className="rounded-lg bg-white/[0.04] py-1 text-[11px] font-bold text-slate-300 ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white"
                  >
                    +{q}
                  </button>
                ))}
                <button
                  onClick={() => slip.setStake(Math.max(1, Math.floor(userBalance)))}
                  className="rounded-lg bg-gold/15 py-1 text-[11px] font-bold text-gold ring-1 ring-gold/25 hover:bg-gold/25"
                  title="Apostar saldo máximo"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Resumo da Aposta */}
            <div className="space-y-1.5 rounded-xl bg-white/[0.02] p-2.5 border border-white/[0.05] text-xs">
              {isMulti && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Cotação Total:</span>
                  <span className="font-black tabular-nums text-white">
                    {odd(slip.totalOdds)}
                    {slip.bonusApplied && slip.betRules && (
                      <span className="ml-1 text-[10px] text-brand-light">
                        (+{slip.betRules.multiple_bonus_percent}%)
                      </span>
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Total a Apostar:</span>
                <span className="font-bold tabular-nums text-white">{coinsZeb(totalStake)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Retorno bruto estimado:</span>
                <span className="font-bold tabular-nums text-white">
                  {coinsZeb(grossPotential)}
                  {hasMutual && !isMulti ? ' + mútuas' : ''}
                </span>
              </div>
              {estimatedTax > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Retenção estimada:</span>
                  <span className="font-bold tabular-nums text-amber-300">−{coinsZeb(estimatedTax)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-white/[0.05] text-sm">
                <span className="font-bold text-slate-300">Retorno líquido estimado:</span>
                <span className="font-black tabular-nums text-brand-light">
                  {coinsZeb(potential)}
                  {hasMutual && !isMulti ? ' + mútuas' : ''}
                </span>
              </div>
            </div>

            {/* Botão de Ação */}
            {!user ? (
              <Link href="/login" onClick={onDone} className="btn-primary block w-full text-center">
                Iniciar Sessão para Apostar
              </Link>
            ) : !accountApproved ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-center text-xs text-amber-200">
                A conta aguarda aprovação manual do administrador. Ainda não podes apostar.
              </div>
            ) : (
              <button
                onClick={submit}
                disabled={
                  busy ||
                  slip.rulesLoading ||
                  !slip.betRules ||
                  Boolean(slip.rulesError) ||
                  stake < 1 ||
                  (isMulti && !!slip.multipleError) ||
                  (anyUnavailable && !slip.hasChanges) ||
                  insufficient
                }
                className="btn-primary w-full text-sm"
              >
                {busy ? (
                  'A registar bilhete…'
                ) : slip.hasChanges ? (
                  'Aceitar Novas Cotações'
                ) : insufficient ? (
                  'Saldo Insuficiente'
                ) : (
                  `Registar Aposta (${coinsZeb(totalStake)})`
                )}
              </button>
            )}

            <p className="text-center text-[10px] text-slate-500">
              Odds bloqueadas ao submeter · Liquidação após apito final
            </p>
          </div>
        </>
      )}
    </div>
  );
}
