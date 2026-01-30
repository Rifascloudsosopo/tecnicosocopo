import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  Settings,
  BarChart3,
  Wrench,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { usePermissions, Permission } from '@/hooks/usePermissions';
import { useSidebarContext } from '@/contexts/SidebarContext';

interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  permission?: Permission | Permission[];
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Inicio', path: '/' },
  { icon: Users, label: 'Clientes', path: '/clientes', permission: 'view_customers' },
  { icon: ClipboardList, label: 'Órdenes', path: '/ordenes' },
  { icon: Wrench, label: 'Técnicos', path: '/tecnicos', permission: 'manage_technicians' },
  { icon: Package, label: 'Inventario', path: '/inventario', permission: 'view_inventory' },
  { icon: MessageSquare, label: 'WhatsApp', path: '/whatsapp', permission: 'manage_whatsapp' },
  { icon: BarChart3, label: 'Reportes', path: '/reportes', permission: 'view_reports' },
  { icon: Settings, label: 'Configuración', path: '/configuracion', permission: 'view_settings' },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { signOut, user } = useAuth();
  const { settings } = useCompanySettings();
  const { isAdmin, can, loading: permissionsLoading } = usePermissions();
  const { collapsed, toggleCollapsed } = useSidebarContext();

  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  // Filter menu items based on permissions
  const filteredMenuItems = menuItems.filter(item => {
    if (!item.permission) return true; // No permission required
    if (isAdmin) return true; // Admins see everything
    
    if (Array.isArray(item.permission)) {
      return item.permission.some(p => can(p));
    }
    return can(item.permission);
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const companyName = settings?.name || 'Mi Taller';
  const shortName = companyName.split(' ')[0]?.slice(0, 8) || 'Taller';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 h-screen bg-sidebar transition-all duration-300 flex flex-col',
        isMobile ? 'w-64' : collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center overflow-hidden">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Wrench className="w-5 h-5 text-sidebar-primary-foreground" />
              )}
            </div>
            <span className="font-bold text-sidebar-foreground text-lg truncate max-w-[140px]">
              {shortName}
            </span>
          </div>
        )}
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-sidebar-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        ) : (
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={cn(
                'sidebar-item',
                isActive && 'sidebar-item-active'
              )}
              title={collapsed && !isMobile ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || isMobile) && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        {(!collapsed || isMobile) && user && (
          <div className="text-xs text-sidebar-foreground/70 truncate">
            {user.email}
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'sidebar-item text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 w-full',
            collapsed && !isMobile && 'justify-center'
          )}
          title={collapsed && !isMobile ? 'Cerrar sesión' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="font-medium">Cerrar sesión</span>}
        </button>
        {(!collapsed || isMobile) && (
          <div className="text-xs text-sidebar-foreground/50 text-center">
            © 2025 {companyName}
          </div>
        )}
      </div>
    </aside>
  );
}
