import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vlonypzwumgrkpivmnld.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsb255cHp3dW1ncmtwaXZtbmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3ODA3MTksImV4cCI6MjA3NzM1NjcxOX0.iShtyx4syA82lYCoueirfMWxgD4oM08TatvU1SuWqLg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type GarmentRecord = {
  id: string
  name: string
  sku: string
  category: string
  brand: string | null
  color: string
  size: string
  price: number
  cost: number | null
  status: 'activo' | 'inactivo' | 'descatalogado'
  qty: number
  low_stock_threshold: number
  image_url: string | null
  description: string | null
  created_at: string | null
  updated_at: string | null
}

export type ClienteRecord = {
  id: string
  nombre: string
  telefono: string | null
  correo: string | null
  cedula: string | null
  direccion: string | null
  cumpleanos: string | null
  created_at: string | null
  updated_at: string | null
}

export async function uploadProductImage(file: File, sku: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `products/${sku}-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('images').upload(path, file, {
    upsert: false,
    contentType: file.type || 'image/*'
  })
  if (error) return null
  const { data } = supabase.storage.from('images').getPublicUrl(path)
  return data.publicUrl || null
}


