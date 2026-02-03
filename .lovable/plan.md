

# Plan: Funcionamiento Completo Sin Conexion a Internet

## Resumen

Vamos a modificar la aplicacion para que funcione completamente sin internet, guardando los datos localmente y sincronizandolos automaticamente cuando vuelva la conexion. Tambien manejaremos conflictos cuando multiples dispositivos modifiquen los mismos datos.

## Que va a cambiar para ti

1. **Podras usar la app sin internet** - Ver ordenes, clientes, inventario y crear nuevas ordenes
2. **Los datos se guardan localmente** - Aunque cierres la app, los datos estaran ahi
3. **Sincronizacion automatica** - Cuando vuelva internet, todo se sincroniza solo
4. **Sin conflictos entre dispositivos** - Si otro dispositivo tiene internet y este no, cuando ambos se conecten, los datos se fusionaran correctamente

## Cambios Tecnicos Detallados

### 1. Autenticacion Offline (Prioridad Alta)

**Archivo:** `src/hooks/useAuth.ts`

- Guardar la sesion del usuario en IndexedDB cuando inicie sesion con internet
- Cuando no hay internet, usar la sesion guardada localmente
- Validar el token JWT localmente (sin llamar al servidor)

**Archivo:** `src/components/auth/ProtectedRoute.tsx`

- Permitir acceso si hay una sesion guardada localmente, incluso sin internet

### 2. Dashboard con Soporte Offline

**Archivo:** `src/pages/Dashboard.tsx`

- Usar `useOfflineSync.fetchAndCache` en lugar de llamadas directas a Supabase
- Mostrar datos cacheados cuando no hay conexion
- Indicador visual cuando los datos son del cache

### 3. Ordenes de Servicio Offline

**Archivo:** `src/pages/ServiceOrders.tsx`

- Integrar `useOfflineSync` para cargar ordenes desde cache
- Permitir cambiar estados de ordenes sin internet
- Encolar cambios para sincronizar despues

**Archivo:** `src/pages/NewServiceOrder.tsx`

- Permitir crear ordenes nuevas sin internet
- Buscar clientes en cache local
- Encolar la creacion para cuando haya internet

### 4. Pre-carga de Datos Esenciales

**Nuevo archivo:** `src/hooks/useDataPreloader.ts`

- Al iniciar la app (con internet), descargar y cachear:
  - Clientes
  - Ordenes de servicio
  - Repuestos
  - Tecnicos
  - Configuracion de la empresa

### 5. Resolucion de Conflictos Multi-Dispositivo

**Archivo:** `src/lib/offlineStorage.ts` y `src/hooks/useOfflineSync.ts`

- Agregar campo `updated_at` a cada cambio pendiente
- Cuando sincronice, usar estrategia "el mas reciente gana":
  - Comparar `updated_at` local vs servidor
  - Si el servidor tiene datos mas nuevos, descartar el cambio local
  - Si el local es mas nuevo, aplicar el cambio
- Mostrar notificacion cuando un conflicto se resuelve

### 6. Mejoras al Service Worker (PWA)

**Archivo:** `vite.config.ts`

- Configurar Workbox para cachear rutas de navegacion
- Estrategia "Network First" para API calls (intenta servidor primero, si falla usa cache)
- Estrategia "Cache First" para assets estaticos

### 7. Indicadores Visuales de Estado

**Archivo:** `src/components/ui/OnlineStatusBadge.tsx`

- Mostrar icono diferente cuando hay cambios pendientes
- Animacion de sincronizacion en progreso
- Toast de confirmacion cuando termina la sincronizacion

### 8. Pagina de Login Offline

**Archivo:** `src/pages/Login.tsx`

- Si hay sesion guardada localmente, permitir "entrar sin conexion"
- Mensaje claro explicando que entrara con datos locales

## Flujo de Uso

```text
Usuario abre la app
        |
        v
  Hay internet?
   /         \
  Si          No
  |            |
  v            v
Login        Hay sesion
normal       guardada?
  |          /      \
  v        Si        No
Descargar   |         |
y cachear   v         v
datos    Entrar    Mostrar
  |      offline   "Necesitas
  v         |      conexion"
  Usar      v
  app    Usar app
  normal  con datos
           locales
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useAuth.ts` | Persistir sesion en IndexedDB |
| `src/components/auth/ProtectedRoute.tsx` | Permitir acceso offline |
| `src/pages/Dashboard.tsx` | Usar cache offline |
| `src/pages/ServiceOrders.tsx` | CRUD offline |
| `src/pages/NewServiceOrder.tsx` | Crear ordenes offline |
| `src/pages/Login.tsx` | Opcion login offline |
| `src/lib/offlineStorage.ts` | Campo updated_at, conflictos |
| `src/hooks/useOfflineSync.ts` | Resolucion de conflictos |
| `src/components/ui/OnlineStatusBadge.tsx` | Mejores indicadores |
| `vite.config.ts` | Workbox mejorado |

## Archivos Nuevos

| Archivo | Proposito |
|---------|-----------|
| `src/hooks/useDataPreloader.ts` | Pre-cargar datos al inicio |
| `src/hooks/useOfflineAuth.ts` | Manejo de auth offline |

## Consideraciones

- **Primera vez**: El usuario necesita internet para iniciar sesion la primera vez
- **Datos sensibles**: Las contrasenas nunca se guardan localmente, solo el token de sesion
- **Tamano del cache**: IndexedDB puede almacenar varios MB de datos sin problema
- **Sincronizacion**: Se ejecuta automaticamente al detectar conexion

