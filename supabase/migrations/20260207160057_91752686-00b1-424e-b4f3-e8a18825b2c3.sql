-- Keep only the most complete/recent row and delete duplicates
-- The row with id 2faa8a6f has the most complete data (phone, address, custom warranty, etc.)
DELETE FROM company_settings 
WHERE id != '2faa8a6f-bbb6-48e3-b337-ffe4343d821c';

-- Add a unique constraint to prevent future duplicates (only 1 row allowed)
CREATE UNIQUE INDEX IF NOT EXISTS company_settings_singleton ON company_settings ((true));