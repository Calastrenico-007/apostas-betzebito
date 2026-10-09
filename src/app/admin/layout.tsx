'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

const LINKS = [
  { href: '/admin', label: '📊 Visão Geral' },
  { href: '/admin/status', label: '🛡️ Estado Operacional' },
  { href: '/admin/jogos', label: '⚽ Jogos & Operação' },
  { href: '/admin/configuracoes', label: '⚙️ Taxas & Bónus' },
  { href: '/admin/utilizadores', label: '👥 Utilizadores & Carteira' },
  { href: '/admin/eventos', label: '🎯 Previsões Especiais' },
  { href: '/admin/propostas', label: '💡 Propostas de Visitantes' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, isAdmin } = useAuth();
  const path = usePathname();

  if (loading) {
    return (
      <div className="card animate-pulse text-center py-12 text-slate-400">
        A verificar permissões administrativas…
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="card text-center py-12 max-w-lg mx-auto">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-3xl mx-auto mb-3 text-gold">
          🔒
        </div>
        <h1 className="text-xl font-black text-white">Área Reservada ao Operador Admin</h1>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          {user
            ? 'A tua conta não possui privilégios de administrador. Pede ao responsável para executar no SQL Editor do Supabase:'
            : 'Inicia sessão com uma conta com perfil de administrador para acederes a este painel.'}
        </p>
        {user && (
          <code className="mt-3 block break-all rounded-xl bg-black/40 p-3 text-left text-xs text-brand-light font-mono border border-white/[0.08]">
            update public.profiles set role = &apos;admin&apos; where email = &apos;{user.email}&apos;;
          </code>
        )}
        {!user && (
          <Link href="/login" className="btn-primary mt-4 text-xs font-bold">
            Entrar com Conta Admin
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra de Título do Admin */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="brand-mark !h-8 !w-8 !text-sm">B</span>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              Painel de Controlo Operacional{' '}
              <span className="text-xs font-bold text-brand-light">· Betzebi</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Modo Operacional Local · Fecho de Jogos no Pontapé de Saída · Liquidação Manual Auditada
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/telao" target="_blank" className="btn-ghost text-xs">
            Abrir Telão do Stand ↗
          </Link>
        </div>
      </div>

      {/* Navegação do Admin */}
      <nav className="-mx-2 flex gap-1.5 overflow-x-auto px-2 pb-1">
        {LINKS.map((l) => {
          const active = l.href === '/admin' ? path === '/admin' : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition whitespace-nowrap ${
                active
                  ? 'bg-brand text-brand-ink font-black shadow-glow-sm'
                  : 'bg-white/[0.03] text-slate-300 ring-1 ring-white/[0.06] hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
