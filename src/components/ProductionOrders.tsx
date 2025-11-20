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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 sm:mb-6 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">Crear nueva orden de producción</h2>
          <p className="text-xs sm:text-sm text-gray-600">Completa los datos y sube el PDF de la cotización</p>
        </div>

        {/* Form Content */}
        <div className="p-4 sm:p-6">
          <div className="space-y-5">
            {/* Primera fila: Título y Cotización */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <span>Título</span>
                  <span className="text-gray-400 font-normal text-[10px]">(opcional)</span>
                </label>
                <input 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm bg-white text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all" 
                  placeholder="Ej. Orden de producción #001" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <span>N° Cotización</span>
                  <span className="text-gray-400 font-normal text-[10px]">(opcional)</span>
                </label>
                <input 
                  value={quoteNumber} 
                  onChange={e => setQuoteNumber(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm bg-white text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all" 
                  placeholder="Ej. COT-20240101-001" 
                />
              </div>
            </div>

            {/* Segunda fila: Vendedor y Archivo PDF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Vendedor
                </label>
                <div className="relative">
                  <select 
                    value={selectedVendorId} 
                    onChange={e => setSelectedVendorId(e.target.value)} 
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all appearance-none pr-8 disabled:bg-gray-50 disabled:text-gray-500" 
                    disabled={employees.length === 0}
                  >
                    {employees.length === 0 ? (
                      <option value="">Cargando empleados...</option>
                    ) : (
                      employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <span>Archivo PDF</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <div className="text-center">
                        <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-gray-900">
                          {file ? 'Cambiar archivo' : 'Haz clic para seleccionar'}
                        </span>
                        <span className="text-[10px] text-gray-500 block mt-0.5">PDF únicamente</span>
                      </div>
                    </div>
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      onChange={e => setFile(e.target.files?.[0] || null)} 
                      className="hidden" 
                    />
                  </label>
                </div>
                {file && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-emerald-900 truncate">{file.name}</div>
                      <div className="text-[10px] text-emerald-700">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="text-emerald-600 hover:text-emerald-800 transition-colors flex-shrink-0"
                      type="button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Botón de acción */}
            <div className="pt-4 border-t border-gray-200">
              <button 
                onClick={handleAddOrder} 
                disabled={!file} 
                className="w-full sm:w-auto sm:min-w-[160px] px-6 py-3 rounded-lg bg-black hover:bg-gray-800 active:bg-gray-900 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:shadow-none"
              >
                {file ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Crear orden</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Selecciona un PDF primero</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      

      {/* Orders table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-semibold text-gray-700 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 px-4 sm:px-6 py-3 items-center">
          <div className="col-span-2 flex items-center">Orden</div>
          <div className="col-span-4 flex items-center">Progreso</div>
          <div className="col-span-1 flex items-center">Vendedor</div>
          <div className="col-span-1 flex items-center">Fecha</div>
          <div className="col-span-2 flex items-center">Estado</div>
          <div className="col-span-2 flex items-center justify-end">Acciones</div>
        </div>
        
        {orders.length === 0 && (
          <div className="p-8 sm:p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500">No hay órdenes aún</p>
            <p className="text-xs text-gray-400 mt-1">Sube un PDF para crear una orden de producción</p>
          </div>
        )}
        
        <div className="divide-y divide-gray-100">
          {orders.map(order => (
            <div key={order.id} className="grid md:grid-cols-12 gap-4 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors items-center">
              {/* Orden */}
              <div className="md:col-span-2 flex items-center">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-900 truncate">{order.title}</span>
                </div>
              </div>
              
              {/* Progreso */}
              <div className="md:col-span-4 flex items-center">
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-600">Progreso</span>
                    <span className="text-xs font-bold text-gray-900">{getStatusProgress(order.status)}%</span>
                  </div>
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${getStatusProgress(order.status)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              {/* Vendedor */}
              <div className="md:col-span-1 flex items-center">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs sm:text-sm text-gray-700 truncate">{order.vendorName || <span className="text-gray-400">—</span>}</span>
                </div>
              </div>
              
              {/* Fecha */}
              <div className="md:col-span-1 flex items-center">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-700 whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
              
              {/* Estado */}
              <div className="md:col-span-2 flex items-center">
                <div className="relative w-full">
                  <select 
                    value={order.status} 
                    onChange={e => updateStatus(order.id, e.target.value as ProductionStatus)} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all appearance-none pr-8 hover:border-gray-400"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Acciones */}
              <div className="md:col-span-2 flex md:justify-end items-center gap-1.5">
                <a 
                  href={order.pdfUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="inline-flex items-center justify-center border border-gray-300 rounded-lg p-1.5 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all"
                  title="Ver PDF"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </a>
                <button 
                  onClick={() => {
                    if (confirm('¿Estás seguro de que deseas eliminar esta orden?')) {
                      removeOrder(order.id)
                    }
                  }}
                  className="inline-flex items-center justify-center p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                  title="Eliminar orden"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


