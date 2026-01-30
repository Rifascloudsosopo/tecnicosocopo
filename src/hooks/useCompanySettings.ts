import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CompanySettings {
  id: string;
  name: string;
  rif: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  default_warranty_days: number | null;
  abandonment_days: number | null;
  terms_conditions: string | null;
  printer_size?: string;
}

const defaultSettings: Omit<CompanySettings, 'id'> = {
  name: 'TechFix Pro',
  rif: null,
  address: null,
  phone: null,
  email: null,
  logo_url: null,
  default_warranty_days: 30,
  abandonment_days: 90,
  terms_conditions: `1. El cliente autoriza la revisión y reparación del equipo descrito.
2. Los equipos no retirados en 90 días serán considerados abandonados.
3. La garantía cubre únicamente la reparación realizada.
4. No nos hacemos responsables por datos almacenados en el equipo.
5. El cliente debe presentar este comprobante para retirar su equipo.`,
  printer_size: '80mm',
};

export function useCompanySettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return data as CompanySettings;
      }

      // Create default settings if none exist
      const { data: newData, error: insertError } = await supabase
        .from('company_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (insertError) throw insertError;
      return newData as CompanySettings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      if (!query.data?.id) throw new Error('No settings ID');
      
      const { error } = await supabase
        .from('company_settings')
        .update(updates)
        .eq('id', query.data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast({ title: 'Configuración guardada' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    updateSettings: updateMutation.mutate,
    isSaving: updateMutation.isPending,
    refetch: query.refetch,
  };
}
