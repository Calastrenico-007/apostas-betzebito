'use client';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';
import { parseBetRules } from '@/lib/betRules';

export default function AdminConfiguracoesPage() {
  const toast = useToast();
  const [taxPercent, setTaxPercent] = useState('');
  const [bonusMinSelections, setBonusMinSelections] = useState('5');
  const [bonusPercent, setBonusPercent] = useState('4');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getSupabase().rpc('get_bet_rules');
    setLoading(false);
    if (error) {
      toast(errMsg(error), 'erro');
      return;
    }

    const rules = parseBetRules(data);
    if (!rules) {
      toast('As regras de taxa e bónus recebidas são inválidas.', 'erro');
      return;
    }

    setTaxPercent(String(rules.tax_percent));
    setBonusMinSelections(String(rules.multiple_bonus_min_selections));
    setBonusPercent(String(rules.multiple_bonus_percent));
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const tax = Number(taxPercent.replace(',', '.'));
    const minimum = Number(bonusMinSelections);
    const bonus = Number(bonusPercent.replace(',', '.'));

    if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
      return toast('A taxa deve estar entre 0 e 100%.', 'erro');
    }
    if (!Number.isInteger(minimum) || minimum < 2 || minimum > 15) {
      return toast('O mínimo de seleções deve estar entre 2 e 15.', 'erro');
    }
    if (!Number.isFinite(bonus) || bonus < 0 || bonus > 100) {
      return toast('O bónus deve estar entre 0 e 100%.', 'erro');
    }

    setBusy(true);
    const { error } = await getSupabase().rpc('admin_set_bet_rules', {
      p_tax_percent: tax,
      p_multiple_bonus_min_selections: minimum,
      p_multiple_bonus_percent: bonus,
    });
    setBusy(false);
    if (error) return toast(errMsg(error), 'erro');

    toast('Taxa e bónus atualizados. As novas regras aplicam-se às próximas apostas.', 'ok');
    await load();
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-light">
          Regras comerciais
        </p>
        <h2 className="mt-1 text-2xl font-black text-white">Taxas & Bónus</h2>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">
          Define a retenção aplicada ao retorno total e o incentivo para múltiplas. Os valores ficam
          guardados em cada aposta no momento do registo; alterações futuras não mudam bilhetes já feitos.
        </p>
      </header>

      <form onSubmit={save} className="card max-w-2xl space-y-5">
        <section className="space-y-2">
          <label className="label" htmlFor="tax-percent">
            Taxa retida em caso de ganho ou cash-out (%)
          </label>
          <input
            id="tax-percent"
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            value={taxPercent}
            onChange={(event) => setTaxPercent(event.target.value)}
            required
          />
          <p className="text-[11px] leading-relaxed text-slate-400">
            Calculada sobre o retorno bruto total — inclui o valor apostado e qualquer bónus. Exemplo:
            Calculada sobre o valor bruto pago, incluindo aposta e bónus em ganhos e cash-outs. Exemplo:
            num retorno bruto de 1.000 MT, a conta recebe 1.000 MT menos a taxa configurada. 0% não retém
            nada. Confirma a taxa aplicável com um profissional local antes de a usar.
          </p>
        </section>

        <section className="space-y-2 border-t border-white/[0.06] pt-4">
          <h3 className="text-sm font-black text-white">Bónus de odds em múltiplas</h3>
          <p className="text-[11px] text-slate-400">
            A percentagem aumenta a odd total da múltipla; não é um crédito separado.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="bonus-min-selections">A partir de quantas seleções</label>
              <input
                id="bonus-min-selections"
                className="input"
                type="number"
                min="2"
                max="15"
                step="1"
                value={bonusMinSelections}
                onChange={(event) => setBonusMinSelections(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="bonus-percent">Aumento das odds (%)</label>
              <input
                id="bonus-percent"
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.01"
                value={bonusPercent}
                onChange={(event) => setBonusPercent(event.target.value)}
                required
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Com a configuração atual, múltiplas com {bonusMinSelections || '…'} ou mais seleções recebem
            +{bonusPercent || '…'}% na odd total.
          </p>
        </section>

        <button type="submit" className="btn-primary w-full text-sm font-black" disabled={busy || loading}>
          {busy ? 'A guardar…' : loading ? 'A carregar regras…' : 'Guardar taxa e bónus'}
        </button>
      </form>
    </div>
  );
}
