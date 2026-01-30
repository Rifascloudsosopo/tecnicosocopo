import { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Wrench,
  Clock,
  BarChart3,
  PieChart,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  List,
  Package,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, startOfMonth, startOfYear, endOfDay, format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface ReportStats {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  completedOrders: number;
  avgRepairTime: number;
  customersServed: number;
  successRate: number;
  sparePartsEarnings: number;
  laborEarnings: number;
}

interface BrandData {
  name: string;
  value: number;
  color: string;
}

interface IssueData {
  name: string;
  cantidad: number;
}

interface TechnicianStats {
  name: string;
  completadas: number;
  tiempo_promedio: number;
}

interface DailyRevenue {
  name: string;
  ingresos: number;
  gastos: number;
}

interface OrderTransaction {
  id: string;
  order_number: string;
  customer_name: string;
  device: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'abandoned';
  total: number;
  paid: number;
  pending: number;
  created_at: string;
}

interface PaymentTransaction {
  id: string;
  order_number: string;
  customer_name: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

export default function Reports() {
  const [period, setPeriod] = useState('week');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [stats, setStats] = useState<ReportStats>({
    totalRevenue: 0,
    totalCosts: 0,
    netProfit: 0,
    completedOrders: 0,
    avgRepairTime: 0,
    customersServed: 0,
    successRate: 0,
    sparePartsEarnings: 0,
    laborEarnings: 0,
  });
  const [brandData, setBrandData] = useState<BrandData[]>([]);
  const [issueData, setIssueData] = useState<IssueData[]>([]);
  const [technicianStats, setTechnicianStats] = useState<TechnicianStats[]>([]);
  const [revenueData, setRevenueData] = useState<DailyRevenue[]>([]);
  const [orderTransactions, setOrderTransactions] = useState<OrderTransaction[]>([]);
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>([]);

  useEffect(() => {
    loadReportData();
  }, [period, customDateFrom, customDateTo]);

  function getDateRange() {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfDay(now);

    if (period === 'custom' && customDateFrom) {
      startDate = startOfDay(customDateFrom);
      endDate = customDateTo ? endOfDay(customDateTo) : endOfDay(customDateFrom);
    } else {
      switch (period) {
        case 'today':
          startDate = startOfDay(now);
          break;
        case 'week':
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'month':
          startDate = startOfMonth(now);
          break;
        case 'year':
          startDate = startOfYear(now);
          break;
        default:
          startDate = startOfWeek(now, { weekStartsOn: 1 });
      }
    }

    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  }

  async function loadReportData() {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Fetch orders in date range with related data
      const { data: orders } = await (supabase
        .from('service_orders') as any)
        .select(`
          id, order_number, status, initial_budget, total_paid, created_at, delivered_at,
          device_brand, device_model, reported_issue, technician_id,
          customers (name, phone),
          technicians (name),
          spare_parts_usage (id, quantity, unit_price),
          order_additional_costs (id, amount)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      // Fetch payments in date range
      const { data: payments } = await (supabase
        .from('order_payments') as any)
        .select(`
          id, amount, payment_method, notes, created_at, order_id,
          service_orders (order_number, customers (name))
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      // Calculate order transactions
      const transactions: OrderTransaction[] = (orders || []).map((o: any) => {
        const partsTotal = o.spare_parts_usage?.reduce((sum: number, u: any) => sum + u.quantity * u.unit_price, 0) || 0;
        const costsTotal = o.order_additional_costs?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
        const total = (o.initial_budget || 0) + partsTotal + costsTotal;
        const paid = o.total_paid || 0;
        return {
          id: o.id,
          order_number: o.order_number,
          customer_name: o.customers?.name || 'N/A',
          device: `${o.device_brand} ${o.device_model}`,
          status: o.status,
          total,
          paid,
          pending: total - paid,
          created_at: o.created_at,
        };
      });
      setOrderTransactions(transactions);

      // Calculate payment transactions
      const paymentTx: PaymentTransaction[] = (payments || []).map((p: any) => ({
        id: p.id,
        order_number: p.service_orders?.order_number || 'N/A',
        customer_name: p.service_orders?.customers?.name || 'N/A',
        amount: p.amount,
        payment_method: p.payment_method,
        notes: p.notes,
        created_at: p.created_at,
      }));
      setPaymentTransactions(paymentTx);

      // Calculate stats
      const completedOrders = orders?.filter((o: any) => 
        o.status === 'completed' || o.status === 'delivered'
      ) || [];
      
      const totalRevenue = payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
      
      // Total costs from spare parts usage (purchase price - for cost calculation)
      const totalCosts = orders?.reduce((sum: number, o: any) => {
        const partsCost = o.spare_parts_usage?.reduce((s: number, u: any) => s + (u.quantity * u.unit_price), 0) || 0;
        return sum + partsCost;
      }, 0) || 0;

      // Calculate spare parts earnings (sale price of parts used)
      const sparePartsEarnings = orders?.reduce((sum: number, o: any) => {
        const partsTotal = o.spare_parts_usage?.reduce((s: number, u: any) => s + (u.quantity * u.unit_price), 0) || 0;
        return sum + partsTotal;
      }, 0) || 0;

      // Calculate labor earnings (additional costs / extras)
      const laborEarnings = orders?.reduce((sum: number, o: any) => {
        const costsTotal = o.order_additional_costs?.reduce((s: number, c: any) => s + c.amount, 0) || 0;
        return sum + costsTotal;
      }, 0) || 0;

      // Calculate average repair time (in days)
      let avgTime = 0;
      const ordersWithDelivery = completedOrders.filter((o: any) => o.delivered_at);
      if (ordersWithDelivery.length > 0) {
        const totalDays = ordersWithDelivery.reduce((sum: number, o: any) => {
          const created = new Date(o.created_at);
          const delivered = new Date(o.delivered_at!);
          return sum + (delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        avgTime = totalDays / ordersWithDelivery.length;
      }

      // Get unique customers
      const { count: customersCount } = await (supabase
        .from('customers') as any)
        .select('id', { count: 'exact', head: true });

      setStats({
        totalRevenue,
        totalCosts,
        netProfit: totalRevenue - totalCosts,
        completedOrders: completedOrders.length,
        avgRepairTime: Math.round(avgTime * 10) / 10,
        customersServed: customersCount || 0,
        successRate: orders?.length ? Math.round((completedOrders.length / orders.length) * 100) : 0,
        sparePartsEarnings,
        laborEarnings,
      });

      // Calculate brand distribution
      const brandCounts: Record<string, number> = {};
      orders?.forEach((o: any) => {
        const brand = o.device_brand || 'Otro';
        brandCounts[brand] = (brandCounts[brand] || 0) + 1;
      });

      const brandColors = [
        'hsl(220, 70%, 50%)',
        'hsl(0, 0%, 20%)',
        'hsl(25, 95%, 55%)',
        'hsl(0, 72%, 51%)',
        'hsl(215, 16%, 47%)',
        'hsl(150, 70%, 40%)',
      ];

      const sortedBrands = Object.entries(brandCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count], i) => ({
          name,
          value: Math.round((count / (orders?.length || 1)) * 100),
          color: brandColors[i % brandColors.length],
        }));

      setBrandData(sortedBrands);

      // Calculate issue distribution
      const issueCounts: Record<string, number> = {};
      orders?.forEach((o: any) => {
        const issue = o.reported_issue?.toLowerCase() || '';
        if (issue.includes('pantalla')) issueCounts['Pantalla rota'] = (issueCounts['Pantalla rota'] || 0) + 1;
        else if (issue.includes('batería') || issue.includes('bateria')) issueCounts['Batería'] = (issueCounts['Batería'] || 0) + 1;
        else if (issue.includes('carga') || issue.includes('conector')) issueCounts['Conector carga'] = (issueCounts['Conector carga'] || 0) + 1;
        else if (issue.includes('software') || issue.includes('sistema')) issueCounts['Software'] = (issueCounts['Software'] || 0) + 1;
        else if (issue.includes('cámara') || issue.includes('camara')) issueCounts['Cámara'] = (issueCounts['Cámara'] || 0) + 1;
        else issueCounts['Otros'] = (issueCounts['Otros'] || 0) + 1;
      });

      const sortedIssues = Object.entries(issueCounts)
        .map(([name, cantidad]) => ({ name, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

      setIssueData(sortedIssues);

      // Calculate technician stats
      const techStats: Record<string, { completadas: number; totalDays: number; count: number }> = {};
      completedOrders.forEach((o: any) => {
        const techName = o.technicians?.name || 'Sin asignar';
        if (!techStats[techName]) {
          techStats[techName] = { completadas: 0, totalDays: 0, count: 0 };
        }
        techStats[techName].completadas++;
        if (o.delivered_at) {
          const days = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24);
          techStats[techName].totalDays += days;
          techStats[techName].count++;
        }
      });

      const techArray = Object.entries(techStats)
        .filter(([name]) => name !== 'Sin asignar')
        .map(([name, stats]) => ({
          name,
          completadas: stats.completadas,
          tiempo_promedio: stats.count > 0 ? Math.round((stats.totalDays / stats.count) * 10) / 10 : 0,
        }))
        .sort((a, b) => b.completadas - a.completadas);

      setTechnicianStats(techArray);

      // Calculate daily revenue for chart
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        return format(date, 'EEE', { locale: es });
      });

      const dailyData = last7Days.map((dayName, i) => {
        const date = subDays(new Date(), 6 - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const dayPayments = payments?.filter((p: any) => 
          p.created_at?.startsWith(dateStr)
        ) || [];
        
        const dayOrders = orders?.filter((o: any) => 
          o.created_at?.startsWith(dateStr)
        ) || [];

        const dayExpenses = dayOrders.reduce((sum: number, o: any) => {
          return sum + (o.spare_parts_usage?.reduce((s: number, u: any) => s + u.quantity * u.unit_price, 0) || 0);
        }, 0);

        return {
          name: dayName.charAt(0).toUpperCase() + dayName.slice(1),
          ingresos: dayPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0),
          gastos: dayExpenses,
        };
      });

      setRevenueData(dailyData);

    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  }

  const paymentMethodLabels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    mobile_payment: 'Pago Móvil',
    other: 'Otro',
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Cargando reportes...</span>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Reportes</h1>
            <p className="text-muted-foreground mt-1">
              Métricas y estadísticas del taller
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mes</SelectItem>
                <SelectItem value="year">Este Año</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            
            {period === 'custom' && (
              <div className="flex gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Calendar className="w-4 h-4" />
                      {customDateFrom ? format(customDateFrom, 'dd/MM/yy') : 'Desde'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customDateFrom}
                      onSelect={setCustomDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">-</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Calendar className="w-4 h-4" />
                      {customDateTo ? format(customDateTo, 'dd/MM/yy') : 'Hasta'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customDateTo}
                      onSelect={setCustomDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard
            title="Ingresos Cobrados"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            iconClassName="bg-success/10 text-success"
          />
          <StatCard
            title="Costo Repuestos"
            value={`$${stats.totalCosts.toLocaleString()}`}
            icon={TrendingDown}
            iconClassName="bg-destructive/10 text-destructive"
          />
          <StatCard
            title="Ganancia Neta"
            value={`$${stats.netProfit.toLocaleString()}`}
            icon={TrendingUp}
            iconClassName="bg-primary/10 text-primary"
          />
          <StatCard
            title="Gan. Repuestos"
            value={`$${stats.sparePartsEarnings.toLocaleString()}`}
            icon={Package}
            iconClassName="bg-accent/10 text-accent"
          />
          <StatCard
            title="Mano de Obra"
            value={`$${stats.laborEarnings.toLocaleString()}`}
            icon={Wrench}
            iconClassName="bg-warning/10 text-warning"
          />
          <StatCard
            title="Completadas"
            value={stats.completedOrders.toString()}
            icon={BarChart3}
            iconClassName="bg-secondary text-secondary-foreground"
          />
        </div>

        <Tabs defaultValue="transactions" className="space-y-6">
          <TabsList className="w-full flex overflow-x-auto">
            <TabsTrigger value="transactions" className="gap-2 flex-1">
              <List className="w-4 h-4 hidden sm:block" />
              Transacciones
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2 flex-1">
              <BarChart3 className="w-4 h-4 hidden sm:block" />
              Financiero
            </TabsTrigger>
            <TabsTrigger value="operations" className="gap-2 flex-1">
              <Clock className="w-4 h-4 hidden sm:block" />
              Operativo
            </TabsTrigger>
            <TabsTrigger value="statistics" className="gap-2 flex-1">
              <PieChart className="w-4 h-4 hidden sm:block" />
              Estadísticas
            </TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            {/* Orders List */}
            <Card className="glass-card">
              <CardHeader 
                className="cursor-pointer"
                onClick={() => setExpandedSection(expandedSection === 'orders' ? null : 'orders')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-primary" />
                    Órdenes del Período ({orderTransactions.length})
                  </CardTitle>
                  {expandedSection === 'orders' ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              {expandedSection === 'orders' && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Orden</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cliente</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Equipo</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Pagado</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Pendiente</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {orderTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-sm font-medium text-primary">{tx.order_number}</td>
                            <td className="px-3 py-2 text-sm">{tx.customer_name}</td>
                            <td className="px-3 py-2 text-sm text-muted-foreground">{tx.device}</td>
                            <td className="px-3 py-2">
                              <StatusBadge status={tx.status} />
                            </td>
                            <td className="px-3 py-2 text-sm text-right font-medium">${tx.total.toFixed(2)}</td>
                            <td className="px-3 py-2 text-sm text-right text-success">${tx.paid.toFixed(2)}</td>
                            <td className={cn(
                              "px-3 py-2 text-sm text-right font-medium",
                              tx.pending > 0 ? "text-destructive" : "text-success"
                            )}>
                              ${tx.pending.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {format(new Date(tx.created_at), 'dd/MM/yy HH:mm')}
                            </td>
                          </tr>
                        ))}
                        {orderTransactions.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                              No hay órdenes en este período
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="border-t-2 border-border">
                        <tr className="font-semibold">
                          <td colSpan={4} className="px-3 py-2 text-sm">Totales</td>
                          <td className="px-3 py-2 text-sm text-right">
                            ${orderTransactions.reduce((s, t) => s + t.total, 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-success">
                            ${orderTransactions.reduce((s, t) => s + t.paid, 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-destructive">
                            ${orderTransactions.reduce((s, t) => s + t.pending, 0).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Payments List */}
            <Card className="glass-card">
              <CardHeader 
                className="cursor-pointer"
                onClick={() => setExpandedSection(expandedSection === 'payments' ? null : 'payments')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-success" />
                    Pagos Recibidos ({paymentTransactions.length})
                  </CardTitle>
                  {expandedSection === 'payments' ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              {expandedSection === 'payments' && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Orden</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cliente</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Monto</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Método</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Notas</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paymentTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-sm font-medium text-primary">{tx.order_number}</td>
                            <td className="px-3 py-2 text-sm">{tx.customer_name}</td>
                            <td className="px-3 py-2 text-sm text-right font-semibold text-success">
                              ${tx.amount.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span className="status-badge bg-secondary text-secondary-foreground text-xs px-2 py-0.5">
                                {paymentMethodLabels[tx.payment_method] || tx.payment_method}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground max-w-32 truncate">
                              {tx.notes || '-'}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {format(new Date(tx.created_at), 'dd/MM/yy HH:mm')}
                            </td>
                          </tr>
                        ))}
                        {paymentTransactions.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                              No hay pagos en este período
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="border-t-2 border-border">
                        <tr className="font-semibold">
                          <td colSpan={2} className="px-3 py-2 text-sm">Total Cobrado</td>
                          <td className="px-3 py-2 text-sm text-right text-success">
                            ${paymentTransactions.reduce((s, t) => s + t.amount, 0).toFixed(2)}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Órdenes</p>
                <p className="text-2xl font-bold">{orderTransactions.length}</p>
              </div>
              <div className="p-4 bg-success/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Cobrado</p>
                <p className="text-2xl font-bold text-success">
                  ${paymentTransactions.reduce((s, t) => s + t.amount, 0).toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-destructive/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Pendiente</p>
                <p className="text-2xl font-bold text-destructive">
                  ${orderTransactions.reduce((s, t) => s + t.pending, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Ingresos vs Gastos (Últimos 7 días)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 md:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [`$${value}`, '']}
                      />
                      <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="gastos" name="Gastos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 mb-6">
              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tiempo Promedio</p>
                    <p className="text-2xl font-bold">{stats.avgRepairTime} días</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-accent" />
                  <div>
                    <p className="text-sm text-muted-foreground">Clientes Totales</p>
                    <p className="text-2xl font-bold">{stats.customersServed}</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tasa de Éxito</p>
                    <p className="text-2xl font-bold">{stats.successRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {technicianStats.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Rendimiento por Técnico</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {technicianStats.map((tech) => (
                      <div key={tech.name} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted/50 rounded-lg gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Wrench className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium text-sm">{tech.name}</span>
                        </div>
                        <div className="flex items-center gap-6 sm:gap-8 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-center">
                            <p className="text-lg font-bold text-success">{tech.completadas}</p>
                            <p className="text-xs text-muted-foreground">Completadas</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold">{tech.tiempo_promedio} días</p>
                            <p className="text-xs text-muted-foreground">Tiempo Prom.</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {technicianStats.length === 0 && (
              <Card className="glass-card">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No hay datos de rendimiento de técnicos para el período seleccionado.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Equipos por Marca</CardTitle>
                </CardHeader>
                <CardContent>
                  {brandData.length > 0 ? (
                    <>
                      <div className="h-52 md:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={brandData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {brandData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`${value}%`, '']} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-4">
                        {brandData.map((item) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              {item.name} ({item.value}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Sin datos para el período seleccionado
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Fallas Más Comunes</CardTitle>
                </CardHeader>
                <CardContent>
                  {issueData.length > 0 ? (
                    <div className="h-52 md:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={issueData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis dataKey="name" type="category" width={90} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="cantidad" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Sin datos para el período seleccionado
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
