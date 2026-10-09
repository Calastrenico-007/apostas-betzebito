'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) return toast(errMsg(error), 'erro');
    toast('Sessão iniciada com sucesso na Betzebi!', 'ok');
    router.push('/');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-10">
      <div className="mb-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2.5">
          <span className="brand-mark">B</span>
          <span className="text-2xl font-black text-white tracking-tight">
            Bet<span className="text-brand-light">zebi</span>
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>🔒 Acesso Seguro · Sportsbook</span>
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-[#0c1522] p-6 sm:p-7 shadow-card">
        <div className="mb-5 border-b border-white/[0.06] pb-4">
          <h1 className="text-2xl font-black text-white tracking-tight">Iniciar Sessão</h1>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Acede à tua carteira, acompanha partidas ao vivo e valida o teu boletim de apostas.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Endereço de Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="o-teu-email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Palavra-passe
              </label>
            </div>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full text-sm font-black mt-2"
            disabled={busy}
          >
            {busy ? 'A autenticar…' : 'Entrar na Conta'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-white/[0.05] text-center text-xs text-slate-400">
          <span>Ainda não tens conta? </span>
          <Link href="/registar" className="font-bold text-brand-light hover:underline">
            Registar conta
          </Link>
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] text-slate-500">
        Acesso com e-mail e palavra-passe · Idade mínima legal aplicável
      </p>
    </div>
  );
}
