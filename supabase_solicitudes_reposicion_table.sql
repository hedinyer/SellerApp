-- Query SQL para crear la tabla 'solicitudes_reposicion' en Supabase
-- Ejecuta este query en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS public.solicitudes_reposicion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  garment_id UUID NOT NULL REFERENCES public.garments(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  producto_nombre TEXT NOT NULL,
  cantidad_actual INTEGER NOT NULL,
  umbral INTEGER NOT NULL,
  cantidad_solicitada INTEGER,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completada', 'cancelada')),
  solicitado_por TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas por garment_id
CREATE INDEX IF NOT EXISTS idx_solicitudes_reposicion_garment_id ON public.solicitudes_reposicion(garment_id);

-- Crear índice para búsquedas por SKU
CREATE INDEX IF NOT EXISTS idx_solicitudes_reposicion_sku ON public.solicitudes_reposicion(sku);

-- Crear índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_solicitudes_reposicion_estado ON public.solicitudes_reposicion(estado);

-- Crear índice para búsquedas por fecha de creación (más recientes primero)
CREATE INDEX IF NOT EXISTS idx_solicitudes_reposicion_created_at ON public.solicitudes_reposicion(created_at DESC);

-- Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_solicitudes_reposicion_updated_at
  BEFORE UPDATE ON public.solicitudes_reposicion
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.solicitudes_reposicion ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados
CREATE POLICY "Allow read access to authenticated users"
  ON public.solicitudes_reposicion
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para permitir inserción a usuarios autenticados
CREATE POLICY "Allow insert access to authenticated users"
  ON public.solicitudes_reposicion
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para permitir actualización a usuarios autenticados
CREATE POLICY "Allow update access to authenticated users"
  ON public.solicitudes_reposicion
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para permitir eliminación a usuarios autenticados
CREATE POLICY "Allow delete access to authenticated users"
  ON public.solicitudes_reposicion
  FOR DELETE
  TO authenticated
  USING (true);

-- Comentarios en la tabla y columnas para documentación
COMMENT ON TABLE public.solicitudes_reposicion IS 'Tabla para almacenar solicitudes de reposición de productos con inventario crítico';
COMMENT ON COLUMN public.solicitudes_reposicion.garment_id IS 'Referencia al producto en la tabla garments';
COMMENT ON COLUMN public.solicitudes_reposicion.sku IS 'SKU del producto (denormalizado para búsquedas rápidas)';
COMMENT ON COLUMN public.solicitudes_reposicion.producto_nombre IS 'Nombre del producto (denormalizado para búsquedas rápidas)';
COMMENT ON COLUMN public.solicitudes_reposicion.cantidad_actual IS 'Cantidad disponible al momento de la solicitud';
COMMENT ON COLUMN public.solicitudes_reposicion.umbral IS 'Umbral mínimo de stock al momento de la solicitud';
COMMENT ON COLUMN public.solicitudes_reposicion.cantidad_solicitada IS 'Cantidad que se desea reponer (opcional)';
COMMENT ON COLUMN public.solicitudes_reposicion.estado IS 'Estado de la solicitud: pendiente, en_proceso, completada, cancelada';
COMMENT ON COLUMN public.solicitudes_reposicion.solicitado_por IS 'Usuario que realizó la solicitud';
COMMENT ON COLUMN public.solicitudes_reposicion.notas IS 'Notas adicionales sobre la solicitud';





