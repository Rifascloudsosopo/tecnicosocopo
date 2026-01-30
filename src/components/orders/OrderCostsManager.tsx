import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, DollarSign, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SparePart {
  id: string;
  name: string;
  category: string;
  sale_price: number;
  stock: number;
}

interface SparePartUsage {
  id: string;
  spare_part_id: string;
  quantity: number;
  unit_price: number;
  spare_parts?: SparePart;
}

interface AdditionalCost {
  id: string;
  description: string;
  amount: number;
}

interface OrderCostsManagerProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function OrderCostsManager({ orderId, open, onOpenChange, onUpdate }: OrderCostsManagerProps) {
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [usedParts, setUsedParts] = useState<SparePartUsage[]>([]);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New part form
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQuantity, setPartQuantity] = useState('1');
  
  // New cost form
  const [costDescription, setCostDescription] = useState('');
  const [costAmount, setCostAmount] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, orderId]);

  async function loadData() {
    setLoading(true);
    try {
      const [partsRes, usageRes, costsRes] = await Promise.all([
        supabase.from('spare_parts').select('id, name, category, sale_price, stock').order('name'),
        supabase.from('spare_parts_usage').select('*, spare_parts(id, name, category, sale_price, stock)').eq('order_id', orderId),
        supabase.from('order_additional_costs').select('*').eq('order_id', orderId),
      ]);

      if (partsRes.error) throw partsRes.error;
      if (usageRes.error) throw usageRes.error;
      if (costsRes.error) throw costsRes.error;

      setSpareParts(partsRes.data || []);
      setUsedParts(usageRes.data || []);
      setAdditionalCosts(costsRes.data || []);
    } catch (error: any) {
      toast({
        title: 'Error al cargar datos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPart() {
    if (!selectedPartId || !partQuantity) return;

    const part = spareParts.find(p => p.id === selectedPartId);
    if (!part) return;

    const qty = parseInt(partQuantity);
    if (qty <= 0) {
      toast({ title: 'Cantidad inválida', variant: 'destructive' });
      return;
    }

    if (qty > part.stock) {
      toast({
        title: 'Stock insuficiente',
        description: `Solo hay ${part.stock} unidades disponibles`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Add usage record
      const { data, error } = await supabase
        .from('spare_parts_usage')
        .insert({
          order_id: orderId,
          spare_part_id: part.id,
          quantity: qty,
          unit_price: part.sale_price,
        })
        .select('*, spare_parts(id, name, category, sale_price, stock)')
        .single();

      if (error) throw error;

      // Decrease stock
      const { error: stockError } = await supabase
        .from('spare_parts')
        .update({ stock: part.stock - qty })
        .eq('id', part.id);

      if (stockError) throw stockError;

      setUsedParts([...usedParts, data]);
      setSpareParts(spareParts.map(p => 
        p.id === part.id ? { ...p, stock: p.stock - qty } : p
      ));
      setSelectedPartId('');
      setPartQuantity('1');
      
      toast({ title: 'Repuesto agregado' });
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: 'Error al agregar repuesto',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePart(usage: SparePartUsage) {
    setSaving(true);
    try {
      // Remove usage record
      const { error } = await supabase
        .from('spare_parts_usage')
        .delete()
        .eq('id', usage.id);

      if (error) throw error;

      // Restore stock
      const currentPart = spareParts.find(p => p.id === usage.spare_part_id);
      if (currentPart) {
        const { error: stockError } = await supabase
          .from('spare_parts')
          .update({ stock: currentPart.stock + usage.quantity })
          .eq('id', usage.spare_part_id);

        if (stockError) throw stockError;

        setSpareParts(spareParts.map(p => 
          p.id === usage.spare_part_id ? { ...p, stock: p.stock + usage.quantity } : p
        ));
      }

      setUsedParts(usedParts.filter(u => u.id !== usage.id));
      toast({ title: 'Repuesto removido' });
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: 'Error al remover repuesto',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCost() {
    if (!costDescription.trim() || !costAmount) return;

    const amount = parseFloat(costAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Monto inválido', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('order_additional_costs')
        .insert({
          order_id: orderId,
          description: costDescription.trim(),
          amount,
        })
        .select()
        .single();

      if (error) throw error;

      setAdditionalCosts([...additionalCosts, data]);
      setCostDescription('');
      setCostAmount('');
      
      toast({ title: 'Costo agregado' });
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: 'Error al agregar costo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveCost(cost: AdditionalCost) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('order_additional_costs')
        .delete()
        .eq('id', cost.id);

      if (error) throw error;

      setAdditionalCosts(additionalCosts.filter(c => c.id !== cost.id));
      toast({ title: 'Costo removido' });
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: 'Error al remover costo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const totalParts = usedParts.reduce((sum, u) => sum + (u.quantity * u.unit_price), 0);
  const totalCosts = additionalCosts.reduce((sum, c) => sum + c.amount, 0);
  const grandTotal = totalParts + totalCosts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Repuestos y Costos Adicionales
          </DialogTitle>
          <DialogDescription>
            Agrega repuestos utilizados y costos extras (mano de obra, diagnóstico, etc.)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Spare Parts Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Repuestos Utilizados</h3>
              </div>

              {/* Add Part Form */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar repuesto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {spareParts.filter(p => p.stock > 0).map((part) => (
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
                <Button onClick={handleAddPart} disabled={!selectedPartId || saving}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Used Parts List */}
              <div className="border rounded-lg divide-y">
                {usedParts.length === 0 ? (
                  <p className="p-4 text-center text-muted-foreground text-sm">
                    No hay repuestos agregados
                  </p>
                ) : (
                  usedParts.map((usage) => (
                    <div key={usage.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{usage.spare_parts?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {usage.quantity} x ${usage.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-success">
                          ${(usage.quantity * usage.unit_price).toFixed(2)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemovePart(usage)}
                          disabled={saving}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {usedParts.length > 0 && (
                <div className="flex justify-end text-sm">
                  <span className="text-muted-foreground mr-2">Subtotal repuestos:</span>
                  <span className="font-semibold">${totalParts.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Additional Costs Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Costos Adicionales</h3>
              </div>

              {/* Add Cost Form */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Descripción (ej: Mano de obra)"
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
                  <Button onClick={handleAddCost} disabled={!costDescription.trim() || !costAmount || saving}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Costs List */}
              <div className="border rounded-lg divide-y">
                {additionalCosts.length === 0 ? (
                  <p className="p-4 text-center text-muted-foreground text-sm">
                    No hay costos adicionales
                  </p>
                ) : (
                  additionalCosts.map((cost) => (
                    <div key={cost.id} className="p-3 flex items-center justify-between gap-2">
                      <span className="font-medium truncate flex-1">{cost.description}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-success">${cost.amount.toFixed(2)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveCost(cost)}
                          disabled={saving}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {additionalCosts.length > 0 && (
                <div className="flex justify-end text-sm">
                  <span className="text-muted-foreground mr-2">Subtotal costos:</span>
                  <span className="font-semibold">${totalCosts.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Grand Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total General:</span>
                <span className="text-xl font-bold text-primary">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
