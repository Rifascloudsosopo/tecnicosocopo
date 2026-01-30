import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanySettings } from './useCompanySettings';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  template: string;
  status_trigger: string | null;
  created_at: string | null;
}

interface OrderData {
  order_number: string;
  device_brand: string;
  device_model: string;
  initial_budget: number;
  total_paid: number;
  customers?: {
    name: string;
    phone: string;
  } | null;
  technicians?: {
    name: string;
  } | null;
}

export function useWhatsAppTemplates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as WhatsAppTemplate[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (template: Omit<WhatsAppTemplate, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast({ title: 'Plantilla creada' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al crear plantilla',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WhatsAppTemplate> & { id: string }) => {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast({ title: 'Plantilla actualizada' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast({ title: 'Plantilla eliminada' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    templates: query.data || [],
    isLoading: query.isLoading,
    createTemplate: createMutation.mutate,
    updateTemplate: updateMutation.mutate,
    deleteTemplate: deleteMutation.mutate,
    getTemplateByStatus: (status: string) => 
      query.data?.find(t => t.status_trigger === status),
  };
}

export function buildWhatsAppMessage(
  template: WhatsAppTemplate,
  order: OrderData,
  companyName: string,
  additionalVars?: Record<string, string>
): string {
  const pendingAmount = order.initial_budget - order.total_paid;
  
  let message = template.template;
  
  const variables: Record<string, string> = {
    '{cliente}': order.customers?.name || 'Cliente',
    '{marca}': order.device_brand,
    '{modelo}': order.device_model,
    '{numero_orden}': order.order_number,
    '{tecnico}': order.technicians?.name || 'Técnico',
    '{monto_pendiente}': pendingAmount.toFixed(2),
    '{monto_total}': order.initial_budget.toFixed(2),
    '{monto_pagado}': order.total_paid.toFixed(2),
    '{taller}': companyName,
    ...additionalVars,
  };

  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return message;
}

export function openWhatsAppWithTemplate(
  phone: string,
  template: WhatsAppTemplate,
  order: OrderData,
  companyName: string,
  additionalVars?: Record<string, string>
) {
  const message = buildWhatsAppMessage(template, order, companyName, additionalVars);
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
}
