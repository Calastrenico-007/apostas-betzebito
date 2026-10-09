import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { BetslipProvider } from '@/components/providers/BetslipProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';

export const metadata: Metadata = {
  title: 'Betzebi Sportsbook — Operação Manual',
  description:
    'Plataforma desportiva com pedidos de carteira e-Mola sujeitos a verificação manual. A disponibilidade pública depende das validações legais e operacionais aplicáveis.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#070d14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen bg-[#070d14] text-slate-100 antialiased font-sans">
        <ToastProvider>
          <AuthProvider>
            <BetslipProvider>
              <AppShell>{children}</AppShell>
            </BetslipProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
