-- Query SQL para eliminar la restricción única del campo SKU en la tabla 'garments'
-- Ejecuta este query en el SQL Editor de Supabase
-- Esto permitirá que los SKU se repitan en la tabla garments

-- Eliminar la restricción única del campo SKU
ALTER TABLE public.garments 
DROP CONSTRAINT IF EXISTS garments_sku_key;

-- Si la restricción tiene otro nombre, también puedes intentar:
-- ALTER TABLE public.garments 
-- DROP CONSTRAINT IF EXISTS garments_sku_unique;

-- Verificar que la restricción fue eliminada (opcional - solo para confirmar)
-- SELECT conname, contype 
-- FROM pg_constraint 
-- WHERE conrelid = 'public.garments'::regclass 
-- AND conname LIKE '%sku%';

