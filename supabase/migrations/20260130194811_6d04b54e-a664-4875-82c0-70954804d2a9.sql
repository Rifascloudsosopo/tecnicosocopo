-- Create inventory_categories table
CREATE TABLE public.inventory_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

-- Policies for categories
CREATE POLICY "Authenticated users can view categories"
ON public.inventory_categories
FOR SELECT
USING (true);

CREATE POLICY "Admins and users with manage_inventory can insert categories"
ON public.inventory_categories
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM technician_permissions tp
    JOIN technicians t ON t.id = tp.technician_id
    WHERE t.user_id = auth.uid() 
    AND tp.permission = 'manage_inventory' 
    AND tp.granted = true
  )
);

CREATE POLICY "Admins and users with manage_inventory can update categories"
ON public.inventory_categories
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM technician_permissions tp
    JOIN technicians t ON t.id = tp.technician_id
    WHERE t.user_id = auth.uid() 
    AND tp.permission = 'manage_inventory' 
    AND tp.granted = true
  )
);

CREATE POLICY "Admins and users with manage_inventory can delete categories"
ON public.inventory_categories
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM technician_permissions tp
    JOIN technicians t ON t.id = tp.technician_id
    WHERE t.user_id = auth.uid() 
    AND tp.permission = 'manage_inventory' 
    AND tp.granted = true
  )
);

-- Insert default categories
INSERT INTO public.inventory_categories (name) VALUES
  ('Pantallas'),
  ('Baterías'),
  ('Flexores'),
  ('Cámaras'),
  ('Carcasas'),
  ('Otros');

-- Update spare_parts RLS to restrict editing to admins/manage_inventory permission
DROP POLICY IF EXISTS "Authenticated users can update parts" ON public.spare_parts;
DROP POLICY IF EXISTS "Authenticated users can delete parts" ON public.spare_parts;
DROP POLICY IF EXISTS "Authenticated users can insert parts" ON public.spare_parts;

CREATE POLICY "Admins and users with manage_inventory can insert parts"
ON public.spare_parts
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM technician_permissions tp
    JOIN technicians t ON t.id = tp.technician_id
    WHERE t.user_id = auth.uid() 
    AND tp.permission = 'manage_inventory' 
    AND tp.granted = true
  )
);

CREATE POLICY "Admins and users with manage_inventory can update parts"
ON public.spare_parts
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM technician_permissions tp
    JOIN technicians t ON t.id = tp.technician_id
    WHERE t.user_id = auth.uid() 
    AND tp.permission = 'manage_inventory' 
    AND tp.granted = true
  )
);

CREATE POLICY "Admins and users with manage_inventory can delete parts"
ON public.spare_parts
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM technician_permissions tp
    JOIN technicians t ON t.id = tp.technician_id
    WHERE t.user_id = auth.uid() 
    AND tp.permission = 'manage_inventory' 
    AND tp.granted = true
  )
);