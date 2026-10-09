'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { getSupabase } from '@/lib/supabase/client';
import { coins, coinsZeb, dateTime, errMsg } from '@/lib/format';
import { getOperationMode } from '@/lib/operation-mode';
import { formatMozambicanPhone, getEmolaConfig, isValidEmolaNumber } from '@/lib/payments/emola';
import { useRealtime } from '@/lib/hooks/useRealtime';
import type { NotificationRow, Transaction, WalletRequest, WalletRequestType } from '@/lib/types';

const TX_TYPE_LABEL: Record<string, string> = {
  deposito: '📥 Depósito Creditado',
  levantamento: '📤 Levantamento Concluído',
  aposta: '🎫 Aposta Registada',
  ganho: '🏆 Prémio de Aposta',
  reembolso: '↩ Reembolso de Aposta',
  cashout: 'Fecho de Aposta',
  ajuste_admin: '⚙ Ajuste Administrativo',
};

const PAYMENT_METHODS = [{ id: 'E-Mola', label: '📱 E-Mola (Movitel)' }];

const EMOLA_CONFIG = getEmolaConfig();

const TRANSFER_TARGET = {
  name: EMOLA_CONFIG.agentName,
  number: isValidEmolaNumber(EMOLA_CONFIG.agentNumber)
    ? formatMozambicanPhone(EMOLA_CONFIG.agentNumber)
    : '',
  label: 'E-Mola',
};

export default function CarteiraPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const mode = getOperationMode();

  const [txs, setTxs] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<WalletRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');

  // Estados dos pedidos de carteira
  const [requestType, setRequestType] = useState<WalletRequestType>('deposito');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestMethod] = useState('E-Mola');
  const [requestAccountHolderName, setRequestAccountHolderName] = useState('');
  const [requestRef, setRequestRef] = useState('');

  const transferTarget = TRANSFER_TARGET;
  const accountApproved = profile?.role === 'admin' || profile?.account_status === 'aprovado';

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: txData }, { data: reqData }, { data: notifData }] = await Promise.all([
      getSupabase()
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      getSupabase()
        .from('wallet_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      getSupabase()
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setTxs((txData as Transaction[]) || []);
    setRequests((reqData as WalletRequest[]) || []);
    const nextNotifs = (notifData as NotificationRow[]) || [];

    // Processamento de notificações não vistas
    const unseen = nextNotifs.filter((n) => !n.seen && n.kind === 'wallet_request_update');
    for (const n of unseen) {
      const status = n.payload?.status;
      const type = n.payload?.type;
      const amount = n.payload?.amount;
      if (status && type) {
        toast(
          `Pedido de ${String(type)} ${String(status)}${
            amount !== undefined ? ` · ${coins(Number(amount))} MT` : ''
          }`,
          status === 'aprovado' ? 'ok' : 'erro',
        );
        await getSupabase().from('notifications').update({ seen: true }).eq('id', n.id);
      }
    }
  }, [toast, user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
    }
  }, [profile]);

  useRealtime(
    ['profiles', 'wallet_requests', 'notifications'],
    load,
    Boolean(user),
    user ? `user_id=eq.${user.id}` : undefined,
  );

  async function submitWalletRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const amount = Number(requestAmount.replace(',', '.'));
    if (!amount || amount <= 0) return toast('Indica um montante válido', 'erro');

    if (requestType === 'levantamento' && profile && amount > Number(profile.balance)) {
      return toast('Saldo insuficiente para este levantamento', 'erro');
    }

    const accountHolderName = requestAccountHolderName.trim();
    if (accountHolderName.length < 2 || accountHolderName.length > 120) {
      return toast('Indica o nome do titular da conta E-Mola (2 a 120 caracteres)', 'erro');
    }

    const reference = requestRef.trim();
    if (!reference) {
      return toast(
        requestType === 'deposito'
          ? 'Indica a referência real da transferência antes de enviar a confirmação'
          : 'Indica o telefone ou os dados necessários para receber o levantamento',
        'erro',
      );
    }

    setBusy(true);
    const { error } = await getSupabase().from('wallet_requests').insert({
      user_id: user.id,
      type: requestType,
      amount,
      payment_method: requestMethod,
      account_holder_name: accountHolderName,
      reference,
      status: 'pendente',
      notes: requestType === 'deposito'
        ? `Depósito manual via ${requestMethod}. Referência indicada pelo utilizador; confirmar o recebimento na conta antes de aprovar.`
        : `Pedido de levantamento via ${requestMethod}. Confirmar os dados de recebimento e o pagamento antes de concluir.`,
    });
    setBusy(false);

    if (error) return toast(errMsg(error), 'erro');
    toast(requestType === 'deposito'
      ? 'Confirmação enviada. O saldo será creditado depois de o operador confirmar o recebimento.'
      : 'Pedido de levantamento enviado. O operador irá processar o pagamento.', 'ok');
    setRequestAmount('');
    setRequestAccountHolderName('');
    setRequestRef('');
    router.push('/');
  }

  async function saveName() {
    if (!user || username.trim().length < 3) return toast('Nome demasiado curto (mínimo 3 caracteres)', 'erro');
    const { error } = await getSupabase()
      .from('profiles')
      .update({ username: username.trim().slice(0, 24) })
      .eq('id', user.id);
    if (error) return toast(errMsg(error), 'erro');
    toast('Nome atualizado com sucesso', 'ok');
    refreshProfile();
  }

  if (!authLoading && !user) {
    return (
      <div className="card text-center py-12 max-w-md mx-auto">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-2xl mx-auto mb-3">
          🪙
        </div>
        <h1 className="text-xl font-black text-white">Carteira Betzebi</h1>
        <p className="mt-1 mb-5 text-sm text-slate-400">
          Inicia sessão com o teu e-mail e palavra-passe para consultar saldo e gerir pedidos de carteira.
        </p>
        <Link href="/login" className="btn-primary w-full">
          Iniciar Sessão
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Carteira */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-light">
            Centro Financeiro & Perfil
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-white">
            Carteira Betzebi · {mode.label}
          </h1>
        </div>
        <button
          onClick={signOut}
          className="text-xs font-bold text-slate-400 hover:text-white transition px-3 py-1.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04]"
        >
          Terminar Sessão
        </button>
      </div>

      {!accountApproved && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100">
          <div className="font-black">Conta {profile?.account_status || 'a carregar'}</div>
          <p className="mt-1 text-xs text-amber-100/80">
            O administrador precisa aprovar a tua conta antes de poderes pedir depósitos ou levantamentos. A aprovação manual não comprova, por si só, identidade ou idade.
          </p>
        </div>
      )}

      {/* Cartão de Saldo Principal */}
      <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
        <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-[#121f31] via-[#0c1624] to-[#070e17] p-6 shadow-card">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-300">
            <span>Saldo Disponível</span>
            <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-black text-gold">
              🪙 {mode.walletLabel}
            </span>
          </div>

          <div className="mt-3 text-4xl sm:text-5xl font-black tabular-nums text-white tracking-tight">
            {profile ? coins(profile.balance) : '…'}{' '}
            <span className="text-xl sm:text-2xl font-bold text-amber-400">{mode.currency}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/40 px-3 py-1.5 border border-white/[0.06]">
              <span>📲</span>
              <span>Carregue via E-Mola e aguarde a confirmação manual do operador</span>
            </span>
          </div>
        </div>

        {/* Resumo do Perfil */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Perfil</h2>
            <span className="text-xs text-slate-400">ID: {profile?.id?.slice(0, 8)}</span>
          </div>

          <div>
            <label className="label">Email de Acesso</label>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-slate-300 font-mono">
              {profile?.email || 'Sem email'}
            </div>
          </div>

          <div>
            <label className="label">Nome de Apostador</label>
            <div className="flex gap-2">
              <input
                className="input !py-1.5 text-xs font-bold"
                value={username}
                maxLength={24}
                onChange={(e) => setUsername(e.target.value)}
              />
              <button className="btn-ghost shrink-0 !py-1.5 text-xs font-bold" onClick={saveName}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Secção de Pedidos de Carteira (Depósitos e Levantamentos) */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>💳</span> Pedidos de Pagamento (Operação de Stand)
            </h2>
            <p className="text-xs text-slate-400">
              Depósitos via E-Mola. Levantamentos processados pelo operador após confirmação.
            </p>
          </div>

          {/* Abas Depósito / Levantamento */}
          <div className="grid grid-cols-2 gap-1 bg-black/30 p-1 rounded-xl border border-white/[0.06]">
            {(['deposito', 'levantamento'] as WalletRequestType[]).map((t) => (
              <button
                key={t}
                onClick={() => setRequestType(t)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                  requestType === t
                    ? 'bg-brand text-brand-ink font-black shadow-glow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'deposito' ? '📥 Depósito' : '📤 Levantamento'}
              </button>
            ))}
          </div>
        </div>

        {accountApproved && requestType === 'deposito' && (
          <div className="rounded-2xl border border-brand/25 bg-brand/10 p-4 text-xs text-slate-200">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-light">
                Transferência Manual
              </div>
              <span className="rounded-full border border-brand/30 bg-brand/15 px-2.5 py-0.5 text-[10px] font-black text-brand-light">
                {transferTarget.label}
              </span>
            </div>

            <div className="space-y-1.5">
              <div>
                <span className="text-slate-400">Nome:</span> <strong className="text-white">{transferTarget.name}</strong>
              </div>
              <div>
                <span className="text-slate-400">Número:</span>{' '}
                <strong className={transferTarget.number ? 'text-white' : 'text-amber-300'}>
                  {transferTarget.number || 'Ainda não configurado'}
                </strong>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-[11px] text-slate-300 leading-relaxed">
              Transfere o valor indicado e só depois envia a confirmação abaixo. O saldo não é creditado automaticamente: o operador verifica a entrada na conta antes de aprovar o pedido.
            </div>
          </div>
        )}

          {accountApproved ? <form onSubmit={submitWalletRequest} className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Montante (MT)</label>
              <input
                className="input !py-2 text-xs font-bold text-white tabular-nums"
                inputMode="decimal"
                placeholder="Ex: 500"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                required
              />
              <div className="mt-1 flex gap-1">
                {[100, 500, 1000].map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setRequestAmount(String(v))}
                    className="text-[10px] font-bold text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded hover:text-white"
                  >
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Método de Pagamento</label>
              <div className="input !py-2 text-xs text-slate-200">{PAYMENT_METHODS[0].label}</div>
            </div>

            <div>
              <label className="label">
                {requestType === 'deposito' ? 'Referência real da transferência' : 'Telefone / dados para receber'}
              </label>
              <input
                className="input !py-2 text-xs"
                placeholder={requestType === 'deposito'
                  ? 'Código real da operação / recibo'
                  : 'Número ou dados da conta de destino'}
                value={requestRef}
                onChange={(e) => setRequestRef(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Nome do titular da conta E-Mola</label>
              <input
                className="input !py-2 text-xs"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={120}
                placeholder="Nome que aparece na conta usada na transação"
                value={requestAccountHolderName}
                onChange={(e) => setRequestAccountHolderName(e.target.value)}
                required
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={busy || !transferTarget.number}
                className="btn-primary w-full text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? 'A enviar…'
                  : requestType === 'deposito'
                    ? 'Já transferi · Enviar referência real'
                    : 'Solicitar levantamento'}
              </button>
              {!transferTarget.number && (
                <p className="sm:col-span-3 text-xs text-amber-300">
                  O número de recebimento e-Mola ainda não está configurado. Não é possível enviar pedidos até definires os dados reais.
                </p>
              )}
            </div>
          </form> : null}

        {/* Lista de Pedidos de Carteira Recentes */}
        {requests.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-white/[0.06]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pedidos de Carteira Submetidos
            </div>
            <div className="space-y-2">
              {requests.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-white capitalize mr-2">{r.type}</span>
                    <span className="text-slate-400">
                      {r.payment_method} · Titular:{' '}
                      <strong className="text-slate-300">{r.account_holder_name || 'Não informado'}</strong>
                      {' '}· Ref: <strong className="text-slate-300">{r.reference || r.id.slice(0, 8)}</strong>
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">{dateTime(r.created_at)}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-black tabular-nums text-white text-sm">
                      {coinsZeb(r.amount)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        r.status === 'aprovado'
                          ? 'bg-brand/20 text-brand-light'
                          : r.status === 'rejeitado'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Extrato de Transações */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span>📜</span> Extrato de Movimentos
          </h2>
          <span className="text-xs text-slate-400 font-semibold">{txs.length} movimentos</span>
        </div>

        {txs.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            Ainda não existem movimentos registados na tua carteira.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {txs.slice(0, 20).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <div className="font-bold text-white">
                    {TX_TYPE_LABEL[t.type] || t.type}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {t.description || dateTime(t.created_at)}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-black tabular-nums text-sm ${
                      t.amount > 0 ? 'text-brand-light' : 'text-slate-300'
                    }`}
                  >
                    {t.amount > 0 ? '+' : ''}
                    {coins(t.amount)} MT
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums">
                    Saldo após: {coins(t.balance_after)} MT
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
