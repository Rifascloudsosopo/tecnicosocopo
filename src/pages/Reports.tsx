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
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { startOfWeek, startOfMonth, startOfYear, endOfDay, format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReportStats {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  completedOrders: number;
  avgRepairTime: number;
  customersServed: number;
  successRate: number;
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

export default function Reports() {
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReportStats>({
    totalRevenue: 0,
    totalCosts: 0,
    netProfit: 0,
    completedOrders: 0,
    avgRepairTime: 0,
    customersServed: 0,
    successRate: 0,
  });
  const [brandData, setBrandData] = useState<BrandData[]>([]);
  const [issueData, setIssueData] = useState<IssueData[]>([]);
  const [technicianStats, setTechnicianStats] = useState<TechnicianStats[]>([]);
  const [revenueData, setRevenueData] = useState<DailyRevenue[]>([]);

  useEffect(() => {
    loadReportData();
  }, [period]);

  function getDateRange() {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

    return { startDate: startDate.toISOString(), endDate: endOfDay(now).toISOString() };
  }

  async function loadReportData() {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Fetch orders in date range
      const { data: orders } = await supabase
        .from('service_orders')
        .select(`
          id, status, initial_budget, total_paid, created_at, delivered_at,
          device_brand, reported_issue, technician_id,
          technicians (name)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Fetch spare parts usage for costs
      const { data: partsUsage } = await supabase
        .from('spare_parts_usage')
        .select('unit_price, quantity, order_id')
        .in('order_id', orders?.map(o => o.id) || []);

      // Calculate stats
      const completedOrders = orders?.filter(o => 
        o.status === 'completed' || o.status === 'delivered'
      ) || [];
      
      const totalRevenue = orders?.reduce((sum, o) => sum + (Number(o.total_paid) || 0), 0) || 0;
      const totalCosts = partsUsage?.reduce((sum, p) => 
        sum + (Number(p.unit_price) * (p.quantity || 1)), 0
      ) || 0;

      // Calculate average repair time (in days)
      let avgTime = 0;
      const ordersWithDelivery = completedOrders.filter(o => o.delivered_at);
      if (ordersWithDelivery.length > 0) {
        const totalDays = ordersWithDelivery.reduce((sum, o) => {
          const created = new Date(o.created_at);
          const delivered = new Date(o.delivered_at!);
          return sum + (delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        avgTime = totalDays / ordersWithDelivery.length;
      }

      // Get unique customers
      const { count: customersCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true });

      setStats({
        totalRevenue,
        totalCosts,
        netProfit: totalRevenue - totalCosts,
        completedOrders: completedOrders.length,
        avgRepairTime: Math.round(avgTime * 10) / 10,
        customersServed: customersCount || 0,
        successRate: orders?.length ? Math.round((completedOrders.length / orders.length) * 100) : 0,
      });

      // Calculate brand distribution
      const brandCounts: Record<string, number> = {};
      orders?.forEach(o => {
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
      orders?.forEach(o => {
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
      completedOrders.forEach(o => {
        const techName = (o.technicians as any)?.name || 'Sin asignar';
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
        
        const dayOrders = orders?.filter(o => 
          o.created_at?.startsWith(dateStr)
        ) || [];
        
        const dayParts = partsUsage?.filter(p => 
          dayOrders.some(o => o.id === p.order_id)
        ) || [];

        return {
          name: dayName.charAt(0).toUpperCase() + dayName.slice(1),
          ingresos: dayOrders.reduce((sum, o) => sum + (Number(o.total_paid) || 0), 0),
          gastos: dayParts.reduce((sum, p) => sum + (Number(p.unit_price) * (p.quantity || 1)), 0),
        };
      });

      setRevenueData(dailyData);

    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  }

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
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="year">Este Año</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
          <StatCard
            title="Ingresos Brutos"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            iconClassName="bg-success/10 text-success"
          />
          <StatCard
            title="Gastos Repuestos"
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
            title="Completadas"
            value={stats.completedOrders.toString()}
            icon={Wrench}
            iconClassName="bg-accent/10 text-accent"
          />
        </div>

        <Tabs defaultValue="financial" className="space-y-6">
          <TabsList className="w-full flex overflow-x-auto">
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
                  <div className="space-y-4">
                    {technicianStats.map((tech) => (
                      <div key={tech.name} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/50 rounded-lg gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Wrench className="w-5 h-5 text-primary" />
                          </div>
                          <span className="font-medium">{tech.name}</span>
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
