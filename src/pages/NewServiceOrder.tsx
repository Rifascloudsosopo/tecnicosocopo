import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, User, Smartphone, FileText, DollarSign, Loader2, Check, Plus, Trash2, Package, Wrench } from 'lucide-react';
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

interface SparePart {
  id: string;
  name: string;
  sale_price: number;
  stock: number;
}

interface SelectedPart {
  partId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface AdditionalCost {
  description: string;
  amount: number;
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

  // Budget and costs
  const [budget, setBudget] = useState({
    advance: '',
    warrantyDays: '30',
    totalToCharge: '', // This is the final amount to charge the customer
  });

  // Spare parts
  const [availableParts, setAvailableParts] = useState<SparePart[]>([]);
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQuantity, setPartQuantity] = useState('1');

  // Additional costs
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [costDescription, setCostDescription] = useState('');
  const [costAmount, setCostAmount] = useState('');

  // Load spare parts on mount
  useEffect(() => {
    loadSpareParts();
  }, []);

  async function loadSpareParts() {
    const { data } = await supabase
      .from('spare_parts')
      .select('id, name, sale_price, stock')
      .gt('stock', 0)
      .order('name');
    
    setAvailableParts(data || []);
  }

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

  // Calculate totals
  const partsTotal = selectedParts.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
  const costsTotal = additionalCosts.reduce((sum, c) => sum + c.amount, 0);
  const subtotal = partsTotal + costsTotal;
  const hasExplicitTotal = budget.totalToCharge.trim() !== '';
  const explicitTotal = parseFloat(budget.totalToCharge) || 0;
  // If user specifies a total, use it; otherwise total = subtotal (parts + costs)
  const totalToCharge = hasExplicitTotal ? explicitTotal : subtotal;
  const laborAmount = hasExplicitTotal ? Math.max(0, explicitTotal - subtotal) : 0;

  function handleAddPart() {
    if (!selectedPartId) return;
    
    const part = availableParts.find(p => p.id === selectedPartId);
    if (!part) return;

    const qty = parseInt(partQuantity) || 1;
    if (qty <= 0) return;

    // Check if already added
    const existing = selectedParts.find(p => p.partId === selectedPartId);
    if (existing) {
      const newQty = existing.quantity + qty;
      if (newQty > part.stock) {
        toast({ title: `Solo hay ${part.stock} unidades disponibles`, variant: 'destructive' });
        return;
      }
      setSelectedParts(selectedParts.map(p => 
        p.partId === selectedPartId ? { ...p, quantity: newQty } : p
      ));
    } else {
      if (qty > part.stock) {
        toast({ title: `Solo hay ${part.stock} unidades disponibles`, variant: 'destructive' });
        return;
      }
      setSelectedParts([...selectedParts, {
        partId: part.id,
        name: part.name,
        quantity: qty,
        unitPrice: part.sale_price,
      }]);
    }

    setSelectedPartId('');
    setPartQuantity('1');
  }

  function handleRemovePart(partId: string) {
    setSelectedParts(selectedParts.filter(p => p.partId !== partId));
  }

  function handleAddCost() {
    if (!costDescription.trim() || !costAmount) return;
    
    const amount = parseFloat(costAmount);
    if (isNaN(amount) || amount <= 0) return;

    setAdditionalCosts([...additionalCosts, {
      description: costDescription.trim(),
      amount,
    }]);
    setCostDescription('');
    setCostAmount('');
  }

  function handleRemoveCost(index: number) {
    setAdditionalCosts(additionalCosts.filter((_, i) => i !== index));
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

    if (!deviceData.model || !diagnosis.issue) {
      toast({
        title: 'Error',
        description: 'Complete los datos del equipo y diagnóstico',
        variant: 'destructive',
      });
      return;
    }

    // Validate only if user explicitly set a total that's less than costs
    if (hasExplicitTotal && explicitTotal < subtotal) {
      toast({
        title: 'Error',
        description: `El monto total ($${explicitTotal.toFixed(2)}) no puede ser menor que los repuestos y gastos ($${subtotal.toFixed(2)})`,
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

      // Calculate labor if total > subtotal
      const advancePayment = parseFloat(budget.advance) || 0;

      // Create order
      const { data: order, error: orderError } = await (supabase
        .from('service_orders') as any)
        .insert({
          customer_id: customerId,
          technician_id: currentTechnicianId || null,
          device_brand: deviceData.brand.trim() || 'Sin marca',
          device_model: deviceData.model.trim(),
          device_color: deviceData.color.trim() || null,
          device_imei: deviceData.imei.trim() || null,
          unlock_pattern: deviceData.pattern.trim() || null,
          unlock_pin: deviceData.pin.trim() || null,
          account_password: deviceData.accountPassword.trim() || null,
          reported_issue: diagnosis.issue.trim(),
          aesthetic_notes: diagnosis.aesthetic.trim() || null,
          initial_budget: 0, // We'll use labor as additional cost instead
          total_paid: advancePayment,
          warranty_days: parseInt(budget.warrantyDays),
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Add spare parts usage and update stock
      for (const part of selectedParts) {
        await supabase.from('spare_parts_usage').insert({
          order_id: order.id,
          spare_part_id: part.partId,
          quantity: part.quantity,
          unit_price: part.unitPrice,
        });

        // Decrease stock
        const availPart = availableParts.find(p => p.id === part.partId);
        if (availPart) {
          await supabase
            .from('spare_parts')
            .update({ stock: availPart.stock - part.quantity })
            .eq('id', part.partId);
        }
      }

      // Add additional costs
      for (const cost of additionalCosts) {
        await supabase.from('order_additional_costs').insert({
          order_id: order.id,
          description: cost.description,
          amount: cost.amount,
        });
      }

      // Add labor as additional cost if there's a difference
      if (laborAmount > 0) {
        await supabase.from('order_additional_costs').insert({
          order_id: order.id,
          description: 'Mano de obra',
          amount: laborAmount,
        });
      }

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
            { num: 4, label: 'Costos', icon: DollarSign },
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
                  <div className="mt-1.5">
                    <Input
                      id="cedula"
                      placeholder="V-12345678"
                      value={cedulaSearch}
                      onChange={(e) => setCedulaSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCedulaSearch()}
                      className="bg-background border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                  <Label htmlFor="brand">Marca</Label>
                  <Input
                    id="brand"
                    placeholder="Samsung, Apple, Xiaomi..."
                    value={deviceData.brand}
                    onChange={(e) => setDeviceData({ ...deviceData, brand: e.target.value })}
                    className="mt-1.5"
                  />
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
                  disabled={!deviceData.model}
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

        {/* Step 4: Costos y Total */}
        {step === 4 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Repuestos, Costos y Total
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Spare Parts Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Repuestos</h3>
                  <span className="text-xs text-muted-foreground">(opcional)</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar repuesto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableParts.map((part) => (
                        <SelectItem key={part.id} value={part.id}>
                          {part.name} - ${part.sale_price} (Stock: {part.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Cant."
                    value={partQuantity}
                    onChange={(e) => setPartQuantity(e.target.value)}
                    className="w-20"
                  />
                  <Button onClick={handleAddPart} disabled={!selectedPartId} type="button">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {selectedParts.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {selectedParts.map((part) => (
                      <div key={part.partId} className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{part.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {part.quantity} x ${part.unitPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-success">
                            ${(part.quantity * part.unitPrice).toFixed(2)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemovePart(part.partId)}
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 flex justify-end text-sm">
                      <span className="text-muted-foreground mr-2">Subtotal repuestos:</span>
                      <span className="font-semibold">${partsTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Costs Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Costos Adicionales</h3>
                  <span className="text-xs text-muted-foreground">(diagnóstico, etc.)</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Descripción (ej: Diagnóstico)"
                    value={costDescription}
                    onChange={(e) => setCostDescription(e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={costAmount}
                        onChange={(e) => setCostAmount(e.target.value)}
                        className="pl-7 w-28"
                      />
                    </div>
                    <Button onClick={handleAddCost} disabled={!costDescription.trim() || !costAmount} type="button">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {additionalCosts.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {additionalCosts.map((cost, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-2">
                        <span className="font-medium truncate flex-1">{cost.description}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-success">${cost.amount.toFixed(2)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveCost(idx)}
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 flex justify-end text-sm">
                      <span className="text-muted-foreground mr-2">Subtotal extras:</span>
                      <span className="font-semibold">${costsTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Total and Labor Calculation */}
              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="totalToCharge">Monto Total a Cobrar ($)</Label>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Opcional - si está vacío se usa la suma de costos
                    </p>
                    <Input
                      id="totalToCharge"
                      type="number"
                      step="0.01"
                      placeholder={subtotal > 0 ? subtotal.toFixed(2) : "0.00"}
                      value={budget.totalToCharge}
                      onChange={(e) => setBudget({ ...budget, totalToCharge: e.target.value })}
                      className="text-lg font-semibold"
                    />
                  </div>
                  <div>
                    <Label htmlFor="advance">Abono Inicial ($)</Label>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Pago anticipado del cliente
                    </p>
                    <Input
                      id="advance"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={budget.advance}
                      onChange={(e) => setBudget({ ...budget, advance: e.target.value })}
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
                      <SelectItem value="0">Sin garantía</SelectItem>
                      <SelectItem value="7">7 días</SelectItem>
                      <SelectItem value="15">15 días</SelectItem>
                      <SelectItem value="30">30 días</SelectItem>
                      <SelectItem value="60">60 días</SelectItem>
                      <SelectItem value="90">90 días</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Summary */}
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-medium mb-3">Resumen de Costos</h4>
                  
                  {partsTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Repuestos:</span>
                      <span>${partsTotal.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {costsTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Costos adicionales:</span>
                      <span>${costsTotal.toFixed(2)}</span>
                    </div>
                  )}

                  {laborAmount > 0 && (
                    <div className="flex justify-between text-sm text-primary">
                      <span>Mano de obra (calculado):</span>
                      <span className="font-medium">${laborAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm pt-2 border-t font-semibold">
                    <span>Total{!hasExplicitTotal && subtotal > 0 ? ' (calculado)' : ''}:</span>
                    <span className="text-lg">${totalToCharge.toFixed(2)}</span>
                  </div>

                  {parseFloat(budget.advance) > 0 && (
                    <div className="flex justify-between text-sm text-success">
                      <span>Abono inicial:</span>
                      <span>-${parseFloat(budget.advance).toFixed(2)}</span>
                    </div>
                  )}

                  {totalToCharge > 0 && (
                    <div className="flex justify-between text-sm text-warning">
                      <span>Pendiente por cobrar:</span>
                      <span className="font-medium">
                        ${Math.max(0, totalToCharge - (parseFloat(budget.advance) || 0)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Datos de la Orden</h4>
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
                      {diagnosis.issue.substring(0, 50)}{diagnosis.issue.length > 50 ? '...' : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Atrás
                </Button>
                <Button onClick={handleCreateOrder} disabled={saving}>
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
