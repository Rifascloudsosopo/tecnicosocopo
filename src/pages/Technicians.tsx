import { useState, useEffect } from 'react';
import { Plus, Phone, Wrench, Edit, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Technician {
  id: string;
  name: string;
  phone: string;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Technicians() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    specialty: '',
  });

  useEffect(() => {
    loadTechnicians();
  }, []);

  async function loadTechnicians() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error: any) {
      console.error('Error loading technicians:', error);
      toast({
        title: 'Error al cargar técnicos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Nombre y teléfono son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('technicians')
        .insert({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          specialty: formData.specialty.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setTechnicians([data, ...technicians]);
      setFormData({ name: '', phone: '', specialty: '' });
      setIsDialogOpen(false);
      toast({
        title: 'Técnico registrado',
        description: `${data.name} ha sido agregado exitosamente`,
      });
    } catch (error: any) {
      console.error('Error saving technician:', error);
      toast({
        title: 'Error al guardar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(tech: Technician) {
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ is_active: !tech.is_active })
        .eq('id', tech.id);

      if (error) throw error;

      setTechnicians(
        technicians.map((t) =>
          t.id === tech.id ? { ...t, is_active: !t.is_active } : t
        )
      );
      toast({
        title: tech.is_active ? 'Técnico desactivado' : 'Técnico activado',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function deleteTechnician(tech: Technician) {
    if (!confirm(`¿Eliminar a ${tech.name}?`)) return;

    try {
      const { error } = await supabase
        .from('technicians')
        .delete()
        .eq('id', tech.id);

      if (error) throw error;

      setTechnicians(technicians.filter((t) => t.id !== tech.id));
      toast({ title: 'Técnico eliminado' });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  const activeTechnicians = technicians.filter((t) => t.is_active);

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Técnicos</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona el equipo de reparaciones
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nuevo Técnico
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Técnico</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo *</Label>
                  <Input
                    id="name"
                    placeholder="Carlos Ramírez"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    placeholder="+58 412-1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Especialidad</Label>
                  <Input
                    id="specialty"
                    placeholder="Pantallas, Placas, Software..."
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Técnicos Activos</p>
            <p className="text-3xl font-bold text-primary mt-1">{activeTechnicians.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total Registrados</p>
            <p className="text-3xl font-bold text-foreground mt-1">{technicians.length}</p>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Cargando técnicos...</span>
          </div>
        ) : (
          <>
            {/* Technicians Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {technicians.map((tech) => (
                <div
                  key={tech.id}
                  className={cn(
                    'glass-card rounded-xl p-5 transition-all duration-300',
                    !tech.is_active && 'opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Wrench className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">{tech.name}</h3>
                        <p className="text-sm text-muted-foreground">{tech.specialty || 'General'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(tech)}
                      className="flex items-center gap-1"
                      title={tech.is_active ? 'Desactivar' : 'Activar'}
                    >
                      {tech.is_active ? (
                        <CheckCircle className="w-5 h-5 text-success" />
                      ) : (
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Phone className="w-4 h-4" />
                    <span>{tech.phone}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1">
                      <Edit className="w-4 h-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteTechnician(tech)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {technicians.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No hay técnicos registrados</p>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
