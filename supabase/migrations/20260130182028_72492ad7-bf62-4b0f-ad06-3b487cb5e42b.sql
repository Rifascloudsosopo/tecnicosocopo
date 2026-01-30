-- Create technician_permissions table
CREATE TABLE public.technician_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid REFERENCES public.technicians(id) ON DELETE CASCADE NOT NULL,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (technician_id, permission)
);

-- Enable RLS
ALTER TABLE public.technician_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with permissions
CREATE POLICY "Admins can manage permissions"
ON public.technician_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Technicians can view their own permissions
CREATE POLICY "Technicians can view own permissions"
ON public.technician_permissions
FOR SELECT
TO authenticated
USING (
  technician_id = (SELECT id FROM public.technicians WHERE user_id = auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_technician_permissions_updated_at
  BEFORE UPDATE ON public.technician_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize default permissions for a technician
CREATE OR REPLACE FUNCTION public.initialize_technician_permissions(p_technician_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default permissions
  INSERT INTO public.technician_permissions (technician_id, permission, granted)
  VALUES
    (p_technician_id, 'view_all_orders', false),
    (p_technician_id, 'create_orders', true),
    (p_technician_id, 'edit_orders', true),
    (p_technician_id, 'change_status', true),
    (p_technician_id, 'change_status_delivered', false),
    (p_technician_id, 'view_customers', true),
    (p_technician_id, 'manage_customers', false),
    (p_technician_id, 'view_inventory', true),
    (p_technician_id, 'manage_inventory', false),
    (p_technician_id, 'view_reports', false),
    (p_technician_id, 'view_settings', false),
    (p_technician_id, 'manage_settings', false),
    (p_technician_id, 'manage_technicians', false),
    (p_technician_id, 'manage_whatsapp', false)
  ON CONFLICT (technician_id, permission) DO NOTHING;
END;
$$;

-- Function to assign technician role when user_id is linked
CREATE OR REPLACE FUNCTION public.assign_technician_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user_id is being set and was null before
  IF NEW.user_id IS NOT NULL AND (OLD.user_id IS NULL OR OLD.user_id != NEW.user_id) THEN
    -- Insert technician role if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'technician')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Initialize permissions for this technician
    PERFORM public.initialize_technician_permissions(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign role when technician is linked to user
CREATE TRIGGER on_technician_user_linked
  AFTER INSERT OR UPDATE OF user_id ON public.technicians
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_technician_role();

-- Add unique constraint to user_roles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;