import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Technician {
  id: string;
  name: string;
}

export default function EditServiceOrder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const [form, setForm] = useState({
    device_brand: '',
    device_model: '',
    device_color: '',
    device_imei: '',
    reported_issue: '',
    aesthetic_notes: '',
    unlock_pin: '',
    unlock_pattern: '',
    account_password: '',
    technician_id: '',
    warranty_days: '30',
  });

  useEffect(() => {
    if (id) {
      loadOrder();
      loadTechnicians();
    }
  }, [id]);

  async function loadTechnicians() {
    const { data } = await supabase
      .from('technicians')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setTechnicians(data || []);
  }

  async function loadOrder() {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('service_orders') as any)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setForm({
        device_brand: data.device_brand || '',
        device_model: data.device_model || '',
        device_color: data.device_color || '',
        device_imei: data.device_imei || '',
        reported_issue: data.reported_issue || '',
        aesthetic_notes: data.aesthetic_notes || '',
        unlock_pin: data.unlock_pin || '',
        unlock_pattern: data.unlock_pattern || '',
        account_password: data.account_password || '',
        technician_id: data.technician_id || '',
        warranty_days: String(data.warranty_days || 30),
      });
    } catch (error: any) {
      toast({
        title: 'Error al cargar orden',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/ordenes');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.device_model || !form.reported_issue) {
      toast({
        title: 'Error',
        description: 'Modelo y falla reportada son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase
        .from('service_orders') as any)
        .update({
          device_brand: form.device_brand.trim() || 'Sin marca',
          device_model: form.device_model.trim(),
          device_color: form.device_color.trim() || null,
          device_imei: form.device_imei.trim() || null,
          reported_issue: form.reported_issue.trim(),
          aesthetic_notes: form.aesthetic_notes.trim() || null,
          unlock_pin: form.unlock_pin.trim() || null,
          unlock_pattern: form.unlock_pattern.trim() || null,
          account_password: form.account_password.trim() || null,
          technician_id: form.technician_id || null,
          warranty_days: parseInt(form.warranty_days) || 30,
        })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Orden actualizada correctamente' });
      navigate('/ordenes');
    } catch (error: any) {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Cargando orden...</span>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ordenes')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Editar Orden</h1>
            <p className="text-muted-foreground mt-1">Modifica los datos de la orden de servicio</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Device Info */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Datos del Equipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brand">Marca</Label>
                  <Input
                    id="brand"
                    value={form.device_brand}
                    onChange={(e) => setForm({ ...form, device_brand: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="model">Modelo *</Label>
                  <Input
                    id="model"
                    value={form.device_model}
                    onChange={(e) => setForm({ ...form, device_model: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    value={form.device_color}
                    onChange={(e) => setForm({ ...form, device_color: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="imei">IMEI</Label>
                  <Input
                    id="imei"
                    value={form.device_imei}
                    onChange={(e) => setForm({ ...form, device_imei: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Info */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Información de Acceso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="pin">PIN</Label>
                  <Input
                    id="pin"
                    value={form.unlock_pin}
                    onChange={(e) => setForm({ ...form, unlock_pin: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="pattern">Patrón</Label>
                  <Input
                    id="pattern"
                    value={form.unlock_pattern}
                    onChange={(e) => setForm({ ...form, unlock_pattern: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    value={form.account_password}
                    onChange={(e) => setForm({ ...form, account_password: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Diagnosis */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Diagnóstico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="issue">Falla Reportada *</Label>
                <Textarea
                  id="issue"
                  value={form.reported_issue}
                  onChange={(e) => setForm({ ...form, reported_issue: e.target.value })}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="aesthetic">Notas Estéticas</Label>
                <Textarea
                  id="aesthetic"
                  value={form.aesthetic_notes}
                  onChange={(e) => setForm({ ...form, aesthetic_notes: e.target.value })}
                  rows={2}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Asignación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Técnico</Label>
                  <Select value={form.technician_id} onValueChange={(v) => setForm({ ...form, technician_id: v })}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="warranty">Días de Garantía</Label>
                  <Input
                    id="warranty"
                    type="number"
                    value={form.warranty_days}
                    onChange={(e) => setForm({ ...form, warranty_days: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end pb-8">
            <Button variant="outline" onClick={() => navigate('/ordenes')}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
