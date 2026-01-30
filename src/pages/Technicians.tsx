import { useState, useEffect } from 'react';
import { Plus, Phone, Wrench, Edit, Trash2, CheckCircle, XCircle, Loader2, Link2, Shield, Mail, Lock, UserPlus } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PermissionsEditor } from '@/components/technicians/PermissionsEditor';
import { usePermissions } from '@/hooks/usePermissions';

interface Technician {
  id: string;
  name: string;
  phone: string;
  specialty: string | null;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
}

export default function Technicians() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedTechForPerms, setSelectedTechForPerms] = useState<Technician | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const { toast } = useToast();
  const { isAdmin, can } = usePermissions();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    specialty: '',
    user_id: '',
    email: '',
    password: '',
  });
  const [createMode, setCreateMode] = useState<'new' | 'link'>('new');

  useEffect(() => {
    loadTechnicians();
    loadUsers();
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

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (error) throw error;
      
      // Map to expected format
      const mappedUsers = (data || []).map(p => ({
        id: p.user_id,
        email: '',
        full_name: p.full_name,
      }));
      setUsers(mappedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  }

  function openCreateDialog() {
    setEditingTech(null);
    setFormData({ name: '', phone: '', specialty: '', user_id: '', email: '', password: '' });
    setCreateMode('new');
    setIsDialogOpen(true);
  }

  function openEditDialog(tech: Technician) {
    setEditingTech(tech);
    setFormData({
      name: tech.name,
      phone: tech.phone,
      specialty: tech.specialty || '',
      user_id: tech.user_id || '',
      email: '',
      password: '',
    });
    setIsDialogOpen(true);
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

    // If creating new technician with new user account
    if (!editingTech && createMode === 'new') {
      if (!formData.email.trim() || !formData.password.trim()) {
        toast({
          title: 'Campos requeridos',
          description: 'Email y contraseña son obligatorios para crear un técnico con acceso',
          variant: 'destructive',
        });
        return;
      }

      if (formData.password.length < 6) {
        toast({
          title: 'Contraseña muy corta',
          description: 'La contraseña debe tener al menos 6 caracteres',
          variant: 'destructive',
        });
        return;
      }

      setSaving(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(
          `https://waehmrkxueixnckjgmfq.supabase.co/functions/v1/create-technician-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              email: formData.email.trim(),
              password: formData.password,
              fullName: formData.name.trim(),
              technicianData: {
                name: formData.name.trim(),
                phone: formData.phone.trim(),
                specialty: formData.specialty.trim() || null,
              },
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error al crear el técnico');
        }

        setTechnicians([result.technician, ...technicians]);
        toast({
          title: 'Técnico creado',
          description: `${result.technician.name} puede iniciar sesión con ${formData.email}`,
        });

        setFormData({ name: '', phone: '', specialty: '', user_id: '', email: '', password: '' });
        setIsDialogOpen(false);
      } catch (error: any) {
        console.error('Error creating technician:', error);
        toast({
          title: 'Error al crear técnico',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    // Existing logic for editing or linking existing user
    setSaving(true);
    try {
      const techData = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        specialty: formData.specialty.trim() || null,
        user_id: formData.user_id || null,
      };

      if (editingTech) {
        // Update
        const { error } = await supabase
          .from('technicians')
          .update(techData)
          .eq('id', editingTech.id);

        if (error) throw error;

        setTechnicians(technicians.map(t => 
          t.id === editingTech.id ? { ...t, ...techData } : t
        ));
        toast({ title: 'Técnico actualizado' });
      } else {
        // Create without user (link mode with no user selected)
        const { data, error } = await supabase
          .from('technicians')
          .insert({ ...techData, is_active: true })
          .select()
          .single();

        if (error) throw error;

        setTechnicians([data, ...technicians]);
        toast({
          title: 'Técnico registrado',
          description: `${data.name} ha sido agregado exitosamente`,
        });
      }

      setFormData({ name: '', phone: '', specialty: '', user_id: '', email: '', password: '' });
      setIsDialogOpen(false);
      setEditingTech(null);
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

  // Get list of users not yet linked to a technician
  const availableUsers = users.filter(u => 
    !technicians.some(t => t.user_id === u.id) || 
    (editingTech && editingTech.user_id === u.id)
  );

  function openPermissionsDialog(tech: Technician) {
    setSelectedTechForPerms(tech);
    setPermissionsDialogOpen(true);
  }

  const canManage = isAdmin || can('manage_technicians');

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
          {canManage && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={openCreateDialog}>
                  <Plus className="w-4 h-4" />
                  Nuevo Técnico
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingTech ? 'Editar Técnico' : 'Registrar Técnico'}
                  </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="info" className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="info">Información</TabsTrigger>
                    <TabsTrigger value="permissions" disabled={!editingTech?.user_id}>
                      Permisos
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="info">
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

                      {/* Show email/password fields for new technicians only */}
                      {!editingTech && (
                        <div className="border-t pt-4 mt-4 space-y-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <UserPlus className="w-4 h-4" />
                            Credenciales de Acceso
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              Email *
                            </Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="tecnico@email.com"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password" className="flex items-center gap-2">
                              <Lock className="w-4 h-4 text-muted-foreground" />
                              Contraseña *
                            </Label>
                            <Input
                              id="password"
                              type="password"
                              placeholder="Mínimo 6 caracteres"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              required
                              minLength={6}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            El técnico usará estas credenciales para iniciar sesión en la aplicación.
                          </p>
                        </div>
                      )}


                      <div className="flex gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setIsDialogOpen(false);
                            setEditingTech(null);
                          }}
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
                  </TabsContent>
                  <TabsContent value="permissions">
                    {editingTech?.user_id ? (
                      <div className="mt-4">
                        <PermissionsEditor technicianId={editingTech.id} />
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Primero vincula el técnico a un usuario para configurar sus permisos.</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          )}
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

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Phone className="w-4 h-4" />
                    <span>{tech.phone}</span>
                  </div>

                  {tech.user_id && (
                    <div className="flex items-center gap-2 text-sm text-success mb-4">
                      <Link2 className="w-4 h-4" />
                      <span>Vinculado a usuario</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {canManage && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 gap-1"
                          onClick={() => openEditDialog(tech)}
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </Button>
                        {tech.user_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => openPermissionsDialog(tech)}
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteTechnician(tech)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
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

        {/* Permissions Dialog */}
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Permisos de {selectedTechForPerms?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedTechForPerms && (
              <PermissionsEditor technicianId={selectedTechForPerms.id} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
