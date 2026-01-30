import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: string;
  newStatus: string;
  onConfirm: () => void;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En Proceso',
  completed: 'Completado',
  delivered: 'Entregado',
  abandoned: 'Abandonado',
};

export function StatusChangeDialog({
  open,
  onOpenChange,
  currentStatus,
  newStatus,
  onConfirm,
}: StatusChangeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cambiar estado de la orden?</AlertDialogTitle>
          <AlertDialogDescription>
            Estás a punto de cambiar el estado de la orden de{' '}
            <strong className="text-foreground">{statusLabels[currentStatus] || currentStatus}</strong> a{' '}
            <strong className="text-foreground">{statusLabels[newStatus] || newStatus}</strong>.
            {newStatus === 'delivered' && (
              <span className="block mt-2 text-warning">
                ⚠️ Al marcar como entregado, se iniciará el período de garantía.
              </span>
            )}
            {newStatus === 'abandoned' && (
              <span className="block mt-2 text-destructive">
                ⚠️ Al marcar como abandonado, el equipo pasará a disposición del taller.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Confirmar cambio
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
