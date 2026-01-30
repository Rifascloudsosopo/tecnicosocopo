import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { OnlineStatusBadge } from '@/components/ui/OnlineStatusBadge';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { SidebarProvider, useSidebarContext } from '@/contexts/SidebarContext';

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { collapsed } = useSidebarContext();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </>
      )}

      {/* Main Content */}
      <main className={`transition-all duration-300 ${isMobile ? 'ml-0 pb-20' : collapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Mobile Header */}
        {isMobile && (
          <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-background/95 backdrop-blur border-b border-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <OnlineStatusBadge />
          </header>
        )}

        {/* Desktop Header with Status */}
        {!isMobile && (
          <header className="sticky top-0 z-30 flex items-center justify-end px-6 h-14 bg-background/95 backdrop-blur border-b border-border">
            <OnlineStatusBadge />
          </header>
        )}

        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileNav />}
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </SidebarProvider>
  );
}
