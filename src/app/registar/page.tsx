'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';
import { getOperationMode } from '@/lib/operation-mode';
import { useToast } from '@/components/providers/ToastProvider';

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const mode = getOperationMode();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionNotCreated, setSessionNotCreated] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!adult) {
      return toast('Confirma a idade mínima legal aplicável e aceita as condições da plataforma', 'erro');
    }
    if (username.trim().length < 3) {
      return toast('O nome de apostador precisa de conter pelo menos 3 caracteres', 'erro');
    }

    setBusy(true);
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() } },
    });
    setBusy(false);

    if (error) return toast(errMsg(error), 'erro');

    if (!data.session) {
      setSessionNotCreated(true);
      return;
    }

    toast('Conta criada. Aguarda a aprovação manual do administrador antes de usar a carteira ou apostar.', 'ok');
    router.push('/');
    router.refresh();
  }

  if (sessionNotCreated) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="card text-center p-8 space-y-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-3xl mx-auto text-brand-light">
            📧
          </div>
          <h1 className="text-xl font-black text-white">Sessão não iniciada</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            A conta pode ter sido criada, mas o Supabase não iniciou uma sessão. Para usar a aprovação manual em vez de confirmação por e-mail, desativa a confirmação de e-mail nas definições de Authentication do Supabase e depois inicia sessão.
          </p>
          <Link href="/login" className="btn-primary w-full text-xs">
            Ir para Iniciar Sessão
          </Link>
        </div>
      </div>
    );
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
        <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-light">
          <span>{mode.label}</span>
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-[#0c1522] p-6 sm:p-7 shadow-card">
        <div className="mb-5 border-b border-white/[0.06] pb-4">
          <h1 className="text-2xl font-black text-white tracking-tight">Criar Conta</h1>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Cria a conta com e-mail e palavra-passe. O administrador terá de aprová-la antes de poderes apostar ou usar a carteira.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nome de Apostador</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={24}
              required
              placeholder="Ex.: nome_de_apostador"
            />
          </div>

          <div>
            <label className="label">Endereço de Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="o-teu-email@exemplo.com"
            />
          </div>

          <div>
            <label className="label">Palavra-passe (mínimo 6 caracteres)</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded accent-blue-500"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
            />
            <span className="leading-snug">
              Declaro que cumpro a idade mínima legal aplicável. Sei que o cadastro com e-mail e palavra-passe não confirma a minha identidade nem idade.
            </span>
          </label>

          <button
            type="submit"
            className="btn-primary w-full text-sm font-black mt-2"
            disabled={busy}
          >
            {busy ? 'A criar conta…' : 'Registar Conta'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-white/[0.05] text-center text-xs text-slate-400">
          <span>Já possuis conta? </span>
          <Link href="/login" className="font-bold text-brand-light hover:underline">
            Iniciar Sessão
          </Link>
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] text-slate-500">
        A aprovação da conta é manual; não comprova, por si só, identidade nem idade.
      </p>
    </div>
  );
}
