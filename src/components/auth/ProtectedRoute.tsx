import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions, Permission } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: Permission | Permission[];
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, can, loading: permissionsLoading } = usePermissions();
  const location = useLocation();

  if (authLoading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check permissions if required
  if (requiredPermission && !isAdmin) {
    const hasPermission = Array.isArray(requiredPermission)
      ? requiredPermission.some(p => can(p))
      : can(requiredPermission);

    if (!hasPermission) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <ShieldX className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acceso Denegado</h1>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            No tienes permiso para acceder a esta sección. Contacta al administrador si crees que esto es un error.
          </p>
          <a
            href="/"
            className="text-primary hover:underline"
          >
            Volver al inicio
          </a>
        </div>
      );
    }
  }

  return <>{children}</>;
}
