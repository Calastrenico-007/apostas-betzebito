'use client';

import { useEffect, useState } from 'react';

type ProviderStatus = {
  mode: string;
  provider: string;
  enabled: boolean;
  ready: boolean;
  missing: string[];
  message: string;
};

type SystemStatus = {
  ok: boolean;
  mode: string;
  paymentProvider: ProviderStatus;
};

export default function AdminStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch('/api/system/status');
        if (!res.ok) throw new Error('status-unavailable');
        const payload = (await res.json()) as SystemStatus;
        if (active) setStatus(payload);
      } catch {
        if (active) setStatus(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const ready = status?.ok ?? false;

  return (
    <div className="space-y-5">
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-brand-light">
              Estado Operacional
            </div>
            <h2 className="mt-1 text-xl font-black text-white">Estado do servidor</h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
              ready
                ? 'bg-brand/15 text-brand-light ring-1 ring-brand/30'
                : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
            }`}
          >
            {ready ? 'online' : 'indisponível'}
          </span>
        </div>

        {loading ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-400">
            A verificar estado do sistema…
          </div>
        ) : status ? (
          <div className="space-y-3 text-sm text-slate-300">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Modo</div>
                <div className="mt-2 text-lg font-black text-white uppercase">{status.mode}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Pagamento</div>
                <div className="mt-2 text-lg font-black text-white">e-Mola manual</div>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 leading-relaxed">
              O servidor respondeu. Depósitos e levantamentos são confirmados manualmente pelo operador; a integração automática do provedor está desativada. Isto não valida o estado da base, pagamentos ou requisitos legais.
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-amber-200">
            O estado operacional não pôde ser carregado. Verifica se a API de status está disponível.
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-white">Checklist de Go-live</h3>
        <div className="grid gap-3 md:grid-cols-2 text-xs text-slate-300">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="font-black text-white">Conta e base de dados</div>
            <p className="mt-1 text-slate-400">Autenticação por e-mail/senha com confirmação de e-mail ativa. Confirma as políticas e migrações no projeto Supabase.</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="font-black text-white">e-Mola manual</div>
            <p className="mt-1 text-slate-400">O cliente informa a referência real; o operador confirma o recebimento na conta antes de creditar. A API automática não está ativa.</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="font-black text-white">Liquidação</div>
            <p className="mt-1 text-slate-400">Resultado oficial e aprovação do operador devem preceder o pagamento de prémios.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
