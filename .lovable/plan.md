

# Sistema de Permisos Personalizables por Técnico

## Resumen

Implementar un sistema donde el administrador pueda configurar permisos individuales para cada técnico, controlando qué módulos pueden ver y qué acciones pueden realizar.

## Cómo Funcionará

### Para el Administrador:
1. El admin crea usuarios desde Supabase Dashboard
2. En la página de Técnicos, al crear/editar un técnico:
   - Vincula el usuario
   - Configura permisos específicos (qué puede ver, qué puede hacer)

### Para el Técnico:
1. Inicia sesión con su email y contraseña
2. Solo ve los módulos que el admin le habilitó
3. Solo puede realizar las acciones permitidas

## Estructura de Permisos

El sistema tendrá permisos modulares que el admin puede activar/desactivar por técnico:

| Permiso | Descripción |
|---------|-------------|
| `view_all_orders` | Ver todas las órdenes (si no, solo las suyas) |
| `create_orders` | Crear nuevas órdenes de servicio |
| `edit_orders` | Editar órdenes (propias o todas según `view_all_orders`) |
| `change_status` | Cambiar estado de órdenes |
| `change_status_delivered` | Marcar como "Entregado" (permiso especial) |
| `view_customers` | Ver lista de clientes |
| `manage_customers` | Crear/editar clientes |
| `view_inventory` | Ver inventario |
| `manage_inventory` | Modificar inventario |
| `view_reports` | Ver reportes |
| `view_settings` | Ver configuración |
| `manage_settings` | Modificar configuración |
| `manage_technicians` | Gestionar técnicos |
| `manage_whatsapp` | Gestionar plantillas WhatsApp |

## Cambios en la Base de Datos

### Nueva tabla: `technician_permissions`

```text
┌─────────────────────────────────────────────────────────┐
│ technician_permissions                                   │
├──────────────────────┬──────────────────────────────────┤
│ id                   │ uuid (PK)                        │
│ technician_id        │ uuid (FK -> technicians.id)      │
│ permission           │ text (nombre del permiso)        │
│ granted              │ boolean (activado/desactivado)   │
│ created_at           │ timestamp                        │
│ updated_at           │ timestamp                        │
└──────────────────────┴──────────────────────────────────┘
```

### Actualizar tabla `user_roles`

- Asignar rol `admin` al primer usuario
- Asignar rol `technician` automáticamente cuando se vincula un técnico

## Cambios en la Aplicación

### 1. Hook de Permisos (`usePermissions`)
- Detectar si el usuario es admin (tiene todos los permisos)
- Para técnicos: cargar permisos desde `technician_permissions`
- Exponer funciones: `can('view_orders')`, `isAdmin`, etc.

### 2. Página de Técnicos
- Agregar sección de "Permisos" al crear/editar técnico
- Lista de checkboxes para cada permiso
- Guardar permisos en la base de datos

### 3. Navegación (Sidebar)
- Filtrar menú según permisos del usuario
- Ocultar módulos no permitidos

### 4. Página de Órdenes
- Si `view_all_orders` es false: filtrar solo órdenes del técnico
- Si `change_status` es false: deshabilitar selector de estado
- Si `change_status_delivered` es false: ocultar opción "Entregado"

### 5. Protección de Rutas
- Cada página verifica permisos antes de mostrar contenido
- Redirigir a dashboard si no tiene permiso

### 6. Página de Login
- Mostrar mensaje claro cuando usuario no tiene permisos

## Flujo Completo

```text
ADMINISTRADOR                          TÉCNICO
    │                                      │
    ▼                                      │
[Supabase Dashboard]                       │
Crear usuario con email/clave              │
    │                                      │
    ▼                                      │
[App - Página Técnicos]                    │
1. Crear técnico                           │
2. Vincular usuario                        │
3. Configurar permisos ─────────────┐      │
    │                               │      │
    ▼                               ▼      │
[Base de Datos]              [Permisos     │
- technicians                 Guardados]   │
- user_roles (technician)          │       │
- technician_permissions ──────────┘       │
                                           │
                                           ▼
                               [App - Login]
                               Email + Contraseña
                                           │
                                           ▼
                               [Dashboard Personalizado]
                               Solo ve módulos permitidos
                               Solo acciones autorizadas
```

## Permisos Predeterminados

Cuando se crea un técnico, tendrá estos permisos por defecto (el admin puede cambiarlos):

- `view_all_orders`: NO (solo sus órdenes)
- `create_orders`: SÍ
- `edit_orders`: SÍ
- `change_status`: SÍ
- `change_status_delivered`: NO
- `view_customers`: SÍ
- `manage_customers`: NO
- `view_inventory`: SÍ
- `manage_inventory`: NO
- Todos los demás: NO

## Detalles Técnicos

### Archivos a crear:
1. `src/hooks/usePermissions.ts` - Hook para verificar permisos
2. `supabase/migrations/xxx_permissions.sql` - Migración de BD

### Archivos a modificar:
1. `src/pages/Technicians.tsx` - Agregar UI de permisos
2. `src/components/layout/Sidebar.tsx` - Filtrar menú
3. `src/pages/ServiceOrders.tsx` - Aplicar permisos
4. `src/pages/Dashboard.tsx` - Mostrar solo datos permitidos
5. `src/pages/Customers.tsx` - Verificar permisos
6. `src/pages/Inventory.tsx` - Verificar permisos
7. `src/pages/Reports.tsx` - Verificar permisos
8. `src/pages/Settings.tsx` - Verificar permisos
9. `src/pages/WhatsAppTemplates.tsx` - Verificar permisos

### Seguridad:
- Validación en frontend (UX) + RLS en Supabase (seguridad real)
- Los administradores pueden ver/hacer todo
- Los técnicos solo acceden según sus permisos configurados

