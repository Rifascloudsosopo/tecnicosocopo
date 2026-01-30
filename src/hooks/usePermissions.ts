import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type Permission =
  | 'view_all_orders'
  | 'create_orders'
  | 'edit_orders'
  | 'change_status'
  | 'change_status_delivered'
  | 'view_customers'
  | 'manage_customers'
  | 'view_inventory'
  | 'manage_inventory'
  | 'view_reports'
  | 'view_settings'
  | 'manage_settings'
  | 'manage_technicians'
  | 'manage_whatsapp';

export const ALL_PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: 'view_all_orders', label: 'Ver todas las órdenes', description: 'Puede ver órdenes de todos los técnicos' },
  { key: 'create_orders', label: 'Crear órdenes', description: 'Puede crear nuevas órdenes de servicio' },
  { key: 'edit_orders', label: 'Editar órdenes', description: 'Puede editar órdenes existentes' },
  { key: 'change_status', label: 'Cambiar estado', description: 'Puede cambiar el estado de las órdenes' },
  { key: 'change_status_delivered', label: 'Marcar entregado', description: 'Puede marcar órdenes como entregadas' },
  { key: 'view_customers', label: 'Ver clientes', description: 'Puede ver la lista de clientes' },
  { key: 'manage_customers', label: 'Gestionar clientes', description: 'Puede crear y editar clientes' },
  { key: 'view_inventory', label: 'Ver inventario', description: 'Puede ver el inventario de repuestos' },
  { key: 'manage_inventory', label: 'Gestionar inventario', description: 'Puede modificar el inventario' },
  { key: 'view_reports', label: 'Ver reportes', description: 'Puede acceder a los reportes' },
  { key: 'view_settings', label: 'Ver configuración', description: 'Puede ver la configuración del sistema' },
  { key: 'manage_settings', label: 'Gestionar configuración', description: 'Puede modificar la configuración' },
  { key: 'manage_technicians', label: 'Gestionar técnicos', description: 'Puede crear y editar técnicos' },
  { key: 'manage_whatsapp', label: 'Gestionar WhatsApp', description: 'Puede administrar plantillas de WhatsApp' },
];

interface PermissionRecord {
  permission: string;
  granted: boolean;
}

export function usePermissions() {
  const { user, currentTechnicianId, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setPermissions({});
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    loadPermissions();
  }, [user, authLoading, currentTechnicianId]);

  async function loadPermissions() {
    try {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleData) {
        setIsAdmin(true);
        // Admins have all permissions
        const allPerms: Record<string, boolean> = {};
        ALL_PERMISSIONS.forEach(p => allPerms[p.key] = true);
        setPermissions(allPerms);
        setLoading(false);
        return;
      }

      setIsAdmin(false);

      // For technicians, load their specific permissions
      if (currentTechnicianId) {
        const { data: permData, error } = await supabase
          .from('technician_permissions')
          .select('permission, granted')
          .eq('technician_id', currentTechnicianId);

        if (error) {
          console.error('Error loading permissions:', error);
        }

        const perms: Record<string, boolean> = {};
        (permData || []).forEach((p: PermissionRecord) => {
          perms[p.permission] = p.granted;
        });
        setPermissions(perms);
      } else {
        // User is not admin and not linked to a technician - no permissions
        setPermissions({});
      }
    } catch (error) {
      console.error('Error in loadPermissions:', error);
    } finally {
      setLoading(false);
    }
  }

  function can(permission: Permission): boolean {
    if (isAdmin) return true;
    return permissions[permission] === true;
  }

  function canAny(...perms: Permission[]): boolean {
    return perms.some(p => can(p));
  }

  function canAll(...perms: Permission[]): boolean {
    return perms.every(p => can(p));
  }

  return {
    permissions,
    isAdmin,
    loading: loading || authLoading,
    can,
    canAny,
    canAll,
    refresh: loadPermissions,
  };
}
