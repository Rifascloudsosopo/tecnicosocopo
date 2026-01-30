import { useState, useEffect } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ALL_PERMISSIONS, Permission } from '@/hooks/usePermissions';

interface PermissionsEditorProps {
  technicianId: string;
  disabled?: boolean;
}

export function PermissionsEditor({ technicianId, disabled }: PermissionsEditorProps) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
  }, [technicianId]);

  async function loadPermissions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('technician_permissions')
        .select('permission, granted')
        .eq('technician_id', technicianId);

      if (error) throw error;

      const perms: Record<string, boolean> = {};
      (data || []).forEach(p => {
        perms[p.permission] = p.granted;
      });
      setPermissions(perms);
    } catch (error: any) {
      console.error('Error loading permissions:', error);
      toast({
        title: 'Error al cargar permisos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function togglePermission(permission: Permission, granted: boolean) {
    setSaving(permission);
    try {
      const { error } = await supabase
        .from('technician_permissions')
        .upsert({
          technician_id: technicianId,
          permission,
          granted,
        }, {
          onConflict: 'technician_id,permission'
        });

      if (error) throw error;

      setPermissions(prev => ({ ...prev, [permission]: granted }));
    } catch (error: any) {
      console.error('Error updating permission:', error);
      toast({
        title: 'Error al actualizar permiso',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Cargando permisos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Shield className="w-4 h-4" />
        <span>Configura qué puede hacer este técnico en el sistema</span>
      </div>

      <div className="grid gap-3">
        {ALL_PERMISSIONS.map((perm) => (
          <div
            key={perm.key}
            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
          >
            <Checkbox
              id={perm.key}
              checked={permissions[perm.key] || false}
              onCheckedChange={(checked) => togglePermission(perm.key, !!checked)}
              disabled={disabled || saving === perm.key}
            />
            <div className="flex-1 min-w-0">
              <Label
                htmlFor={perm.key}
                className="font-medium cursor-pointer flex items-center gap-2"
              >
                {perm.label}
                {saving === perm.key && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {perm.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
