-- Query SQL para crear la tabla 'clientes' en Supabase
-- Ejecuta este query en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT,
  correo TEXT,
  cedula TEXT,
  direccion TEXT,
  cumpleanos DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas por nombre
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON public.clientes(nombre);

-- Crear índice para búsquedas por cédula (si es único)
CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON public.clientes(cedula);

-- Crear índice para búsquedas por correo
CREATE INDEX IF NOT EXISTS idx_clientes_correo ON public.clientes(correo);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS) - opcional, ajusta según tus necesidades
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados (ajusta según tu configuración de autenticación)
CREATE POLICY "Allow read access to authenticated users"
  ON public.clientes
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para permitir inserción a usuarios autenticados
CREATE POLICY "Allow insert access to authenticated users"
  ON public.clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para permitir actualización a usuarios autenticados
CREATE POLICY "Allow update access to authenticated users"
  ON public.clientes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para permitir eliminación a usuarios autenticados
CREATE POLICY "Allow delete access to authenticated users"
  ON public.clientes
  FOR DELETE
  TO authenticated
  USING (true);

