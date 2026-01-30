import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import ServiceOrders from "./pages/ServiceOrders";
import NewServiceOrder from "./pages/NewServiceOrder";
import Inventory from "./pages/Inventory";
import Technicians from "./pages/Technicians";
import WhatsAppTemplates from "./pages/WhatsAppTemplates";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute requiredPermission="view_customers"><Customers /></ProtectedRoute>} />
            <Route path="/ordenes" element={<ProtectedRoute><ServiceOrders /></ProtectedRoute>} />
            <Route path="/ordenes/nueva" element={<ProtectedRoute requiredPermission="create_orders"><NewServiceOrder /></ProtectedRoute>} />
            <Route path="/tecnicos" element={<ProtectedRoute requiredPermission="manage_technicians"><Technicians /></ProtectedRoute>} />
            <Route path="/inventario" element={<ProtectedRoute requiredPermission="view_inventory"><Inventory /></ProtectedRoute>} />
            <Route path="/whatsapp" element={<ProtectedRoute requiredPermission="manage_whatsapp"><WhatsAppTemplates /></ProtectedRoute>} />
            <Route path="/reportes" element={<ProtectedRoute requiredPermission="view_reports"><Reports /></ProtectedRoute>} />
            <Route path="/configuracion" element={<ProtectedRoute requiredPermission="view_settings"><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
