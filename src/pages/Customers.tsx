import { useState, useEffect } from 'react';
import { Search, Plus, Phone, Mail, MapPin, History, Loader2, Edit, Trash2, X, Eye } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface Customer {
  id: string;
  cedula: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
}

interface ServiceOrder {
  id: string;
  order_number: string;
  device_brand: string;
  device_model: string;
  status: string;
  created_at: string;
  reported_issue: string;
}

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<ServiceOrder[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();
  const { isOnline, insertWithSync, updateWithSync, deleteWithSync, fetchAndCache } = useOfflineSync();

  // Form state
  const [formData, setFormData] = useState({
    cedula: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    try {
      const data = await fetchAndCache<Customer>('customers');
      setCustomers(data.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error: any) {
      console.error('Error loading customers:', error);
      toast({
        title: 'Error al cargar clientes',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomerHistory(customer: Customer) {
    setSelectedCustomer(customer);
    setIsHistoryOpen(true);
    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from('service_orders')
        .select('id, order_number, device_brand, device_model, status, created_at, reported_issue')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomerOrders(data || []);
    } catch (error: any) {
      console.error('Error loading history:', error);
      toast({
        title: 'Error al cargar historial',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.cedula.trim() || !formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Cédula, nombre y teléfono son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        // Update existing customer
        const updated = await updateWithSync<Customer>('customers', {
          ...editingCustomer,
          cedula: formData.cedula.trim(),
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || null,
          address: formData.address.trim() || null,
        });

        setCustomers(customers.map(c => c.id === updated.id ? updated : c));
        toast({ title: 'Cliente actualizado' });
      } else {
        // Create new customer
        const newCustomer = await insertWithSync<Customer>('customers', {
          cedula: formData.cedula.trim(),
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || null,
          address: formData.address.trim() || null,
        } as any);

        setCustomers([newCustomer, ...customers]);
        toast({
          title: 'Cliente registrado',
          description: `${newCustomer.name} ha sido agregado exitosamente`,
        });
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving customer:', error);
      toast({
        title: 'Error al guardar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`¿Eliminar a ${customer.name}?`)) return;

    try {
      await deleteWithSync('customers', customer.id);
      setCustomers(customers.filter(c => c.id !== customer.id));
      toast({ title: 'Cliente eliminado' });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  function handleEdit(customer: Customer) {
    setEditingCustomer(customer);
    setFormData({
      cedula: customer.cedula,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
    });
    setIsDialogOpen(true);
  }

  function resetForm() {
    setFormData({ cedula: '', name: '', phone: '', email: '', address: '' });
    setEditingCustomer(null);
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.cedula.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona tu base de clientes ({customers.length} registrados)
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md mx-4">
              <DialogHeader>
                <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Registrar Cliente'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="cedula">Cédula *</Label>
                  <Input
                    id="cedula"
                    placeholder="V-12345678"
                    value={formData.cedula}
                    onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo *</Label>
                  <Input
                    id="name"
                    placeholder="Juan Pérez"
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
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección (opcional)</Label>
                  <Input
                    id="address"
                    placeholder="Av. Principal, Ciudad"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
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
                      editingCustomer ? 'Actualizar' : 'Guardar'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por cédula, nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-search"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Cargando clientes...</span>
          </div>
        ) : (
          <>
            {/* Customers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="glass-card rounded-xl p-4 md:p-5 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg text-foreground truncate">{customer.name}</h3>
                      <p className="text-sm text-primary font-medium">{customer.cedula}</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(customer)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(customer)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4 shrink-0" />
                      <span className="truncate">{customer.phone}</span>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="truncate">{customer.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <History className="w-4 h-4" />
                      <span className="text-xs sm:text-sm">
                        {new Date(customer.created_at).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => loadCustomerHistory(customer)}
                      className="gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Historial</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {filteredCustomers.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                </p>
                {searchQuery && (
                  <Button
                    className="mt-4 gap-2"
                    onClick={() => {
                      setFormData({ ...formData, cedula: searchQuery });
                      setIsDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Registrar nuevo cliente
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : customerOrders.length > 0 ? (
            <div className="space-y-3 mt-4">
              {customerOrders.map((order) => (
                <div key={order.id} className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-primary">{order.order_number}</span>
                    <StatusBadge status={order.status as any} />
                  </div>
                  <p className="text-sm text-foreground">
                    {order.device_brand} {order.device_model}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{order.reported_issue}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(order.created_at).toLocaleDateString('es-ES')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Este cliente no tiene órdenes registradas.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
