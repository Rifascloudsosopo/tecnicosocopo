import { Wifi, WifiOff, RefreshCw, CloudOff, Cloud, CheckCircle } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useDataPreloader } from '@/hooks/useDataPreloader';
import { Button } from './button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

export function OnlineStatusBadge() {
  const { isOnline, syncing, pendingChanges, syncToServer } = useOfflineSync();
  const { loading: preloading, progress, preloadData } = useDataPreloader();

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Pending changes button */}
        {pendingChanges > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
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
                    <span className="hidden sm:inline">{pendingChanges}</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{pendingChanges} cambio(s) pendiente(s) de sincronizar</p>
              {!isOnline && <p className="text-xs text-muted-foreground">Conecta a internet para sincronizar</p>}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Sync success indicator (when online and no pending) */}
        {isOnline && pendingChanges === 0 && !syncing && !preloading && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => preloadData(true)}
                className="h-8 px-2 text-xs text-success hover:text-success"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Todo sincronizado. Click para actualizar datos offline</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Preloading indicator */}
        {preloading && (
          <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">
              {progress.current}/{progress.total}
            </span>
          </div>
        )}

        {/* Online/Offline status */}
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
    </TooltipProvider>
  );
}
