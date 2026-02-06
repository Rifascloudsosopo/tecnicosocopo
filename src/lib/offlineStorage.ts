// IndexedDB wrapper for offline storage
const DB_NAME = 'techfix_offline';
const DB_VERSION = 1;

interface SyncQueueItem {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  updated_at: string; // ISO string for conflict resolution
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        // Listen for close events to reset state
        db.onclose = () => {
          this.db = null;
          this.initPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          this.db = null;
          this.initPromise = null;
        };
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        const tables = ['customers', 'service_orders', 'technicians', 'spare_parts', 'order_payments', 'order_additional_costs', 'spare_parts_usage', 'whatsapp_templates', 'company_settings'];
        
        tables.forEach(table => {
          if (!db.objectStoreNames.contains(table)) {
            db.createObjectStore(table, { keyPath: 'id' });
          }
        });

        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async init(): Promise<void> {
    // If db exists, verify it's still usable
    if (this.db) {
      try {
        // Quick check: try to start a transaction to see if connection is alive
        this.db.transaction('customers', 'readonly');
        return;
      } catch {
        // Connection is dead, reset and reconnect
        this.db = null;
        this.initPromise = null;
      }
    }

    if (this.initPromise) return this.initPromise;

    this.initPromise = this.openDB().then(db => {
      this.db = db;
    }).catch(err => {
      this.initPromise = null;
      throw err;
    });

    return this.initPromise;
  }

  async getAll<T>(table: string): Promise<T[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readonly');
      const store = transaction.objectStore(table);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async get<T>(table: string, id: string): Promise<T | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readonly');
      const store = transaction.objectStore(table);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async put<T extends { id: string }>(table: string, data: T): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readwrite');
      const store = transaction.objectStore(table);
      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async putAll<T extends { id: string }>(table: string, items: T[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readwrite');
      const store = transaction.objectStore(table);

      items.forEach(item => store.put(item));

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }

  async delete(table: string, id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readwrite');
      const store = transaction.objectStore(table);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(table: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readwrite');
      const store = transaction.objectStore(table);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Sync queue methods
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'updated_at'>): Promise<void> {
    await this.init();
    const queueItem: SyncQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      updated_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('sync_queue', 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const request = store.add(queueItem);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('sync_queue', 'readonly');
      const store = transaction.objectStore('sync_queue');
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async removeSyncQueueItem(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('sync_queue', 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearSyncQueue(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('sync_queue', 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Export all data for backup
  async exportAll(): Promise<Record<string, any[]>> {
    await this.init();
    const tables = ['customers', 'service_orders', 'technicians', 'spare_parts', 'order_payments', 'order_additional_costs', 'spare_parts_usage', 'whatsapp_templates', 'company_settings'];
    const data: Record<string, any[]> = {};

    for (const table of tables) {
      data[table] = await this.getAll(table);
    }

    return data;
  }

  // Import data from backup
  async importAll(data: Record<string, any[]>): Promise<void> {
    await this.init();
    
    for (const [table, items] of Object.entries(data)) {
      if (Array.isArray(items)) {
        await this.clear(table);
        await this.putAll(table, items);
      }
    }
  }
}

export const offlineStorage = new OfflineStorage();
