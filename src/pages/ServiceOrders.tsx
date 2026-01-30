import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  Eye,
  MessageCircle,
  Printer,
  Loader2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  CreditCard,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useWhatsAppTemplates, openWhatsAppWithTemplate } from '@/hooks/useWhatsAppTemplates';
import { printTicket } from '@/lib/printTicket';
import { StatusChangeDialog } from '@/components/orders/StatusChangeDialog';
import { OrderCostsManager } from '@/components/orders/OrderCostsManager';
import { PaymentDialog } from '@/components/orders/PaymentDialog';
import { SimplePagination } from '@/components/ui/SimplePagination';

interface SparePartUsage {
  id: string;
  quantity: number;
  unit_price: number;
  spare_parts: {
    name: string;
  } | null;
}

interface AdditionalCost {
  id: string;
  description: string;
  amount: number;
}

interface ServiceOrder {
  id: string;
  order_number: string;
  customer_id: string;
  technician_id: string | null;
  device_brand: string;
  device_model: string;
  device_color: string | null;
  device_imei: string | null;
  reported_issue: string;
  aesthetic_notes: string | null;
  unlock_pin: string | null;
  unlock_pattern: string | null;
  account_password: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'abandoned';
  initial_budget: number;
  total_paid: number;
  additional_costs: number | null;
  warranty_days: number | null;
  delivered_at: string | null;
  warranty_expires_at: string | null;
  created_at: string;
  customers: {
    name: string;
    phone: string;
    cedula: string;
  } | null;
  technicians: {
    name: string;
  } | null;
  spare_parts_usage: SparePartUsage[];
  order_additional_costs: AdditionalCost[];
}

export default function ServiceOrders() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [costsDialogOrderId, setCostsDialogOrderId] = useState<string | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    orderId: string;
    orderNumber: string;
    pendingAmount: number;
  }>({ open: false, orderId: '', orderNumber: '', pendingAmount: 0 });
  const [statusChangeDialog, setStatusChangeDialog] = useState<{
    open: boolean;
    orderId: string;
    currentStatus: string;
    newStatus: string;
  }>({ open: false, orderId: '', currentStatus: '', newStatus: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { settings } = useCompanySettings();
  const { templates, getTemplateByStatus } = useWhatsAppTemplates();

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('service_orders') as any)
        .select(`
          *,
          customers (name, phone, cedula),
          technicians (name),
          spare_parts_usage (id, quantity, unit_price, spare_parts(name)),
          order_additional_costs (id, description, amount)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data || []) as unknown as ServiceOrder[]);
    } catch (error: any) {
      console.error('Error loading orders:', error);
      toast({
        title: 'Error al cargar órdenes',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customers?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.device_brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.device_model.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  function handleWhatsApp(order: ServiceOrder) {
    if (!order.customers?.phone) return;

    // Find template based on order status
    const template = getTemplateByStatus(order.status);
    const companyName = settings?.name || 'Taller Técnico';

    if (template) {
      // Use template from database
      openWhatsAppWithTemplate(
        order.customers.phone,
        template,
        order,
        companyName
      );
    } else {
      // Fallback message if no template found
      const pendingAmount = order.initial_budget - order.total_paid;
      const message = `Hola ${order.customers.name}, le escribimos de ${companyName} respecto a su orden ${order.order_number}. Equipo: ${order.device_brand} ${order.device_model}. Pendiente: $${pendingAmount.toFixed(2)}`;
      const cleanPhone = order.customers.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    }
  }

  function handlePrint(order: ServiceOrder, type: 'entry' | 'delivery' = 'entry') {
    printTicket(order, settings, type);
  }

  function handleStatusChange(orderId: string, currentStatus: string, newStatus: string) {
    if (currentStatus === newStatus) return;
    
    // Check if trying to mark as delivered with pending balance
    if (newStatus === 'delivered') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        const partsTotal = order.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
        const costsTotal = order.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
        const orderTotal = order.initial_budget + partsTotal + costsTotal;
        const pendingAmount = orderTotal - order.total_paid;
        
        if (pendingAmount > 0) {
          toast({
            title: 'Pago pendiente',
            description: `No se puede marcar como entregado. El cliente debe $${pendingAmount.toFixed(2)} pendiente.`,
            variant: 'destructive',
          });
          return;
        }
      }
    }
    
    setStatusChangeDialog({
      open: true,
      orderId,
      currentStatus,
      newStatus,
    });
  }

  async function confirmStatusChange() {
    const { orderId, newStatus } = statusChangeDialog;
    setStatusChangeDialog({ ...statusChangeDialog, open: false });

    try {
      const updates: any = { status: newStatus };
      
      if (newStatus === 'delivered') {
        const order = orders.find(o => o.id === orderId);
        const warrantyDays = order?.warranty_days || 30;
        const deliveredAt = new Date();
        const warrantyExpiresAt = new Date(deliveredAt);
        warrantyExpiresAt.setDate(warrantyExpiresAt.getDate() + warrantyDays);
        
        updates.delivered_at = deliveredAt.toISOString();
        updates.warranty_expires_at = warrantyExpiresAt.toISOString();
      }

      const { error } = await (supabase
        .from('service_orders') as any)
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus as ServiceOrder['status'] } : o
      ));
      
      toast({ title: 'Estado actualizado' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  function toggleExpand(orderId: string) {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  // Mobile Card View
  const OrderCard = ({ order }: { order: ServiceOrder }) => {
    const isExpanded = expandedOrders.has(order.id);

    return (
      <div className="glass-card rounded-xl overflow-hidden">
        <div 
          className="p-4 cursor-pointer"
          onClick={() => toggleExpand(order.id)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-primary">{order.order_number}</span>
            <StatusBadge status={order.status} />
          </div>
          <p className="font-medium text-foreground">{order.customers?.name || 'N/A'}</p>
          <p className="text-sm text-muted-foreground">
            {order.device_brand} {order.device_model}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{new Date(order.created_at).toLocaleDateString('es-ES')}</span>
            <div className="flex items-center gap-1">
              {(() => {
                const partsTotal = order.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
                const costsTotal = order.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
                const orderTotal = order.initial_budget + partsTotal + costsTotal;
                return <span>${orderTotal.toFixed(2)}</span>;
              })()}
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Falla reportada</p>
              <p className="text-sm">{order.reported_issue}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Técnico:</span>
              <span className="text-sm">{order.technicians?.name || 'Sin asignar'}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pagado:</span>
              {(() => {
                const partsTotal = order.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
                const costsTotal = order.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
                const orderTotal = order.initial_budget + partsTotal + costsTotal;
                return <span className="text-sm font-medium">${order.total_paid.toFixed(2)} / ${orderTotal.toFixed(2)}</span>;
              })()}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pendiente:</span>
              {(() => {
                const partsTotal = order.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
                const costsTotal = order.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
                const orderTotal = order.initial_budget + partsTotal + costsTotal;
                const pendingAmount = orderTotal - order.total_paid;
                return (
                  <span className={`text-sm font-semibold ${pendingAmount > 0 ? 'text-destructive' : 'text-success'}`}>
                    ${pendingAmount.toFixed(2)}
                  </span>
                );
              })()}
            </div>

            <Select
              value={order.status}
              onValueChange={(value) => handleStatusChange(order.id, order.status, value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Cambiar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En Proceso</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="delivered">Entregado</SelectItem>
                <SelectItem value="abandoned">Abandonado</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setSelectedOrder(order)}
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setCostsDialogOrderId(order.id)}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Costos
              </Button>
              {(() => {
                const partsTotal = order.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
                const costsTotal = order.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
                const orderTotal = order.initial_budget + partsTotal + costsTotal;
                const pendingAmount = orderTotal - order.total_paid;
                return pendingAmount > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-primary border-primary/30"
                    onClick={() => setPaymentDialog({
                      open: true,
                      orderId: order.id,
                      orderNumber: order.order_number,
                      pendingAmount,
                    })}
                  >
                    <CreditCard className="w-4 h-4 mr-1" />
                    Pagar
                  </Button>
                ) : null;
              })()}
              {order.customers?.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-success border-success/30"
                  onClick={() => handleWhatsApp(order)}
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrint(order, order.status === 'delivered' ? 'delivery' : 'entry')}
              >
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Órdenes de Servicio</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona las reparaciones ({orders.length} órdenes)
            </p>
          </div>
          <Link to="/ordenes/nueva" className="w-full sm:w-auto">
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Nueva Orden
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por orden, cliente o equipo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground hidden sm:block" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En Proceso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                  <SelectItem value="abandoned">Abandonado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Cargando órdenes...</span>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            {isMobile ? (
              <div className="space-y-4">
                {paginatedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
                <SimplePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filteredOrders.length}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            ) : (
              /* Desktop Table View */
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                      <tr className="table-header">
                        <th className="px-3 py-2 text-left text-xs">Orden</th>
                        <th className="px-3 py-2 text-left text-xs">Cliente</th>
                        <th className="px-3 py-2 text-left text-xs">Equipo</th>
                        <th className="px-3 py-2 text-left text-xs">Falla</th>
                        <th className="px-3 py-2 text-left text-xs">Técnico</th>
                        <th className="px-3 py-2 text-left text-xs">Estado</th>
                        <th className="px-3 py-2 text-left text-xs">Total</th>
                        <th className="px-3 py-2 text-left text-xs">Pendiente</th>
                        <th className="px-3 py-2 text-center text-xs">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2">
                            <span className="font-semibold text-primary text-sm">{order.order_number}</span>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString('es-ES')}
                            </p>
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground text-sm">{order.customers?.name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{order.customers?.phone}</p>
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground text-sm">{order.device_brand}</p>
                            <p className="text-xs text-muted-foreground">{order.device_model}</p>
                          </td>
                          <td className="px-3 py-2 max-w-[120px]">
                            <p className="text-xs text-foreground truncate" title={order.reported_issue}>{order.reported_issue}</p>
                          </td>
                          <td className="px-3 py-2">
                            {order.technicians?.name ? (
                              <span className="text-foreground text-sm">{order.technicians.name}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">Sin asignar</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={order.status}
                              onValueChange={(value) => handleStatusChange(order.id, order.status, value)}
                            >
                              <SelectTrigger className="w-28 h-7 text-xs">
                                <StatusBadge status={order.status} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendiente</SelectItem>
                                <SelectItem value="in_progress">En Proceso</SelectItem>
                                <SelectItem value="completed">Completado</SelectItem>
                                <SelectItem value="delivered">Entregado</SelectItem>
                                <SelectItem value="abandoned">Abandonado</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            {(() => {
                              const partsTotal = order.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
                              const costsTotal = order.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
                              const orderTotal = order.initial_budget + partsTotal + costsTotal;
                              return (
                                <p className="font-semibold text-foreground text-sm">${orderTotal.toFixed(2)}</p>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2">
                            {(() => {
                              const partsTotal = order.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
                              const costsTotal = order.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
                              const orderTotal = order.initial_budget + partsTotal + costsTotal;
                              const pendingAmount = orderTotal - order.total_paid;
                              return (
                                <p className={`font-semibold text-sm ${pendingAmount > 0 ? 'text-destructive' : 'text-success'}`}>
                                  ${pendingAmount.toFixed(2)}
                                </p>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Ver detalle"
                                onClick={() => setSelectedOrder(order)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Repuestos y Costos"
                                onClick={() => setCostsDialogOrderId(order.id)}
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </Button>
                              {(() => {
                                const partsTotal = order.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
                                const costsTotal = order.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
                                const orderTotal = order.initial_budget + partsTotal + costsTotal;
                                const pendingAmount = orderTotal - order.total_paid;
                                return pendingAmount > 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-primary hover:text-primary"
                                    title="Registrar Pago"
                                    onClick={() => setPaymentDialog({
                                      open: true,
                                      orderId: order.id,
                                      orderNumber: order.order_number,
                                      pendingAmount,
                                    })}
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                  </Button>
                                ) : null;
                              })()}
                              {order.customers?.phone && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-success hover:text-success"
                                  title="WhatsApp"
                                  onClick={() => handleWhatsApp(order)}
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title={order.status === 'delivered' ? 'Imprimir Entrega' : 'Imprimir Entrada'}
                                onClick={() => handlePrint(order, order.status === 'delivered' ? 'delivery' : 'entry')}
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <SimplePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filteredOrders.length}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            )}

            {filteredOrders.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No se encontraron órdenes</p>
                <Link to="/ordenes/nueva">
                  <Button className="mt-4 gap-2">
                    <Plus className="w-4 h-4" />
                    Crear primera orden
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Orden {selectedOrder?.order_number}</span>
              {selectedOrder?.status && <StatusBadge status={selectedOrder.status} />}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 mt-4">
              {/* Customer Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Cliente</h4>
                <p className="text-foreground">{selectedOrder.customers?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customers?.cedula}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customers?.phone}</p>
              </div>

              {/* Device Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Equipo</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Marca:</span>
                    <p className="font-medium">{selectedOrder.device_brand}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Modelo:</span>
                    <p className="font-medium">{selectedOrder.device_model}</p>
                  </div>
                  {selectedOrder.device_color && (
                    <div>
                      <span className="text-muted-foreground">Color:</span>
                      <p className="font-medium">{selectedOrder.device_color}</p>
                    </div>
                  )}
                  {selectedOrder.device_imei && (
                    <div>
                      <span className="text-muted-foreground">IMEI:</span>
                      <p className="font-medium">{selectedOrder.device_imei}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Issue */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Falla Reportada</h4>
                <p className="text-sm">{selectedOrder.reported_issue}</p>
                {selectedOrder.aesthetic_notes && (
                  <>
                    <h4 className="font-medium mt-3 mb-2">Notas Estéticas</h4>
                    <p className="text-sm">{selectedOrder.aesthetic_notes}</p>
                  </>
                )}
              </div>

              {/* Spare Parts Used */}
              {selectedOrder.spare_parts_usage && selectedOrder.spare_parts_usage.length > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Repuestos Utilizados</h4>
                  <div className="space-y-1">
                    {selectedOrder.spare_parts_usage.map((usage) => (
                      <div key={usage.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {usage.spare_parts?.name} x{usage.quantity}
                        </span>
                        <span className="font-medium">${(usage.quantity * usage.unit_price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Costs */}
              {selectedOrder.order_additional_costs && selectedOrder.order_additional_costs.length > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Costos Adicionales</h4>
                  <div className="space-y-1">
                    {selectedOrder.order_additional_costs.map((cost) => (
                      <div key={cost.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{cost.description}</span>
                        <span className="font-medium">${cost.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financials */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Información Financiera</h4>
                {(() => {
                  const partsTotal = selectedOrder.spare_parts_usage?.reduce((sum, u) => sum + u.quantity * u.unit_price, 0) || 0;
                  const costsTotal = selectedOrder.order_additional_costs?.reduce((sum, c) => sum + c.amount, 0) || 0;
                  const orderTotal = selectedOrder.initial_budget + partsTotal + costsTotal;
                  const pending = orderTotal - selectedOrder.total_paid;
                  
                  return (
                    <>
                      {selectedOrder.initial_budget > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Monto base:</span>
                          <span className="font-medium">${selectedOrder.initial_budget.toFixed(2)}</span>
                        </div>
                      )}
                      {partsTotal > 0 && (
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Repuestos:</span>
                          <span className="font-medium">${partsTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {costsTotal > 0 && (
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Extras (mano de obra):</span>
                          <span className="font-medium">${costsTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm mt-1 pt-1 border-t">
                        <span className="text-muted-foreground font-semibold">Total:</span>
                        <span className="font-bold">${orderTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Pagado:</span>
                        <span className="font-medium text-success">${selectedOrder.total_paid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Pendiente:</span>
                        <span className={`font-medium ${pending > 0 ? 'text-warning' : 'text-success'}`}>
                          ${pending.toFixed(2)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Warranty Info */}
              {selectedOrder.status === 'delivered' && selectedOrder.warranty_expires_at && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Garantía</h4>
                  {(() => {
                    const expiresAt = new Date(selectedOrder.warranty_expires_at);
                    const now = new Date();
                    const diffTime = expiresAt.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isExpired = diffDays < 0;
                    
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Días de garantía:</span>
                          <span className="font-medium">{selectedOrder.warranty_days || 30} días</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Entregado:</span>
                          <span className="font-medium">
                            {selectedOrder.delivered_at 
                              ? new Date(selectedOrder.delivered_at).toLocaleDateString('es-ES') 
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Vence:</span>
                          <span className="font-medium">
                            {expiresAt.toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Estado:</span>
                          {isExpired ? (
                            <span className="font-medium text-destructive">Vencida</span>
                          ) : (
                            <span className="font-medium text-success">{diffDays} días restantes</span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {selectedOrder.customers?.phone && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => {
                      handleWhatsApp(selectedOrder);
                      setSelectedOrder(null);
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={() => {
                    handlePrint(selectedOrder, 'entry');
                  }}
                >
                  <Printer className="w-4 h-4" />
                  Ticket Entrada
                </Button>
                {selectedOrder.status === 'completed' || selectedOrder.status === 'delivered' ? (
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={() => {
                      handlePrint(selectedOrder, 'delivery');
                    }}
                  >
                    <Printer className="w-4 h-4" />
                    Ticket Entrega
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation Dialog */}
      <StatusChangeDialog
        open={statusChangeDialog.open}
        onOpenChange={(open) => setStatusChangeDialog({ ...statusChangeDialog, open })}
        currentStatus={statusChangeDialog.currentStatus}
        newStatus={statusChangeDialog.newStatus}
        onConfirm={confirmStatusChange}
      />

      {/* Order Costs Manager Dialog */}
      {costsDialogOrderId && (
        <OrderCostsManager
          orderId={costsDialogOrderId}
          open={!!costsDialogOrderId}
          onOpenChange={(open) => !open && setCostsDialogOrderId(null)}
          onUpdate={loadOrders}
        />
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialog.open}
        onOpenChange={(open) => setPaymentDialog({ ...paymentDialog, open })}
        orderId={paymentDialog.orderId}
        orderNumber={paymentDialog.orderNumber}
        pendingAmount={paymentDialog.pendingAmount}
        onPaymentComplete={loadOrders}
      />
    </MainLayout>
  );
}
