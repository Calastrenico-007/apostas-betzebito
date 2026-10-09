import { statusLabel } from '@/lib/format';
import type { EventKind, EventStatus } from '@/lib/types';

interface Props {
  kind: EventKind;
  status: EventStatus;
  minute?: string | null;
  started?: boolean;
}

export default function StatusBadge({ kind, status, minute, started }: Props) {
  if (status === 'ao_vivo') {
    return (
      <span className="badge-live">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
        Ao Vivo {minute ? `· ${minute}` : ''}
      </span>
    );
  }

  if (started || status === 'fechado') {
    return (
      <span className="badge-closed">
        🔒 {started ? 'Jogo Iniciado' : 'Apostas Fechadas'}
      </span>
    );
  }

  if (status === 'terminado') {
    return <span className="badge-settled">✓ Final</span>;
  }

  if (status === 'cancelado') {
    return <span className="badge-void">Anulado</span>;
  }

  if (status === 'pendente') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
        Pendente
      </span>
    );
  }

  const label = statusLabel(kind, status);
  return <span className="badge-scheduled">{label}</span>;
}
