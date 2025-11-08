-- Query SQL para crear la tabla 'cotizaciones' en Supabase
-- Ejecuta este query en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_cotizacion TEXT UNIQUE,
  datos_cliente JSONB NOT NULL,
  envio JSONB,
  resumen_pedido JSONB NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  costo_envio NUMERIC(12, 2) DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notas_cliente TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'convertida')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas por número de cotización
CREATE INDEX IF NOT EXISTS idx_cotizaciones_numero ON public.cotizaciones(numero_cotizacion);

-- Crear índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON public.cotizaciones(estado);

-- Crear índice para búsquedas por fecha de creación
CREATE INDEX IF NOT EXISTS idx_cotizaciones_created_at ON public.cotizaciones(created_at DESC);

-- Crear índices GIN para búsquedas en campos JSONB
CREATE INDEX IF NOT EXISTS idx_cotizaciones_datos_cliente ON public.cotizaciones USING GIN (datos_cliente);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_envio ON public.cotizaciones USING GIN (envio);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_resumen_pedido ON public.cotizaciones USING GIN (resumen_pedido);

-- Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_cotizaciones_updated_at
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados
CREATE POLICY "Allow read access to authenticated users"
  ON public.cotizaciones
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para permitir inserción a usuarios autenticados
CREATE POLICY "Allow insert access to authenticated users"
  ON public.cotizaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para permitir actualización a usuarios autenticados
CREATE POLICY "Allow update access to authenticated users"
  ON public.cotizaciones
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para permitir eliminación a usuarios autenticados
CREATE POLICY "Allow delete access to authenticated users"
  ON public.cotizaciones
  FOR DELETE
  TO authenticated
  USING (true);

-- Comentarios en la tabla y columnas para documentación
COMMENT ON TABLE public.cotizaciones IS 'Tabla para almacenar cotizaciones de pedidos';
COMMENT ON COLUMN public.cotizaciones.datos_cliente IS 'JSONB con información del cliente: tipo (natural/empresa), nombre, identificación, contacto, etc.';
COMMENT ON COLUMN public.cotizaciones.envio IS 'JSONB con información de envío: destino, costo, dirección, etc.';
COMMENT ON COLUMN public.cotizaciones.resumen_pedido IS 'JSONB con resumen del pedido: items, modificaciones, totales, etc.';
COMMENT ON COLUMN public.cotizaciones.estado IS 'Estado de la cotización: pendiente, aprobada, rechazada, convertida';

