import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage } from '@/lib/offlineStorage';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from '@/hooks/use-toast';

// Helper to bypass TypeScript's strict table checking
const db = supabase as any;

// Some tables don't have created_at / updated_at columns.
// If we always send these fields, Supabase inserts will fail (and the change is only queued).
// This set keeps inserts/updates compatible across tables.
const TABLES_WITH_CREATED_AT = new Set([
  'activity_logs',
  'customers',
  'inventory_categories',
  'order_additional_costs',
  'order_payments',
  'profiles',
  'service_orders',
  'spare_parts',
  'spare_parts_usage',
  'technicians',
  'technician_permissions',
  'whatsapp_templates',
]);

const TABLES_WITH_UPDATED_AT = new Set([
  'company_settings',
  'customers',
  'profiles',
  'service_orders',
  'spare_parts',
  'technician_permissions',
]);

interface ConflictResult {
  resolved: number;
  discarded: number;
}

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

  // Compare timestamps for conflict resolution
  const resolveConflict = useCallback(async (
    table: string,
    localData: any,
    localUpdatedAt: string
  ): Promise<'local' | 'server' | 'no-conflict'> => {
    try {
      // Tables without updated_at can't be compared reliably; default to local.
      if (!TABLES_WITH_UPDATED_AT.has(table)) return 'local';

      const { data: serverData, error } = await db
        .from(table)
        .select('updated_at')
        .eq('id', localData.id)
        .maybeSingle();

      if (error || !serverData) {
        // Record doesn't exist on server, local wins
        return 'local';
      }

      const serverUpdatedAt = new Date(serverData.updated_at).getTime();
      const localUpdatedAtTime = new Date(localUpdatedAt).getTime();

      // Most recent wins
      return localUpdatedAtTime > serverUpdatedAt ? 'local' : 'server';
    } catch {
      return 'local'; // Default to local on error
    }
  }, []);

  // Sync pending changes to Supabase with conflict resolution
  const syncToServer = useCallback(async (): Promise<ConflictResult> => {
    if (!isOnline || syncing) return { resolved: 0, discarded: 0 };

    setSyncing(true);
    const result: ConflictResult = { resolved: 0, discarded: 0 };

    try {
      const queue = await offlineStorage.getSyncQueue();
      
      if (queue.length === 0) {
        setSyncing(false);
        return result;
      }

      for (const item of queue) {
        try {
          const tableName = item.table;
          
          if (item.action === 'insert') {
            // Check if record already exists (from another device)
            const { data: existing } = await db
              .from(tableName)
              .select('id')
              .eq('id', item.data.id)
              .maybeSingle();

            if (existing) {
              // Record exists, check conflict
              const winner = await resolveConflict(tableName, item.data, item.updated_at);
              if (winner === 'server') {
                // Server wins, discard local insert
                await offlineStorage.removeSyncQueueItem(item.id);
                result.discarded++;
                continue;
              }
              // Local wins, update instead of insert
              const { id, ...updateData } = item.data;
              await db.from(tableName).update(updateData).eq('id', id);
            } else {
              // No conflict, insert normally
              const { error } = await db.from(tableName).insert(item.data);
              if (error) throw error;
            }
            result.resolved++;
          } else if (item.action === 'update') {
            // Check for conflicts
            const winner = await resolveConflict(tableName, item.data, item.updated_at);
            
            if (winner === 'server') {
              // Server has newer data, discard local update
              // Also update local cache with server data
              const { data: serverData } = await db
                .from(tableName)
                .select('*')
                .eq('id', item.data.id)
                .single();
              
              if (serverData) {
                await offlineStorage.put(tableName, serverData);
              }
              
              result.discarded++;
            } else {
              // Local wins, apply update
              const { id, ...updateData } = item.data;
              const { error } = await db
                .from(tableName)
                .update(updateData)
                .eq('id', id);
              if (error) throw error;
              result.resolved++;
            }
          } else if (item.action === 'delete') {
            const { error } = await db
              .from(tableName)
              .delete()
              .eq('id', item.data.id);
            // Ignore "not found" errors for deletes
            if (error && !error.message.includes('not found')) throw error;
            result.resolved++;
          }

          await offlineStorage.removeSyncQueueItem(item.id);
        } catch (error) {
          console.error(`Error syncing item ${item.id}:`, error);
        }
      }

      await updatePendingCount();

      if (result.resolved > 0 || result.discarded > 0) {
        let description = `${result.resolved} cambio(s) sincronizado(s)`;
        if (result.discarded > 0) {
          description += `, ${result.discarded} conflicto(s) resuelto(s)`;
        }
        toast({
          title: 'Sincronización completada',
          description,
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }

    return result;
  }, [isOnline, syncing, toast, updatePendingCount, resolveConflict]);

  // Fetch data from server and cache locally
  const fetchAndCache = useCallback(async <T>(
    table: string,
    options?: { 
      select?: string;
      orderBy?: string;
      limit?: number;
    }
  ): Promise<T[]> => {
    const select = options?.select || '*';
    const orderBy = options?.orderBy || 'created_at';
    const limit = options?.limit || 500;

    if (!isOnline) {
      // Return cached data when offline
      return offlineStorage.getAll<T>(table);
    }

    try {
      const { data, error } = await db
        .from(table)
        .select(select)
        .order(orderBy, { ascending: false })
        .limit(limit);

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
    const now = new Date().toISOString();

    const itemWithId = {
      ...data,
      id,
      ...(TABLES_WITH_CREATED_AT.has(table) ? { created_at: now } : {}),
      ...(TABLES_WITH_UPDATED_AT.has(table) ? { updated_at: now } : {}),
    } as T & { id: string };

    // Always save locally first
    await offlineStorage.put(table, itemWithId);

    if (isOnline) {
      try {
        const { data: serverData, error } = await db
          .from(table)
          .insert(itemWithId)
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
    const now = new Date().toISOString();
    const updatedData = {
      ...data,
      ...(TABLES_WITH_UPDATED_AT.has(table) ? { updated_at: now } : {}),
    };

    // Update locally first
    await offlineStorage.put(table, updatedData as any);

    if (isOnline) {
      try {
        const { id, ...updateFields } = updatedData;
        const { data: serverData, error } = await db
          .from(table)
          .update(updateFields)
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
        const { error } = await db
          .from(table)
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
