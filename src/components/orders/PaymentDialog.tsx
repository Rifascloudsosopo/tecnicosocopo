import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  pendingAmount: number;
  onPaymentComplete: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  pendingAmount,
  onPaymentComplete,
}: PaymentDialogProps) {
  const roundedPending = Math.round(pendingAmount * 100) / 100;
  const [amount, setAmount] = useState(roundedPending.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: 'Monto inválido',
        description: 'Ingresa un monto válido mayor a 0',
        variant: 'destructive',
      });
      return;
    }

    if (paymentAmount > roundedPending + 0.01) {
      toast({
        title: 'Monto excede pendiente',
        description: `El monto máximo a pagar es $${roundedPending.toFixed(2)}`,
        variant: 'destructive',
      });
      return;
    }

    // Clamp to pending amount to avoid overpayment from rounding
    const finalAmount = Math.min(paymentAmount, roundedPending);

    setSaving(true);
    try {
      // Insert payment
      const { error: paymentError } = await supabase
        .from('order_payments')
        .insert({
          order_id: orderId,
          amount: finalAmount,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
        });

      if (paymentError) throw paymentError;

      // Update order's total_paid
      const { data: orderData, error: fetchError } = await supabase
        .from('service_orders')
        .select('total_paid')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      const newTotalPaid = Math.round(((orderData.total_paid || 0) + finalAmount) * 100) / 100;
      
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({ total_paid: newTotalPaid })
        .eq('id', orderId);

      if (updateError) throw updateError;

      toast({
        title: 'Pago registrado',
        description: `Se registró un pago de $${finalAmount.toFixed(2)} para la orden ${orderNumber}`,
      });

      onPaymentComplete();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error registering payment:', error);
      toast({
        title: 'Error al registrar pago',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setAmount(roundedPending.toFixed(2));
    setPaymentMethod('cash');
    setNotes('');
  }

  function handleOpenChange(open: boolean) {
    if (open) {
      setAmount(roundedPending.toFixed(2));
    }
    onOpenChange(open);
  }

  const paymentMethods = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'mobile_payment', label: 'Pago Móvil' },
    { value: 'other', label: 'Otro' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            Orden {orderNumber} - Pendiente: ${roundedPending.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto a pagar ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={roundedPending}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount(roundedPending.toFixed(2))}
              >
                Pagar todo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount((roundedPending / 2).toFixed(2))}
              >
                50%
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Método de pago</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Referencia de transferencia, número de recibo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Registrar Pago'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
