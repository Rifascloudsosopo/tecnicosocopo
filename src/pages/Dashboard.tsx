import { useState, useEffect } from 'react';
import {
  ClipboardList,
  Users,
  DollarSign,
  Package,
  Clock,
  AlertTriangle,
  TrendingUp,
  Wrench,
  Loader2,
  CloudOff,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { offlineStorage } from '@/lib/offlineStorage';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  totalCustomers: number;
  lowStockItems: number;
  totalRevenue: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  device_brand: string;
  device_model: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'abandoned';
  created_at: string;
  customers: {
    name: string;
  } | null;
}

export default function Dashboard() {
  const { isOnline, fetchAndCache } = useOfflineSync();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    completedOrders: 0,
    totalCustomers: 0,
    lowStockItems: 0,
    totalRevenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [isOnline]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      if (isOnline) {
        // Online: fetch from server with COUNT queries
        setIsFromCache(false);
        const [
          { count: totalOrders },
          { count: pendingOrders },
          { count: inProgressOrders },
          { count: completedCount },
          { count: deliveredCount },
          { count: customersCount },
          { data: revenueData },
          { data: lowStock },
          { data: recent },
        ] = await Promise.all([
          (supabase.from('service_orders') as any).select('id', { count: 'exact', head: true }),
          (supabase.from('service_orders') as any).select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          (supabase.from('service_orders') as any).select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
          (supabase.from('service_orders') as any).select('id', { count: 'exact', head: true }).eq('status', 'completed'),
          (supabase.from('service_orders') as any).select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
          (supabase.from('customers') as any).select('id', { count: 'exact', head: true }),
          (supabase.from('service_orders') as any).select('total_paid'),
          (supabase.from('spare_parts') as any).select('stock, min_stock'),
          (supabase.from('service_orders') as any)
            .select('id, order_number, device_brand, device_model, status, created_at, customers (name)')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        const totalRevenue = revenueData?.reduce((sum: number, o: any) => sum + (Number(o.total_paid) || 0), 0) || 0;
        const lowStockCount = lowStock?.filter((p: any) => (p.stock || 0) <= (p.min_stock || 5)).length || 0;

        setStats({
          totalOrders: totalOrders || 0,
          pendingOrders: pendingOrders || 0,
          inProgressOrders: inProgressOrders || 0,
          completedOrders: (completedCount || 0) + (deliveredCount || 0),
          totalCustomers: customersCount || 0,
          lowStockItems: lowStockCount,
          totalRevenue,
        });

        const transformedRecent = (recent || []).map(order => ({
          ...order,
          status: order.status as RecentOrder['status'],
          customers: Array.isArray(order.customers) 
            ? order.customers[0] || null 
            : order.customers,
        }));
        setRecentOrders(transformedRecent);

        // Cache orders for offline use
        if (recent && recent.length > 0) {
          await offlineStorage.putAll('service_orders', recent);
        }
      } else {
        // Offline: load from cache
        setIsFromCache(true);
        const cachedOrders = await offlineStorage.getAll<any>('service_orders');
        const cachedCustomers = await offlineStorage.getAll<any>('customers');
        const cachedParts = await offlineStorage.getAll<any>('spare_parts');

        const pendingOrders = cachedOrders.filter(o => o.status === 'pending').length;
        const inProgressOrders = cachedOrders.filter(o => o.status === 'in_progress').length;
        const completedOrders = cachedOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length;
        const totalRevenue = cachedOrders.reduce((sum, o) => sum + (Number(o.total_paid) || 0), 0);
        const lowStockCount = cachedParts.filter(p => (p.stock || 0) <= (p.min_stock || 5)).length;

        setStats({
          totalOrders: cachedOrders.length,
          pendingOrders,
          inProgressOrders,
          completedOrders,
          totalCustomers: cachedCustomers.length,
          lowStockItems: lowStockCount,
          totalRevenue,
        });

        // Get recent orders from cache
        const sortedOrders = [...cachedOrders]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);
        
        setRecentOrders(sortedOrders.map(order => ({
          ...order,
          status: order.status as RecentOrder['status'],
        })));
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      // Fallback to cache on error
      setIsFromCache(true);
      try {
        const cachedOrders = await offlineStorage.getAll<any>('service_orders');
        setStats(prev => ({
          ...prev,
          totalOrders: cachedOrders.length,
        }));
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Cargando dashboard...</span>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
            {isFromCache && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-warning/10 text-warning">
                <CloudOff className="w-3 h-3" />
                Datos locales
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Resumen general del taller
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
          <StatCard
            title="Órdenes Activas"
            value={stats.pendingOrders + stats.inProgressOrders}
            icon={ClipboardList}
          />
          <StatCard
            title="Ingresos Totales"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            iconClassName="bg-success/10 text-success"
          />
          <StatCard
            title="Clientes"
            value={stats.totalCustomers}
            icon={Users}
            iconClassName="bg-accent/10 text-accent"
          />
          <StatCard
            title="Stock Bajo"
            value={stats.lowStockItems}
            icon={Package}
            iconClassName="bg-warning/10 text-warning"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
          <Link to="/ordenes?status=pending" className="stat-card flex items-center gap-3 md:gap-4 hover:shadow-lg transition-shadow">
            <div className="p-2 md:p-3 rounded-xl bg-warning/10">
              <Clock className="w-5 h-5 md:w-6 md:h-6 text-warning" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{stats.pendingOrders}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Pendientes</p>
            </div>
          </Link>
          <Link to="/ordenes?status=in_progress" className="stat-card flex items-center gap-3 md:gap-4 hover:shadow-lg transition-shadow">
            <div className="p-2 md:p-3 rounded-xl bg-primary/10">
              <Wrench className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{stats.inProgressOrders}</p>
              <p className="text-xs md:text-sm text-muted-foreground">En Proceso</p>
            </div>
          </Link>
          <Link to="/ordenes?status=completed" className="stat-card flex items-center gap-3 md:gap-4 hover:shadow-lg transition-shadow">
            <div className="p-2 md:p-3 rounded-xl bg-success/10">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-success" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{stats.completedOrders}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Completados</p>
            </div>
          </Link>
          <Link to="/inventario" className="stat-card flex items-center gap-3 md:gap-4 hover:shadow-lg transition-shadow">
            <div className="p-2 md:p-3 rounded-xl bg-destructive/10">
              <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-destructive" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{stats.lowStockItems}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Bajo Stock</p>
            </div>
          </Link>
        </div>

        {/* Recent Orders Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 md:p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold">Órdenes Recientes</h2>
            <Link to="/ordenes" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 md:px-5 py-3 text-left text-xs md:text-sm">Orden</th>
                    <th className="px-4 md:px-5 py-3 text-left text-xs md:text-sm hidden sm:table-cell">Cliente</th>
                    <th className="px-4 md:px-5 py-3 text-left text-xs md:text-sm">Equipo</th>
                    <th className="px-4 md:px-5 py-3 text-left text-xs md:text-sm">Estado</th>
                    <th className="px-4 md:px-5 py-3 text-left text-xs md:text-sm hidden sm:table-cell">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 md:px-5 py-3 md:py-4">
                        <span className="font-medium text-primary text-sm">{order.order_number}</span>
                      </td>
                      <td className="px-4 md:px-5 py-3 md:py-4 text-foreground text-sm hidden sm:table-cell">
                        {order.customers?.name || 'N/A'}
                      </td>
                      <td className="px-4 md:px-5 py-3 md:py-4">
                        <span className="text-foreground text-sm">{order.device_brand}</span>
                        <span className="text-muted-foreground ml-1 text-xs">{order.device_model}</span>
                      </td>
                      <td className="px-4 md:px-5 py-3 md:py-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 md:px-5 py-3 md:py-4 text-muted-foreground text-sm hidden sm:table-cell">
                        {new Date(order.created_at).toLocaleDateString('es-ES')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No hay órdenes registradas</p>
              <Link to="/ordenes/nueva" className="text-primary hover:underline text-sm">
                Crear primera orden
              </Link>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
