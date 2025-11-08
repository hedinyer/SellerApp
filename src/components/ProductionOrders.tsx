import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type ProductionStatus = 'Recibida' | 'En proceso' | 'Terminada' | 'En camino' | 'Entregada'

type ProductionOrder = {
  id: string
  title: string
  quoteNumber?: string
  pdfName: string
  pdfUrl: string
  pdfPath?: string
  status: ProductionStatus
  createdAt: string
  vendorId?: string
  vendorName?: string
}

const STATUS_OPTIONS: ProductionStatus[] = ['Recibida', 'En proceso', 'Terminada', 'En camino', 'Entregada']

interface Employee {
  id: string
  name: string
}

export default function ProductionOrders() {
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [title, setTitle] = useState('')
  const [quoteNumber, setQuoteNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  const [employees, setEmployees] = useState<Employee[]>([])

  // Load employees
  useEffect(() => {
    async function loadEmployees() {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, status')
        .eq('status', 'activo')
        .order('name', { ascending: true })
      if (error || !data) return
      const list: Employee[] = (data as any[]).map(r => ({
        id: String(r.id),
        name: String(r.name || 'Sin nombre')
      }))
      setEmployees(list)
      if (list.length > 0 && !selectedVendorId) {
        setSelectedVendorId(list[0].id)
      }
    }
    loadEmployees()
  }, [])

  // Load existing orders from Supabase
  useEffect(() => {
    async function loadOrders() {
      const { data, error } = await supabase
        .from('OrdenesProduccion')
        .select('*')
        .order('created_at', { ascending: false })
      if (error || !data) return
      
      // Load vendor names for orders that have vendor_id
      const vendorIds = data
        .map((row: any) => row.vendor_id || row.vendorId)
        .filter((id: any) => id) as string[]
      
      let vendorMap: Record<string, string> = {}
      if (vendorIds.length > 0) {
        const { data: vendorData } = await supabase
          .from('employees')
          .select('id, name')
          .in('id', vendorIds)
        if (vendorData) {
          vendorMap = vendorData.reduce((acc: Record<string, string>, emp: any) => {
            acc[String(emp.id)] = String(emp.name || 'Sin nombre')
            return acc
          }, {})
        }
      }
      
      const list: ProductionOrder[] = data.map((row: any) => {
        const pdfPath: string = row.pdf_path || row.pdfPath || ''
        const publicUrl = pdfPath ? supabase.storage.from('images').getPublicUrl(pdfPath).data.publicUrl : ''
        const vendorId = row.vendor_id || row.vendorId
        return {
          id: row.id,
          title: row.title || row.nombre || 'Orden',
          quoteNumber: row.quote_number || row.cotizacion || undefined,
          pdfName: row.pdf_name || (pdfPath ? pdfPath.split('/').pop() : '') || 'archivo.pdf',
          pdfUrl: publicUrl,
          pdfPath,
          status: (row.status as ProductionStatus) || 'Recibida',
          createdAt: row.created_at || new Date().toISOString(),
          vendorId: vendorId ? String(vendorId) : undefined,
          vendorName: vendorId ? vendorMap[String(vendorId)] : undefined
        }
      })
      setOrders(list)
    }
    loadOrders()
  }, [])

  const totalOrders = orders.length
  const progress = useMemo(() => {
    if (orders.length === 0) return 0
    const weights: Record<ProductionStatus, number> = {
      'Recibida': 0,
      'En proceso': 0.25,
      'Terminada': 0.5,
      'En camino': 0.75,
      'Entregada': 1
    }
    const sum = orders.reduce((s, o) => s + (weights[o.status] || 0), 0)
    return Math.round((sum / orders.length) * 100)
  }, [orders])

  function getStatusProgress(status: ProductionStatus): number {
    const weights: Record<ProductionStatus, number> = {
      'Recibida': 0,
      'En proceso': 25,
      'Terminada': 50,
      'En camino': 75,
      'Entregada': 100
    }
    return weights[status] || 0
  }

  async function handleAddOrder() {
    if (!file) return
    const now = new Date()
    const newTitle = title || file.name.replace(/\.pdf$/i, '')
    const fileName = `${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9_.-]/g, '_')}`
    const storagePath = `OrdenesP/${fileName}`

    // Upload PDF to storage
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(storagePath, file, { contentType: 'application/pdf', upsert: false })
    if (uploadError) return

    const publicUrl = supabase.storage.from('images').getPublicUrl(storagePath).data.publicUrl

    // Get vendor name
    const selectedVendor = employees.find(emp => emp.id === selectedVendorId)
    
    // Insert DB row
    const { data: inserted, error: insertError } = await supabase
      .from('OrdenesProduccion')
      .insert({
        title: newTitle,
        quote_number: quoteNumber || null,
        pdf_path: storagePath,
        pdf_name: file.name,
        status: 'Recibida',
        created_at: now.toISOString(),
        vendor_id: selectedVendorId || null
      })
      .select()
      .single()
    if (insertError || !inserted) return

    const order: ProductionOrder = {
      id: inserted.id,
      title: inserted.title || newTitle,
      quoteNumber: inserted.quote_number || undefined,
      pdfName: inserted.pdf_name || file.name,
      pdfUrl: publicUrl,
      pdfPath: storagePath,
      status: inserted.status as ProductionStatus,
      createdAt: inserted.created_at || now.toISOString(),
      vendorId: selectedVendorId || undefined,
      vendorName: selectedVendor?.name || undefined
    }
    setOrders(prev => [order, ...prev])
    setTitle('')
    setQuoteNumber('')
    setFile(null)
  }

  async function updateStatus(id: string, status: ProductionStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    await supabase.from('OrdenesProduccion').update({ status }).eq('id', id)
  }

  async function removeOrder(id: string) {
    const target = orders.find(o => o.id === id)
    setOrders(prev => prev.filter(o => o.id !== id))
    await supabase.from('OrdenesProduccion').delete().eq('id', id)
    if (target?.pdfPath) {
      await supabase.storage.from('images').remove([target.pdfPath])
    }
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-black">Órdenes de producción</h1>
        <p className="text-xs sm:text-sm text-gray-600">Sube la cotización en PDF y supervisa el estado en fábrica.</p>
      </div>

      {/* Create order */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 mb-3 sm:mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <div className="sm:col-span-2">
            <label className="text-[10px] text-gray-600 mb-1 block">Título (opcional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="Nombre de la orden" />
          </div>
          <div>
            <label className="text-[10px] text-gray-600 mb-1 block">N° Cotización (opcional)</label>
            <input value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="Ej. COT-00123" />
          </div>
          <div>
            <label className="text-[10px] text-gray-600 mb-1 block">Vendedor</label>
            <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" disabled={employees.length === 0}>
              {employees.length === 0 ? (
                <option value="">Cargando empleados...</option>
              ) : (
                employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))
              )}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-gray-600 mb-1 block">Archivo PDF</label>
            <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" />
          </div>
        </div>
        <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button onClick={handleAddOrder} disabled={!file} className="border rounded px-3 py-2 text-xs sm:text-sm bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed">Crear orden</button>
          {file && <div className="text-[11px] sm:text-xs text-gray-600">Seleccionado: {file.name}</div>}
        </div>
      </div>

      

      {/* Orders table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] text-gray-600 bg-gray-50 border-b px-3 py-2">
          <div className="col-span-3">Orden</div>
          <div className="col-span-2">Cotización</div>
          <div className="col-span-2">Vendedor</div>
          <div className="col-span-1">Fecha</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-2 text-right">Acciones</div>
        </div>
        {orders.length === 0 && (
          <div className="p-6 text-center text-xs sm:text-sm text-gray-500">No hay órdenes aún. Sube un PDF para crear una.</div>
        )}
        <div className="divide-y">
          {orders.map(order => (
            <div key={order.id} className="grid md:grid-cols-12 gap-2 px-3 py-3 items-center">
              <div className="md:col-span-3">
                <div className="text-sm font-medium text-gray-900 truncate">{order.title}</div>
                <a href={order.pdfUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline truncate">{order.pdfName}</a>
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${getStatusProgress(order.status)}%` }}
                    ></div>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-600">Progreso: {getStatusProgress(order.status)}%</div>
                </div>
              </div>
              <div className="md:col-span-2 text-[12px] text-gray-700">{order.quoteNumber || '—'}</div>
              <div className="md:col-span-2 text-[12px] text-gray-700">{order.vendorName || '—'}</div>
              <div className="md:col-span-1 text-[12px] text-gray-700">{new Date(order.createdAt).toLocaleDateString()}</div>
              <div className="md:col-span-2">
                <select value={order.status} onChange={e => updateStatus(order.id, e.target.value as ProductionStatus)} className="w-full border rounded px-2 py-1 text-xs bg-white text-black focus:bg-white focus:text-black focus-visible:outline focus-visible:outline-1 focus-visible:outline-black">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex md:justify-end gap-2">
                <a href={order.pdfUrl} target="_blank" rel="noreferrer" className="border rounded px-2 py-1 text-[11px] text-black visited:text-black hover:text-black hover:bg-gray-50">Ver</a>
                <button onClick={() => removeOrder(order.id)} className="text-red-600 text-[11px]">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


