import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage } from '@/lib/offlineStorage';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type TableNames = keyof Database['public']['Tables'];

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const { toast } = useToast();

  // Count pending changes
  const updatePendingCount = useCallback(async () => {
    try {
      const queue = await offlineStorage.getSyncQueue();
      setPendingChanges(queue.length);
    } catch (error) {
      console.error('Error counting pending changes:', error);
    }
  }, []);

  // Sync pending changes to Supabase
  const syncToServer = useCallback(async () => {
    if (!isOnline || syncing) return;

    setSyncing(true);
    try {
      const queue = await offlineStorage.getSyncQueue();
      
      if (queue.length === 0) {
        setSyncing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const item of queue) {
        try {
          const tableName = item.table as TableNames;
          
          if (item.action === 'insert') {
            const { error } = await supabase
              .from(tableName)
              .insert(item.data);
            if (error) throw error;
          } else if (item.action === 'update') {
            const { id, ...updateData } = item.data;
            const { error } = await supabase
              .from(tableName)
              .update(updateData)
              .eq('id', id);
            if (error) throw error;
          } else if (item.action === 'delete') {
            const { error } = await supabase
              .from(tableName)
              .delete()
              .eq('id', item.data.id);
            // Ignore "not found" errors for deletes
            if (error && !error.message.includes('not found')) throw error;
          }

          await offlineStorage.removeSyncQueueItem(item.id);
          successCount++;
        } catch (error) {
          console.error(`Error syncing item ${item.id}:`, error);
          errorCount++;
        }
      }

      await updatePendingCount();

      if (successCount > 0) {
        toast({
          title: 'Sincronización completada',
          description: `${successCount} cambio(s) sincronizado(s)${errorCount > 0 ? `, ${errorCount} error(es)` : ''}`,
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  }, [isOnline, syncing, toast, updatePendingCount]);

  // Fetch data from server and cache locally
  const fetchAndCache = useCallback(async <T>(table: string): Promise<T[]> => {
    if (!isOnline) {
      // Return cached data when offline
      return offlineStorage.getAll<T>(table);
    }

    try {
      const tableName = table as TableNames;
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cache data locally
      const typedData = (data || []) as unknown as (T & { id: string })[];
      if (typedData.length > 0) {
        await offlineStorage.clear(table);
        await offlineStorage.putAll(table, typedData);
      }

      return typedData as T[];
    } catch (error) {
      console.error(`Error fetching ${table}:`, error);
      // Fallback to cached data
      return offlineStorage.getAll<T>(table);
    }
  }, [isOnline]);

  // Insert with offline support
  const insertWithSync = useCallback(async <T extends { id?: string }>(
    table: string,
    data: T
  ): Promise<T> => {
    const id = data.id || crypto.randomUUID();
    const itemWithId = { ...data, id, created_at: new Date().toISOString() } as T & { id: string };

    // Always save locally first
    await offlineStorage.put(table, itemWithId);

    if (isOnline) {
      try {
        const tableName = table as TableNames;
        const { data: serverData, error } = await supabase
          .from(tableName)
          .insert(itemWithId as any)
          .select()
          .single();

        if (error) throw error;
        
        // Update local with server response
        const typedServerData = serverData as unknown as T & { id: string };
        await offlineStorage.put(table, typedServerData);
        return typedServerData as T;
      } catch (error) {
        console.error(`Error inserting to ${table}:`, error);
        // Add to sync queue
        await offlineStorage.addToSyncQueue({
          table,
          action: 'insert',
          data: itemWithId,
        });
        await updatePendingCount();
        return itemWithId as T;
      }
    } else {
      // Queue for sync
      await offlineStorage.addToSyncQueue({
        table,
        action: 'insert',
        data: itemWithId,
      });
      await updatePendingCount();
      return itemWithId as T;
    }
  }, [isOnline, updatePendingCount]);

  // Update with offline support
  const updateWithSync = useCallback(async <T extends { id: string }>(
    table: string,
    data: T
  ): Promise<T> => {
    const updatedData = { ...data, updated_at: new Date().toISOString() };

    // Update locally first
    await offlineStorage.put(table, updatedData as any);

    if (isOnline) {
      try {
        const tableName = table as TableNames;
        const { id, ...updateFields } = updatedData;
        const { data: serverData, error } = await supabase
          .from(tableName)
          .update(updateFields as any)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        
        const typedServerData = serverData as unknown as T & { id: string };
        await offlineStorage.put(table, typedServerData);
        return typedServerData as T;
      } catch (error) {
        console.error(`Error updating ${table}:`, error);
        await offlineStorage.addToSyncQueue({
          table,
          action: 'update',
          data: updatedData,
        });
        await updatePendingCount();
        return updatedData as T;
      }
    } else {
      await offlineStorage.addToSyncQueue({
        table,
        action: 'update',
        data: updatedData,
      });
      await updatePendingCount();
      return updatedData as T;
    }
  }, [isOnline, updatePendingCount]);

  // Delete with offline support
  const deleteWithSync = useCallback(async (
    table: string,
    id: string
  ): Promise<void> => {
    // Delete locally first
    await offlineStorage.delete(table, id);

    if (isOnline) {
      try {
        const tableName = table as TableNames;
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', id);

        if (error && !error.message.includes('not found')) throw error;
      } catch (error) {
        console.error(`Error deleting from ${table}:`, error);
        await offlineStorage.addToSyncQueue({
          table,
          action: 'delete',
          data: { id },
        });
        await updatePendingCount();
      }
    } else {
      await offlineStorage.addToSyncQueue({
        table,
        action: 'delete',
        data: { id },
      });
      await updatePendingCount();
    }
  }, [isOnline, updatePendingCount]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) {
      syncToServer();
    }
    updatePendingCount();
  }, [isOnline, syncToServer, updatePendingCount]);

  return {
    isOnline,
    syncing,
    pendingChanges,
    fetchAndCache,
    insertWithSync,
    updateWithSync,
    deleteWithSync,
    syncToServer,
  };
}
