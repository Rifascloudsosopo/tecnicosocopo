import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage } from '@/lib/offlineStorage';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './use-toast';

const db = supabase as any;

// Tables to preload for offline access
const PRELOAD_TABLES = [
  'customers',
  'service_orders',
  'technicians',
  'spare_parts',
  'company_settings',
  'whatsapp_templates',
];

// Tables that need related data
const RELATED_DATA = {
  service_orders: `
    *,
    customers (name, phone, cedula),
    technicians (name),
    spare_parts_usage (id, quantity, unit_price, spare_parts(name)),
    order_additional_costs (id, description, amount)
  `,
};

export function useDataPreloader() {
  const isOnline = useOnlineStatus();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: PRELOAD_TABLES.length });
  const [lastPreload, setLastPreload] = useState<Date | null>(null);
  const { toast } = useToast();

  const preloadData = useCallback(async (showToast = false) => {
    if (!isOnline) return;

    setLoading(true);
    setProgress({ current: 0, total: PRELOAD_TABLES.length });

    try {
      await offlineStorage.init();

      for (let i = 0; i < PRELOAD_TABLES.length; i++) {
        const table = PRELOAD_TABLES[i];
        setProgress({ current: i + 1, total: PRELOAD_TABLES.length });

        try {
          // Use related data query if available
          const selectQuery = RELATED_DATA[table as keyof typeof RELATED_DATA] || '*';
          
          const { data, error } = await db
            .from(table)
            .select(selectQuery)
            .order('created_at', { ascending: false })
            .limit(500); // Limit to prevent huge downloads

          if (error) {
            console.warn(`Error preloading ${table}:`, error);
            continue;
          }

          if (data && data.length > 0) {
            await offlineStorage.clear(table);
            await offlineStorage.putAll(table, data);
          }
        } catch (tableError) {
          console.warn(`Error preloading ${table}:`, tableError);
        }
      }

      setLastPreload(new Date());
      
      if (showToast) {
        toast({
          title: 'Datos sincronizados',
          description: 'Los datos están disponibles para uso offline',
        });
      }
    } catch (error) {
      console.error('Error preloading data:', error);
      if (showToast) {
        toast({
          title: 'Error al sincronizar',
          description: 'No se pudieron descargar todos los datos',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, toast]);

  // Preload on mount when online (silent)
  useEffect(() => {
    if (isOnline) {
      // Small delay to not block initial render
      const timer = setTimeout(() => preloadData(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, preloadData]);

  return {
    loading,
    progress,
    lastPreload,
    preloadData,
  };
}
