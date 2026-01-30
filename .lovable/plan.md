

# Plan de Optimización para Evitar Límites de Supabase

## Estado Actual de tu Base de Datos

| Tabla | Registros |
|-------|-----------|
| service_orders | 4 |
| spare_parts_usage | 4 |
| order_additional_costs | 4 |
| customers | 2 |
| order_payments | 2 |
| technicians | 1 |
| spare_parts | 1 |
| activity_logs | 0 |

**Estás muy lejos de los límites** - Con 500 MB disponibles, puedes almacenar decenas de miles de órdenes sin problemas.

---

## Optimizaciones Recomendadas

### 1. Paginación del Lado del Servidor (Server-Side Pagination)
**Problema actual:** Las consultas traen TODOS los datos a la vez
**Mejora:** Solo traer 20 registros por página desde la base de datos

**Impacto:** Reduce el uso de transferencia de datos (egress) - el límite más probable de alcanzar

**Páginas afectadas:**
- ServiceOrders.tsx
- Customers.tsx  
- Inventory.tsx
- Reports.tsx

### 2. Limitar Consultas del Dashboard
**Problema actual:** El dashboard carga todas las órdenes para contar estadísticas
**Mejora:** Usar `COUNT(*)` con `head: true` en vez de traer todos los registros

### 3. Caché Inteligente con React Query
**Problema actual:** Cada visita a una página hace una consulta nueva
**Mejora:** Configurar `staleTime` para evitar consultas repetitivas en pocos minutos

### 4. Archivado de Órdenes Antiguas (Opcional - para el futuro)
**Mejora:** Crear una función para exportar y eliminar órdenes entregadas con más de 2 años
**Impacto:** Mantiene la base de datos ligera a largo plazo

### 5. Eliminar Logs de Actividad No Usados
**Observación:** La tabla `activity_logs` existe pero está vacía y no se usa
**Mejora:** Eliminarla si no se necesita, o implementarla con limpieza automática

---

## Detalles Técnicos

### Cambio 1: Server-Side Pagination en ServiceOrders

```typescript
// Antes (trae TODO)
const { data } = await supabase
  .from('service_orders')
  .select('*')
  .order('created_at', { ascending: false });

// Después (trae solo una página)
const { data, count } = await supabase
  .from('service_orders')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range((page - 1) * 20, page * 20 - 1);
```

### Cambio 2: Optimizar Dashboard

```typescript
// Antes (trae todos los registros)
const { data: orders } = await supabase
  .from('service_orders')
  .select('id, status, initial_budget, total_paid');

// Después (solo cuenta por estado)
const { count: pendingCount } = await supabase
  .from('service_orders')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'pending');
```

### Cambio 3: Caché con React Query

```typescript
// Configurar tiempos de caché
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000,   // 10 minutos
    },
  },
});
```

### Cambio 4: Función de Archivado

Nueva función en Settings para:
- Exportar órdenes entregadas más antiguas que X meses
- Descargar como backup JSON
- Eliminar de la base de datos (opcional)

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ServiceOrders.tsx` | Server-side pagination |
| `src/pages/Customers.tsx` | Server-side pagination |
| `src/pages/Inventory.tsx` | Server-side pagination |
| `src/pages/Dashboard.tsx` | Optimizar consultas con COUNT |
| `src/pages/Reports.tsx` | Limitar rango de fechas por defecto |
| `src/App.tsx` | Configurar React Query cache |
| `src/pages/Settings.tsx` | Agregar opción de archivado |

---

## Estimación de Límites

Con las optimizaciones, tu sistema podría manejar:
- **~50,000+ órdenes** antes de preocuparte por espacio
- **~100,000+ consultas/mes** dentro del egress gratuito

**Recomendación:** Implementar las optimizaciones 1-3 ahora, y la opción de archivado cuando superes las 5,000 órdenes.

