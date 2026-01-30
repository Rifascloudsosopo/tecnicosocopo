import { forwardRef } from 'react';
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
  status?: Status | null;
  className?: string;
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, className }, ref) => {
    if (!status) return null;
    
    const config = statusConfig[status];
    if (!config) return null;
    
    return (
      <span ref={ref} className={cn('status-badge', config.className, className)}>
        {config.label}
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';
