import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, User, Smartphone, FileText, DollarSign, Loader2, Check } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Customer {
  id: string;
  cedula: string;
  name: string;
  phone: string;
}

export default function NewServiceOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentTechnicianId } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Customer state
  const [cedulaSearch, setCedulaSearch] = useState('');
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [customerNotFound, setCustomerNotFound] = useState(false);

  // Device data
  const [deviceData, setDeviceData] = useState({
    brand: '',
    model: '',
    color: '',
    imei: '',
    pattern: '',
    pin: '',
    accountPassword: '',
  });

  // Diagnosis
  const [diagnosis, setDiagnosis] = useState({
    issue: '',
    aesthetic: '',
  });

  // Budget
  const [budget, setBudget] = useState({
    initial: '',
    advance: '',
    warrantyDays: '30',
  });


  async function handleCedulaSearch() {
    if (!cedulaSearch.trim()) return;

    setSearchingCustomer(true);
    setCustomerNotFound(false);
    setSelectedCustomer(null);

    try {
      const { data, error } = await (supabase
        .from('customers') as any)
        .select('id, cedula, name, phone')
        .eq('cedula', cedulaSearch.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSelectedCustomer(data);
      } else {
        setCustomerNotFound(true);
      }
    } catch (error: any) {
      toast({
        title: 'Error al buscar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSearchingCustomer(false);
    }
  }

  async function handleCreateOrder() {
    if (!selectedCustomer && (!newCustomer.name || !newCustomer.phone)) {
      toast({
        title: 'Error',
        description: 'Datos del cliente incompletos',
        variant: 'destructive',
      });
      return;
    }

    if (!deviceData.brand || !deviceData.model || !diagnosis.issue) {
      toast({
        title: 'Error',
        description: 'Complete los datos del equipo y diagnóstico',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      let customerId = selectedCustomer?.id;

      // Create customer if new
      if (!customerId && customerNotFound) {
        const { data: newCust, error: custError } = await (supabase
          .from('customers') as any)
          .insert({
            cedula: cedulaSearch.trim(),
            name: newCustomer.name.trim(),
            phone: newCustomer.phone.trim(),
          })
          .select()
          .single();

        if (custError) throw custError;
        customerId = newCust.id;
      }

      // Create order - auto-assign current technician if logged in as one
      const initialBudget = parseFloat(budget.initial) || 0;
      const advancePayment = parseFloat(budget.advance) || 0;

      const { data: order, error: orderError } = await (supabase
        .from('service_orders') as any)
        .insert({
          customer_id: customerId,
          technician_id: currentTechnicianId || null,
          device_brand: deviceData.brand.trim(),
          device_model: deviceData.model.trim(),
          device_color: deviceData.color.trim() || null,
          device_imei: deviceData.imei.trim() || null,
          unlock_pattern: deviceData.pattern.trim() || null,
          unlock_pin: deviceData.pin.trim() || null,
          account_password: deviceData.accountPassword.trim() || null,
          reported_issue: diagnosis.issue.trim(),
          aesthetic_notes: diagnosis.aesthetic.trim() || null,
          initial_budget: initialBudget,
          total_paid: advancePayment,
          warranty_days: parseInt(budget.warrantyDays),
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create initial payment if advance > 0
      if (advancePayment > 0) {
        await (supabase.from('order_payments') as any).insert({
          order_id: order.id,
          amount: advancePayment,
          payment_method: 'efectivo',
          notes: 'Abono inicial',
        });
      }

      toast({
        title: 'Orden creada',
        description: `Orden ${order.order_number} creada exitosamente`,
      });

      navigate('/ordenes');
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error al crear orden',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ordenes')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Nueva Orden de Servicio</h1>
            <p className="text-muted-foreground mt-1">
              Registra un nuevo equipo para reparación
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 px-4">
          {[
            { num: 1, label: 'Cliente', icon: User },
            { num: 2, label: 'Equipo', icon: Smartphone },
            { num: 3, label: 'Diagnóstico', icon: FileText },
            { num: 4, label: 'Presupuesto', icon: DollarSign },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  step >= s.num
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {step > s.num ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
              </div>
              <span
                className={`ml-2 font-medium hidden sm:inline ${
                  step >= s.num ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
              {idx < 3 && (
                <div
                  className={`w-8 sm:w-16 h-0.5 mx-2 sm:mx-4 ${
                    step > s.num ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Cliente */}
        {step === 1 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Identificación del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="cedula">Cédula del Cliente</Label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="cedula"
                      placeholder="V-12345678"
                      value={cedulaSearch}
                      onChange={(e) => setCedulaSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCedulaSearch()}
                      className="input-search"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCedulaSearch} disabled={searchingCustomer}>
                    {searchingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                  </Button>
                </div>
              </div>

              {selectedCustomer && (
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                  <p className="font-medium text-success flex items-center gap-2">
                    <Check className="w-4 h-4" /> Cliente encontrado
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Nombre:</span> {selectedCustomer.name}</p>
                    <p><span className="text-muted-foreground">Teléfono:</span> {selectedCustomer.phone}</p>
                  </div>
                </div>
              )}

              {customerNotFound && (
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                  <p className="font-medium text-warning">Cliente no registrado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete los datos para registrar un nuevo cliente.
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="name">Nombre Completo *</Label>
                      <Input
                        id="name"
                        placeholder="Juan Pérez"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Teléfono *</Label>
                      <Input
                        id="phone"
                        placeholder="+58 412-1234567"
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedCustomer && (!customerNotFound || !newCustomer.name || !newCustomer.phone)}
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Equipo */}
        {step === 2 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Datos del Equipo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brand">Marca *</Label>
                  <Select
                    value={deviceData.brand}
                    onValueChange={(v) => setDeviceData({ ...deviceData, brand: v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Seleccionar marca" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Samsung">Samsung</SelectItem>
                      <SelectItem value="Apple">Apple (iPhone)</SelectItem>
                      <SelectItem value="Xiaomi">Xiaomi</SelectItem>
                      <SelectItem value="Huawei">Huawei</SelectItem>
                      <SelectItem value="Motorola">Motorola</SelectItem>
                      <SelectItem value="Oppo">Oppo</SelectItem>
                      <SelectItem value="Realme">Realme</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="model">Modelo *</Label>
                  <Input
                    id="model"
                    placeholder="Galaxy S23 Ultra"
                    value={deviceData.model}
                    onChange={(e) => setDeviceData({ ...deviceData, model: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    placeholder="Negro"
                    value={deviceData.color}
                    onChange={(e) => setDeviceData({ ...deviceData, color: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="imei">IMEI / Serial</Label>
                  <Input
                    id="imei"
                    placeholder="123456789012345"
                    value={deviceData.imei}
                    onChange={(e) => setDeviceData({ ...deviceData, imei: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h4 className="font-medium mb-4">Datos de Acceso (Confidencial)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="pattern">Patrón de Desbloqueo</Label>
                    <Input
                      id="pattern"
                      placeholder="L, Z, etc."
                      value={deviceData.pattern}
                      onChange={(e) => setDeviceData({ ...deviceData, pattern: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pin">PIN</Label>
                    <Input
                      id="pin"
                      type="password"
                      placeholder="****"
                      value={deviceData.pin}
                      onChange={(e) => setDeviceData({ ...deviceData, pin: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account">Contraseña iCloud/Google</Label>
                    <Input
                      id="account"
                      type="password"
                      placeholder="********"
                      value={deviceData.accountPassword}
                      onChange={(e) => setDeviceData({ ...deviceData, accountPassword: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Atrás
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!deviceData.brand || !deviceData.model}
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Diagnóstico */}
        {step === 3 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Diagnóstico e Ingreso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="issue">Falla Reportada por el Cliente *</Label>
                <Textarea
                  id="issue"
                  placeholder="Describa detalladamente la falla que reporta el cliente..."
                  value={diagnosis.issue}
                  onChange={(e) => setDiagnosis({ ...diagnosis, issue: e.target.value })}
                  className="mt-1.5 min-h-24"
                />
              </div>

              <div>
                <Label htmlFor="aesthetic">Observaciones Estéticas (Golpes, Rayones)</Label>
                <Textarea
                  id="aesthetic"
                  placeholder="Descripción del estado físico del equipo al momento del ingreso..."
                  value={diagnosis.aesthetic}
                  onChange={(e) => setDiagnosis({ ...diagnosis, aesthetic: e.target.value })}
                  className="mt-1.5 min-h-24"
                />
              </div>


              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Atrás
                </Button>
                <Button onClick={() => setStep(4)} disabled={!diagnosis.issue.trim()}>
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Presupuesto */}
        {step === 4 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Presupuesto Inicial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="budget">Monto Inicial ($) *</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={budget.initial}
                    onChange={(e) => setBudget({ ...budget, initial: e.target.value })}
                    className="mt-1.5 text-lg font-semibold"
                  />
                </div>
                <div>
                  <Label htmlFor="advance">Abono Inicial ($)</Label>
                  <Input
                    id="advance"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={budget.advance}
                    onChange={(e) => setBudget({ ...budget, advance: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="warranty">Días de Garantía</Label>
                <Select
                  value={budget.warrantyDays}
                  onValueChange={(v) => setBudget({ ...budget, warrantyDays: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 días</SelectItem>
                    <SelectItem value="15">15 días</SelectItem>
                    <SelectItem value="30">30 días</SelectItem>
                    <SelectItem value="60">60 días</SelectItem>
                    <SelectItem value="90">90 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Resumen de la Orden</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Cliente:</span>{' '}
                    {selectedCustomer?.name || newCustomer.name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Equipo:</span>{' '}
                    {deviceData.brand} {deviceData.model}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Falla:</span>{' '}
                    {diagnosis.issue.substring(0, 50)}...
                  </p>
                  <p>
                    <span className="text-muted-foreground">Presupuesto:</span>{' '}
                    ${parseFloat(budget.initial || '0').toFixed(2)}
                  </p>
                  {budget.advance && parseFloat(budget.advance) > 0 && (
                    <p>
                      <span className="text-muted-foreground">Abono:</span>{' '}
                      ${parseFloat(budget.advance).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Atrás
                </Button>
                <Button onClick={handleCreateOrder} disabled={saving || !budget.initial}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear Orden'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
