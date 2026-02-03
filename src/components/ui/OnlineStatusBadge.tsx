import { Wifi, WifiOff, RefreshCw, CloudOff, Cloud } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from './button';
import { cn } from '@/lib/utils';

export function OnlineStatusBadge() {
  const { isOnline, syncing, pendingChanges, syncToServer } = useOfflineSync();

  return (
    <div className="flex items-center gap-2">
      {pendingChanges > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={syncToServer}
          disabled={!isOnline || syncing}
          className="h-8 px-2 text-xs"
        >
          {syncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CloudOff className="w-4 h-4 mr-1 text-warning" />
              <span className="hidden sm:inline">{pendingChanges} pendiente(s)</span>
            </>
          )}
        </Button>
      )}
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
          isOnline
            ? 'bg-success/10 text-success'
            : 'bg-destructive/10 text-destructive'
        )}
      >
        {isOnline ? (
          <>
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Conectado</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sin conexión</span>
          </>
        )}
      </div>
    </div>
  );
}
