-- Crear enum para estados de orden
CREATE TYPE public.order_status AS ENUM ('pending', 'in_progress', 'completed', 'delivered', 'abandoned');

-- Crear enum para roles de usuario
CREATE TYPE public.app_role AS ENUM ('admin', 'technician', 'receptionist');

-- Tabla de perfiles de usuario
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de roles de usuario
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Tabla de configuración de la empresa
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Mi Taller',
  rif TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  default_warranty_days INTEGER DEFAULT 30,
  abandonment_days INTEGER DEFAULT 90,
  terms_conditions TEXT,
  printer_size TEXT DEFAULT '80mm',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de clientes
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de técnicos (vinculada a usuarios)
CREATE TABLE public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  specialty TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de órdenes de servicio
CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT NOT NULL,
  technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  device_color TEXT,
  device_imei TEXT,
  unlock_pattern TEXT,
  unlock_pin TEXT,
  account_password TEXT,
  reported_issue TEXT NOT NULL,
  aesthetic_notes TEXT,
  initial_budget NUMERIC(10,2) DEFAULT 0,
  additional_costs NUMERIC(10,2) DEFAULT 0,
  total_paid NUMERIC(10,2) DEFAULT 0,
  status order_status DEFAULT 'pending',
  warranty_days INTEGER DEFAULT 30,
  warranty_expires_at TIMESTAMP WITH TIME ZONE,
  estimated_completion TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Tabla de pagos
CREATE TABLE public.order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de costos adicionales
CREATE TABLE public.order_additional_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de repuestos
CREATE TABLE public.spare_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  model_compatibility TEXT,
  purchase_price NUMERIC(10,2) DEFAULT 0,
  sale_price NUMERIC(10,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de uso de repuestos
CREATE TABLE public.spare_parts_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE NOT NULL,
  spare_part_id UUID REFERENCES public.spare_parts(id) ON DELETE RESTRICT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de plantillas de WhatsApp
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  status_trigger TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de logs de actividad
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Función para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Función para obtener el técnico del usuario actual
CREATE OR REPLACE FUNCTION public.get_current_technician_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.technicians WHERE user_id = auth.uid()
$$;

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Función para generar número de orden
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  year_suffix TEXT;
  next_number INTEGER;
BEGIN
  year_suffix := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.service_orders
  WHERE order_number LIKE 'OS-' || year_suffix || '%';
  NEW.order_number := 'OS-' || year_suffix || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Función para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_orders_updated_at BEFORE UPDATE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_spare_parts_updated_at BEFORE UPDATE ON public.spare_parts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER generate_order_number_trigger BEFORE INSERT ON public.service_orders
FOR EACH ROW WHEN (NEW.order_number IS NULL)
EXECUTE FUNCTION public.generate_order_number();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_additional_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Políticas RLS para user_roles (solo lectura para usuarios autenticados)
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Políticas RLS para company_settings (todos los autenticados pueden ver y modificar)
CREATE POLICY "Authenticated users can view settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update settings" ON public.company_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert settings" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas RLS para customers
CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update customers" ON public.customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete customers" ON public.customers FOR DELETE TO authenticated USING (true);

-- Políticas RLS para technicians
CREATE POLICY "Authenticated users can view technicians" ON public.technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert technicians" ON public.technicians FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update technicians" ON public.technicians FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete technicians" ON public.technicians FOR DELETE TO authenticated USING (true);

-- Políticas RLS para service_orders
CREATE POLICY "Authenticated users can view orders" ON public.service_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert orders" ON public.service_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update orders" ON public.service_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete orders" ON public.service_orders FOR DELETE TO authenticated USING (true);

-- Políticas RLS para order_payments
CREATE POLICY "Authenticated users can view payments" ON public.order_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert payments" ON public.order_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payments" ON public.order_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete payments" ON public.order_payments FOR DELETE TO authenticated USING (true);

-- Políticas RLS para order_additional_costs
CREATE POLICY "Authenticated users can view costs" ON public.order_additional_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert costs" ON public.order_additional_costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update costs" ON public.order_additional_costs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete costs" ON public.order_additional_costs FOR DELETE TO authenticated USING (true);

-- Políticas RLS para spare_parts
CREATE POLICY "Authenticated users can view parts" ON public.spare_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert parts" ON public.spare_parts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update parts" ON public.spare_parts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete parts" ON public.spare_parts FOR DELETE TO authenticated USING (true);

-- Políticas RLS para spare_parts_usage
CREATE POLICY "Authenticated users can view usage" ON public.spare_parts_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert usage" ON public.spare_parts_usage FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update usage" ON public.spare_parts_usage FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete usage" ON public.spare_parts_usage FOR DELETE TO authenticated USING (true);

-- Políticas RLS para whatsapp_templates
CREATE POLICY "Authenticated users can view templates" ON public.whatsapp_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert templates" ON public.whatsapp_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update templates" ON public.whatsapp_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete templates" ON public.whatsapp_templates FOR DELETE TO authenticated USING (true);

-- Políticas RLS para activity_logs
CREATE POLICY "Authenticated users can view logs" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Insertar configuración inicial de empresa
INSERT INTO public.company_settings (name, default_warranty_days, abandonment_days, terms_conditions)
VALUES (
  'Mi Taller',
  30,
  90,
  '1. El cliente autoriza la revisión y reparación del equipo descrito.
2. Los equipos no retirados en 90 días serán considerados abandonados.
3. La garantía cubre únicamente la reparación realizada.
4. No nos hacemos responsables por datos almacenados en el equipo.
5. El cliente debe presentar este comprobante para retirar su equipo.'
);