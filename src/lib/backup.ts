import { supabase } from '@/integrations/supabase/client';

const BACKUP_TABLES = [
  'customers',
  'service_orders',
  'technicians',
  'spare_parts',
  'order_payments',
  'order_additional_costs',
  'spare_parts_usage',
  'whatsapp_templates',
  'company_settings',
];

export interface BackupData {
  version: string;
  timestamp: string;
  tables: Record<string, any[]>;
}

export async function createBackup(): Promise<BackupData> {
  const backup: BackupData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    tables: {},
  };

  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase
      .from(table as any)
      .select('*');

    if (error) {
      console.error(`Error fetching ${table}:`, error);
      backup.tables[table] = [];
    } else {
      backup.tables[table] = data || [];
    }
  }

  return backup;
}

export function downloadBackup(backup: BackupData): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `techfix-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreBackup(backup: BackupData): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Validate backup structure
  if (!backup.version || !backup.tables) {
    return { success: false, errors: ['Archivo de respaldo inválido'] };
  }

  // Process tables in order (to respect foreign keys)
  const orderedTables = [
    'company_settings',
    'customers',
    'technicians',
    'spare_parts',
    'whatsapp_templates',
    'service_orders',
    'order_payments',
    'order_additional_costs',
    'spare_parts_usage',
  ];

  for (const table of orderedTables) {
    const tableData = backup.tables[table];
    if (!tableData || !Array.isArray(tableData) || tableData.length === 0) continue;

    try {
      // Use upsert to handle existing records
      const { error } = await supabase
        .from(table as any)
        .upsert(tableData, { onConflict: 'id' });

      if (error) {
        errors.push(`Error en ${table}: ${error.message}`);
      }
    } catch (err: any) {
      errors.push(`Error en ${table}: ${err.message}`);
    }
  }

  return { success: errors.length === 0, errors };
}

export function parseBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        resolve(data);
      } catch (error) {
        reject(new Error('El archivo no es un JSON válido'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsText(file);
  });
}
