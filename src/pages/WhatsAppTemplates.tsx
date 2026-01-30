import { useState, useEffect } from 'react';
import { Plus, MessageSquare, Edit, Trash2, Copy, Loader2, Save, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useWhatsAppTemplates, WhatsAppTemplate } from '@/hooks/useWhatsAppTemplates';

const defaultTemplates = [
  {
    name: 'Equipo Recibido',
    template: 'Hola {cliente}, le informamos que su equipo {marca} {modelo} ha sido recibido en nuestro taller. Orden: {numero_orden}. Le mantendremos informado del progreso. Gracias por su confianza.',
    status_trigger: 'pending',
  },
  {
    name: 'En Proceso de Reparación',
    template: 'Hola {cliente}, su equipo {marca} {modelo} (Orden: {numero_orden}) está siendo reparado por nuestro técnico {tecnico}. Le avisaremos cuando esté listo.',
    status_trigger: 'in_progress',
  },
  {
    name: 'Listo para Entrega',
    template: '¡Buenas noticias {cliente}! Su equipo {marca} {modelo} ya está reparado y listo para retirar. Orden: {numero_orden}. Monto a pagar: ${monto_pendiente}. Horario: Lunes a Sábado 9am-6pm.',
    status_trigger: 'completed',
  },
  {
    name: 'Equipo Entregado',
    template: 'Hola {cliente}, confirmamos la entrega de su equipo {marca} {modelo}. Orden: {numero_orden}. Garantía de 30 días. ¡Gracias por su confianza en {taller}!',
    status_trigger: 'delivered',
  },
];

export default function WhatsAppTemplates() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useWhatsAppTemplates();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    template: '',
    status_trigger: 'none',
  });

  // Seed default templates if none exist
  useEffect(() => {
    if (!isLoading && templates.length === 0) {
      // Create default templates
      defaultTemplates.forEach(t => {
        createTemplate(t);
      });
    }
  }, [isLoading, templates.length]);

  const copyTemplate = (template: string) => {
    navigator.clipboard.writeText(template);
    toast({
      title: 'Plantilla copiada',
      description: 'La plantilla se ha copiado al portapapeles',
    });
  };

  const getStatusLabel = (status: string | null) => {
    const labels: Record<string, string> = {
      pending: 'Al recibir equipo',
      in_progress: 'En Proceso',
      completed: 'Completado',
      delivered: 'Entregado',
    };
    return status ? labels[status] || status : 'Manual';
  };

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormData({ name: '', template: '', status_trigger: 'none' });
    setIsDialogOpen(true);
  }

  function openEditDialog(template: WhatsAppTemplate) {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      template: template.template,
      status_trigger: template.status_trigger || 'none',
    });
    setIsDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.template.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'El nombre y el mensaje son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    const templateData = {
      name: formData.name.trim(),
      template: formData.template.trim(),
      status_trigger: formData.status_trigger === 'none' ? null : formData.status_trigger,
    };

    if (editingTemplate) {
      updateTemplate({ id: editingTemplate.id, ...templateData });
    } else {
      createTemplate(templateData);
    }

    setIsDialogOpen(false);
    setEditingTemplate(null);
  }

  function handleDelete(id: string) {
    deleteTemplate(id);
    setDeleteConfirm(null);
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Plantillas WhatsApp</h1>
            <p className="text-muted-foreground mt-1">
              Configura mensajes automáticos para tus clientes
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Plantilla
          </Button>
        </div>

        {/* Variables Info */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <h3 className="font-medium mb-2">Variables disponibles</h3>
          <div className="flex flex-wrap gap-2">
            {['{cliente}', '{marca}', '{modelo}', '{numero_orden}', '{tecnico}', '{monto_pendiente}', '{monto_total}', '{taller}'].map((v) => (
              <span
                key={v}
                className="px-2 py-1 bg-primary/10 text-primary text-sm rounded font-mono cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(v);
                  toast({ title: 'Variable copiada' });
                }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>

        {/* Templates List */}
        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="glass-card rounded-xl p-5 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <MessageSquare className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{template.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      Envío: {getStatusLabel(template.status_trigger)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyTemplate(template.template)}
                    title="Copiar"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => openEditDialog(template)}
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm(template.id)}
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                {template.template}
              </p>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No hay plantillas configuradas</p>
              <Button onClick={openCreateDialog} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Crear primera plantilla
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Plantilla' : 'Crear Plantilla'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Plantilla</Label>
              <Input 
                id="name" 
                placeholder="Ej: Equipo Listo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trigger">Envío Automático</Label>
              <Select
                value={formData.status_trigger}
                onValueChange={(v) => setFormData({ ...formData, status_trigger: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual</SelectItem>
                  <SelectItem value="pending">Al recibir equipo</SelectItem>
                  <SelectItem value="in_progress">Al iniciar reparación</SelectItem>
                  <SelectItem value="completed">Al completar</SelectItem>
                  <SelectItem value="delivered">Al entregar</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Esta plantilla se usará automáticamente al enviar WhatsApp en ese estado
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template">Mensaje</Label>
              <Textarea
                id="template"
                placeholder="Escribe tu mensaje aquí..."
                className="min-h-32"
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Variables: {'{cliente}'}, {'{marca}'}, {'{modelo}'}, {'{numero_orden}'}, {'{tecnico}'}, {'{monto_pendiente}'}
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 gap-2">
                <Save className="w-4 h-4" />
                {editingTemplate ? 'Actualizar' : 'Guardar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La plantilla será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
