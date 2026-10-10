'use client';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import { getSupabase } from '@/lib/supabase/client';
import { coins, coinsZeb, dateTime, errMsg } from '@/lib/format';
import { useRealtime } from '@/lib/hooks/useRealtime';
import type { Profile, WalletRequest, WalletRequestStatus } from '@/lib/types';

export default function AdminUtilizadores() {
  const toast = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<WalletRequest[]>([]);
  const [q, setQ] = useState('');
  const [adj, setAdj] = useState<Record<string, { amount: string; reason: string }>>({});
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [
      { data: profilesData, error: profilesError },
      { data: reqData, error: reqError },
    ] =
      await Promise.all([
        getSupabase()
          .from('profiles')
          .select('id,email,username,balance,role,account_status,created_at')
          .order('balance', { ascending: false })
          .limit(500),
        getSupabase()
          .from('wallet_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

    if (profilesError) toast(errMsg(profilesError), 'erro');
    if (reqError) toast(errMsg(reqError), 'erro');

    setUsers((profilesData as Profile[]) || []);
    setRequests((reqData as WalletRequest[]) || []);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime(['profiles', 'wallet_requests'], load);

  async function adjust(u: Profile, sign: 1 | -1) {
    const a = adj[u.id] || { amount: '', reason: '' };
    const n = Number(a.amount.replace(',', '.'));
    if (!n || n <= 0) return toast('Indica um valor numérico positivo', 'erro');

    const reason = a.reason.trim() || 'Ajuste manual pelo operador admin';
    const { error } = await getSupabase().rpc('admin_adjust_balance', {
      p_user: u.id,
      p_amount: sign * n,
      p_reason: reason,
    });

    if (error) return toast(errMsg(error), 'erro');
    toast(`Saldo de ${u.username} ${sign > 0 ? '+' : '−'}${coins(n)} ZEB!`, 'ok');
    setAdj({ ...adj, [u.id]: { amount: '', reason: '' } });
    load();
  }

  async function updateRequest(r: WalletRequest, status: WalletRequestStatus) {
    const { data, error } = await getSupabase().rpc('process_wallet_request', {
      p_request: r.id,
      p_status: status,
    });

    if (error) return toast(errMsg(error), 'erro');
    toast(`Pedido de ${r.type} ${status}! Notificação enviada ao apostador.`, 'ok');
    load();
  }

  async function updateAccountStatus(u: Profile, status: Profile['account_status']) {
    const { error } = await getSupabase().rpc('admin_set_account_status', {
      p_user: u.id,
      p_status: status,
    });

    if (error) return toast(errMsg(error), 'erro');
    toast(`Conta de ${u.username}: ${status}.`, 'ok');
    load();
  }

  const pendingRequests = requests.filter((r) => r.status === 'pendente');
  const filteredUsers = users.filter(
    (u) =>
      !q ||
      u.username.toLowerCase().includes(q.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-light">
            Gestão Financeira & Segurança
          </p>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-black text-white">
            Utilizadores & Carteira
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-bold text-slate-300">
            {users.length} Contas Registadas
          </span>
        </div>
      </div>

      <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/80">
        Créditos administrativos não confirmam recebimento de dinheiro. Para depósitos, confirma primeiro a entrada real do valor antes de aprovar o pedido; os ajustes ficam registados no extrato.
      </p>

      {/* SECÇÃO 1: PEDIDOS DE CARTEIRA PENDENTES */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c1522] p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
            <span>📥</span> Pedidos de Carteira Pendentes ({pendingRequests.length})
          </h2>
          <span className="text-[11px] text-slate-400">
            Confirma depósitos recebidos; para levantamentos, paga primeiro e depois conclui
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4 text-center text-xs text-slate-400">
            ✓ Sem pedidos de carteira pendentes de momento.
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {pendingRequests.map((r) => {
              const requester = users.find((u) => u.id === r.user_id);

              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-white text-sm capitalize flex items-center gap-1.5">
                      <span>{r.type === 'deposito' ? '📥' : '📤'}</span>
                      <span>{r.type}</span>
                    </span>
                    <span className="font-black tabular-nums text-brand-light text-base">
                      {coinsZeb(r.amount)}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 space-y-0.5 bg-black/30 p-2 rounded-lg border border-white/[0.04]">
                    <div>
                      Apostador: <strong className="text-white">{requester?.username || 'N/A'}</strong> ({requester?.email})
                    </div>
                    <div>
                      Titular da conta E-Mola: <strong className="text-white">{r.account_holder_name || 'Não informado (pedido anterior)'}</strong>
                    </div>
                    <div>
                      Método: <strong className="text-slate-200">{r.payment_method}</strong> · Ref: <strong className="text-slate-200">{r.reference || 'Sem referência'}</strong>
                    </div>
                    {r.notes && <div className="text-amber-200">{r.notes}</div>}
                    <div className="text-[10px] text-slate-500">{dateTime(r.created_at)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => updateRequest(r, 'aprovado')}
                      className="btn-primary !py-1.5 text-xs font-black"
                    >
                      {r.type === 'deposito' ? '✓ Confirmar recebimento e creditar' : '✓ Confirmar pagamento e concluir'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRequest(r, 'rejeitado')}
                      className="btn-danger !py-1.5 text-xs font-black"
                    >
                      ✕ Rejeitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diretório de apostadores e ajuste manual de saldo */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
          <h2 className="text-sm font-black uppercase tracking-wider text-white">
            Contas, aprovações & gestão de saldo
          </h2>
          <div className="w-full sm:w-72">
            <input
              className="input !py-1.5 text-xs"
              placeholder="Pesquisar por nome ou email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          {filteredUsers.map((u) => {
            const a = adj[u.id] || { amount: '', reason: '' };
            const isOpen = open === u.id;
            return (
              <div
                key={u.id}
                className="rounded-2xl border border-white/[0.08] bg-[#0c1522] p-3.5 shadow-card transition-all"
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                  onClick={() => setOpen(isOpen ? null : u.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-sm truncate">{u.username}</span>
                      {u.role === 'admin' && (
                        <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[9px] font-black text-gold">
                          ADMIN
                        </span>
                      )}
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        u.role === 'admin' || u.account_status === 'aprovado'
                          ? 'bg-brand/15 text-brand-light'
                          : u.account_status === 'rejeitado'
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-amber-500/15 text-amber-200'
                      }`}>
                        {u.role === 'admin' ? 'Acesso admin' : `Conta ${u.account_status}`}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mt-0.5">
                      {u.email} · Registado em {dateTime(u.created_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-black tabular-nums text-white text-base">
                        {coinsZeb(u.balance)}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Saldo
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs font-bold">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Gaveta de Gestão Expandida */}
                {isOpen && (
                  <div className="mt-3.5 space-y-3 border-t border-white/[0.06] pt-3.5">
                    {u.role !== 'admin' && (
                      <div className="rounded-xl bg-white/[0.02] p-3 border border-white/[0.05] space-y-2">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            Aprovação manual da conta
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Aprova apenas depois de verificares os requisitos aplicáveis fora da aplicação. A aprovação não valida automaticamente identidade ou idade.
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            className="btn-primary !py-1.5 text-xs font-bold"
                            disabled={u.account_status === 'aprovado'}
                            onClick={() => updateAccountStatus(u, 'aprovado')}
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            className="btn-danger !py-1.5 text-xs font-bold"
                            disabled={u.account_status === 'rejeitado'}
                            onClick={() => updateAccountStatus(u, 'rejeitado')}
                          >
                            Rejeitar
                          </button>
                          <button
                            type="button"
                            className="btn-ghost !py-1.5 text-xs font-bold"
                            disabled={u.account_status === 'pendente'}
                            onClick={() => updateAccountStatus(u, 'pendente')}
                          >
                            Pendente
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ajuste Manual de Saldo */}
                    <div className="rounded-xl bg-white/[0.02] p-3 border border-white/[0.05] space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Ajuste Manual de Saldo (MT)
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          className="input !py-1.5 text-xs font-bold tabular-nums"
                          inputMode="decimal"
                          placeholder="Valor em MT (Ex: 500)"
                          value={a.amount}
                          onChange={(e) =>
                            setAdj({ ...adj, [u.id]: { ...a, amount: e.target.value } })
                          }
                        />
                        <input
                          className="input !py-1.5 text-xs"
                          placeholder="Motivo (Ex: Ajuste por operador)"
                          value={a.reason}
                          onChange={(e) =>
                            setAdj({ ...adj, [u.id]: { ...a, reason: e.target.value } })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          className="btn-primary !py-1.5 text-xs font-bold"
                          onClick={() => adjust(u, 1)}
                        >
                          + Creditar Saldo ({a.amount || '0'} MT)
                        </button>
                        <button
                          type="button"
                          className="btn-danger !py-1.5 text-xs font-bold"
                          onClick={() => adjust(u, -1)}
                        >
                          − Debitar Saldo ({a.amount || '0'} MT)
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
