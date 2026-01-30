import { cn } from '@/lib/utils';

type Status = 'pending' | 'in_progress' | 'completed' | 'delivered' | 'abandoned';

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'status-pending' },
  in_progress: { label: 'En Proceso', className: 'status-in-progress' },
  completed: { label: 'Completado', className: 'status-completed' },
  delivered: { label: 'Entregado', className: 'status-delivered' },
  abandoned: { label: 'Abandonado', className: 'status-abandoned' },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn('status-badge', config.className, className)}>
      {config.label}
    </span>
  );
}
