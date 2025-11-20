-- Query SQL para agregar la columna 'vendor_id' a la tabla 'OrdenesProduccion' en Supabase
-- Ejecuta este query en el SQL Editor de Supabase

-- Agregar columna vendor_id (opcional, puede ser NULL)
ALTER TABLE public.OrdenesProduccion
ADD COLUMN IF NOT EXISTS vendor_id UUID;

-- Crear índice para búsquedas rápidas por vendedor
CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_vendor_id 
ON public.OrdenesProduccion(vendor_id);

-- Agregar foreign key constraint (opcional, para mantener integridad referencial)
-- Descomenta las siguientes líneas si quieres que el vendor_id siempre referencie a un empleado válido
-- ALTER TABLE public.OrdenesProduccion
-- ADD CONSTRAINT fk_ordenes_produccion_vendor
-- FOREIGN KEY (vendor_id) REFERENCES public.employees(id)
-- ON DELETE SET NULL;






