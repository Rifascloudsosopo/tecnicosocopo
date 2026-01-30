-- Fix the order number generation function
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  year_suffix TEXT;
  next_number INTEGER;
BEGIN
  year_suffix := TO_CHAR(NOW(), 'YY');
  
  -- Fix: Extract only the sequence part (last 4 characters) from order numbers matching this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 6 FOR 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.service_orders
  WHERE order_number LIKE 'OS-' || year_suffix || '%';
  
  NEW.order_number := 'OS-' || year_suffix || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;