import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  Settings,
  BarChart3,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Inicio', path: '/' },
  { icon: ClipboardList, label: 'Órdenes', path: '/ordenes' },
  { icon: Users, label: 'Clientes', path: '/clientes' },
  { icon: Package, label: 'Stock', path: '/inventario' },
  { icon: Settings, label: 'Más', path: '/configuracion' },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14 pb-safe">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'text-sidebar-primary'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'text-sidebar-primary')} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
