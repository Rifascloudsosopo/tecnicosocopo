-- Add printer_size column to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS printer_size TEXT DEFAULT '80mm';

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view company assets (public bucket)
CREATE POLICY "Company assets are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-assets');

-- Allow authenticated users to upload company assets
CREATE POLICY "Authenticated users can upload company assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'company-assets');

-- Allow authenticated users to update company assets
CREATE POLICY "Authenticated users can update company assets" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'company-assets');

-- Allow authenticated users to delete company assets
CREATE POLICY "Authenticated users can delete company assets" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'company-assets');