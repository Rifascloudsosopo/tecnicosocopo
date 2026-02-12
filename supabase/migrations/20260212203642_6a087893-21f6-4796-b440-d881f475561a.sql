-- Fix the order with $0.01 pending (data fix via function)
-- We'll update total_paid to match the actual costs total
UPDATE service_orders SET total_paid = 50.00 WHERE id = '7cb08daf-ec87-4182-9e18-04ae79bd3531' AND total_paid = 49.99;