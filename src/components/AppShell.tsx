'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Betslip from './Betslip';
import { useAuth } from './providers/AuthProvider';
import { useBetslip } from './providers/BetslipProvider';
import { coins, odd } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase/client';

const NAV = [
  { href: '/', label: 'Desporto', icon: '⚽' },
  { href: '/eventos', label: 'Previsões', icon: '🎯' },
  { href: '#boletim', label: 'Boletim', icon: '🧾' },
  { href: '/apostas', label: 'Apostas', icon: '🎫' },
  { href: '/carteira', label: 'Carteira', icon: '🪙' },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-lg font-black tracking-tight group">
      <span className="brand-mark">B</span>
      <span className="text-xl font-extrabold tracking-tight text-white">
        Bet<span className="text-brand-light">zebi</span>
      </span>
    </Link>
  );
}

function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const isPrivateTestMode = process.env.NEXT_PUBLIC_PRIVATE_TEST_MODE === 'true' || process.env.NEXT_PUBLIC_PRIVATE_TEST_MODE === '1';
  const links = [
    { href: '/', label: 'Desporto' },
    { href: '/eventos', label: 'Previsões' },
    { href: '/apostas', label: 'Minhas Apostas' },
    { href: '/ranking', label: 'Classificação' },
    { href: '/telao', label: 'Telão' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070d14]/90 backdrop-blur-md">
      {/* Ticker Superior de Responsabilidade e Operação */}
      <div className="border-b border-white/[0.05] bg-[#050a0f] py-1 text-center text-[10px] font-semibold tracking-wider text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="font-bold text-brand-light">BETZEBI SPORTSBOOK</span>
          <span className="text-slate-600">·</span>
          <span>Plataforma de apostas · Pagamentos manuais por e-Mola</span>
          <span className="text-slate-600">·</span>
          <span className="text-amber-400 font-bold">Idade mínima legal · Jogo responsável</span>
          {isPrivateTestMode && (
            <>
              <span className="text-slate-600">·</span>
              <span className="font-black text-red-300">MODO TESTE INTERNO · NÃO PÚBLICO</span>
            </>
          )}
        </span>
      </div>

      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-3 sm:px-4">
        <Logo />

        <nav className="ml-4 hidden gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                path === l.href
                  ? 'bg-brand/15 text-brand-light ring-1 ring-brand/30 shadow-glow-sm'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          ))}

          {isAdmin && (
            <Link
              href="/admin"
              className="ml-2 rounded-xl bg-gold/15 px-3 py-1.5 text-xs font-black text-gold ring-1 ring-gold/30 hover:bg-gold/25"
            >
              ⚙ Painel Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {user ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-lg bg-gold/15 px-2 py-1 text-[11px] font-black text-gold md:hidden"
                >
                  Admin
                </Link>
              )}

              {/* Saldo da Carteira */}
              <Link
                href="/carteira"
                className="balance-chip hover:bg-gold/15 transition-all group"
                title="Abrir Carteira"
              >
                <span>🪙</span>
                <span>{profile ? coins(profile.balance) : '…'}</span>
                <span className="text-[10px] uppercase font-bold text-amber-400/80">MT</span>
              </Link>

              <Link
                href="/carteira"
                className="btn-primary !px-3 !py-1.5 text-xs hidden sm:inline-flex"
              >
                + Depositar
              </Link>

              <button
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="hidden text-xs text-slate-400 hover:text-white sm:block px-2 py-1"
                title="Terminar sessão"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-200 ring-1 ring-white/[0.1] hover:bg-white/[0.05] transition"
              >
                Entrar
              </Link>
              <Link href="/registar" className="btn-primary !px-3.5 !py-1.5 text-xs">
                Criar Conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mx-auto mt-14 max-w-6xl border-t border-white/[0.08] px-4 pb-28 pt-8 text-xs text-slate-400 lg:pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <Logo />
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-red-500/40 bg-red-500/10 px-1 text-[8px] font-black text-red-400">
            IDADE
          </span>
          <span className="font-bold text-slate-300">Jogo Responsável · Apostar pode criar dependência</span>
        </div>
      </div>

      <p className="mb-2 text-slate-400 leading-relaxed max-w-4xl">
        A <strong>Betzebi</strong> disponibiliza uma carteira com pedidos de depósito e levantamento por <strong>e-Mola</strong>, sujeitos a verificação manual pelo operador. A plataforma não confirma transferências junto do provedor.
      </p>
      <p className="mb-3 text-slate-500 leading-relaxed">
        A disponibilidade para utilização pública depende de validação legal, operacional e de conformidade. Acesso apenas para pessoas com a idade mínima legal aplicável. Se o jogo estiver a causar dificuldades, procure serviços locais de saúde e apoio.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-4 text-[11px] text-slate-500">
        <span>© {new Date().getFullYear()} Betzebi Sportsbook · Todos os direitos reservados</span>
        <span>Plataforma Operacional Next.js + Supabase</span>
      </div>
    </footer>
  );
}

function MobileSlipBar() {
  const slip = useBetslip();
  const n = slip.items.length;
  if (n === 0) return null;

  return (
    <button
      onClick={() => slip.setOpen(true)}
      className="fixed inset-x-3 bottom-[68px] z-40 flex items-center justify-between rounded-xl bg-brand px-4 py-3 font-black text-brand-ink shadow-glow lg:hidden active:scale-[0.98] transition-transform"
    >
      <span className="flex items-center gap-2">
        <span>🧾</span>
        <span>Boletim ({n} {n === 1 ? 'seleção' : 'seleções'})</span>
      </span>
      <span className="tabular-nums">
        {slip.mode === 'multipla' ? `Odd ${odd(slip.totalOdds)} ›` : 'Ver bilhete ›'}
      </span>
    </button>
  );
}

function SlipSheet() {
  const slip = useBetslip();
  const path = usePathname();
  useEffect(() => {
    slip.setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (!slip.open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => slip.setOpen(false)} />
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-[#070d14] p-3 pb-6 border-t border-white/[0.1]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
        <Betslip onDone={() => slip.setOpen(false)} />
        <button
          onClick={() => slip.setOpen(false)}
          className="mt-3 w-full py-2.5 text-center text-xs font-bold text-slate-400 hover:text-white"
        >
          Fechar Boletim
        </button>
      </div>
    </div>
  );
}

function BottomNav() {
  const path = usePathname();
  const slip = useBetslip();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/[0.08] bg-[#070d14]/95 backdrop-blur-md lg:hidden">
      {NAV.map((n) => {
        const active = n.href === path;
        const inner = (
          <>
            <span className="relative text-lg leading-none">
              {n.icon}
              {n.href === '#boletim' && slip.items.length > 0 && (
                <span className="absolute -right-2.5 -top-1 rounded-full bg-brand px-1 text-[9px] font-black text-brand-ink">
                  {slip.items.length}
                </span>
              )}
            </span>
            <span className="font-semibold">{n.label}</span>
          </>
        );

        const cls = `flex flex-col items-center gap-1 py-2 text-[10px] transition-colors ${
          active ? 'text-brand-light font-bold' : 'text-slate-400 hover:text-white'
        }`;

        return n.href === '#boletim' ? (
          <button key={n.href} className={cls} onClick={() => slip.setOpen(true)}>
            {inner}
          </button>
        ) : (
          <Link key={n.href} href={n.href} className={cls}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, profile } = useAuth();
  if (path.startsWith('/telao')) return <>{children}</>;
  const hideSlip = path.startsWith('/admin');

  return (
    <>
      <Header />
      {user && profile && profile.role !== 'admin' && profile.account_status !== 'aprovado' && (
        <div className="mx-auto mt-3 max-w-6xl px-3 sm:px-4">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-100">
            A tua conta está <strong>{profile.account_status}</strong>. O administrador precisa aprová-la antes de poderes apostar, enviar propostas ou usar a carteira.
          </div>
        </div>
      )}
      {!isSupabaseConfigured && (
        <div className="mx-auto mt-3 max-w-6xl px-3">
          <div className="rounded-xl border border-gold/40 bg-gold/10 p-3.5 text-xs font-semibold text-gold">
            ⚠️ Supabase não configurado. Define NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ficheiro .env.
          </div>
        </div>
      )}

      <div
        className={`mx-auto max-w-6xl px-3 pt-5 sm:px-4 ${
          hideSlip ? '' : 'lg:grid lg:grid-cols-[1fr_340px] lg:gap-6'
        }`}
      >
        <main className="min-w-0">{children}</main>
        {!hideSlip && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <Betslip />
            </div>
          </aside>
        )}
      </div>

      <Footer />
      {!hideSlip && <MobileSlipBar />}
      <SlipSheet />
      <BottomNav />
    </>
  );
}
