import { useState, useEffect } from 'react'
import { PageHeader } from './PageHeader'
import { supabase, ClienteRecord } from '../lib/supabaseClient'
import { PlusIcon, EditIcon, TrashIcon, XIcon, SaveIcon, SearchIcon, AlertTriangleIcon, HistoryIcon } from './icons'

interface ClienteForm {
  nombre: string
  telefono: string
  correo: string
  cedula: string
  direccion: string
  cumpleanos: string
}

export function Clients() {
  const [clientes, setClientes] = useState<ClienteRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [clientesConCompras, setClientesConCompras] = useState<Set<string>>(new Set())
  const [historialCliente, setHistorialCliente] = useState<ClienteRecord | null>(null)
  const [comprasCliente, setComprasCliente] = useState<any[]>([])
  const [isHistorialOpen, setIsHistorialOpen] = useState(false)

  const [form, setForm] = useState<ClienteForm>({
    nombre: '',
    telefono: '',
    correo: '',
    cedula: '',
    direccion: '',
    cumpleanos: ''
  })

  // Cargar clientes desde Supabase
  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (!error && data) {
        setClientes(data as ClienteRecord[])
      }
      setIsLoading(false)
    }
    load()
  }, [])

  // Verificar qué clientes tienen compras
  useEffect(() => {
    async function verificarCompras() {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('customer')
      
      if (error || !sales) return
      
      const clientesConComprasSet = new Set<string>()
      
      sales.forEach((sale: any) => {
        if (!sale.customer) return
        
        let customerData: any = {}
        try {
          customerData = typeof sale.customer === 'string' 
            ? JSON.parse(sale.customer) 
            : sale.customer
        } catch {
          customerData = sale.customer
        }
        
        // Buscar cliente por teléfono, correo o cédula
        const cliente = clientes.find(c => 
          (c.telefono && customerData.phone && c.telefono === customerData.phone) ||
          (c.correo && customerData.email && c.correo === customerData.email) ||
          (c.cedula && customerData.cedula && c.cedula === customerData.cedula)
        )
        
        if (cliente) {
          clientesConComprasSet.add(cliente.id)
        }
      })
      
      setClientesConCompras(clientesConComprasSet)
    }
    
    if (clientes.length > 0) {
      verificarCompras()
    }
  }, [clientes])

  // Filtrar clientes por búsqueda
  const filtered = clientes.filter(c => {
    const search = query.toLowerCase()
    return (
      c.nombre.toLowerCase().includes(search) ||
      (c.telefono && c.telefono.toLowerCase().includes(search)) ||
      (c.correo && c.correo.toLowerCase().includes(search)) ||
      (c.cedula && c.cedula.toLowerCase().includes(search)) ||
      (c.direccion && c.direccion.toLowerCase().includes(search))
    )
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize)

  function openCreate() {
    setForm({
      nombre: '',
      telefono: '',
      correo: '',
      cedula: '',
      direccion: '',
      cumpleanos: ''
    })
    setEditingId(null)
    setIsFormOpen(true)
  }

  function openEdit(id: string) {
    const cliente = clientes.find(c => c.id === id)
    if (cliente) {
      // Formatear la fecha si existe (YYYY-MM-DD para input type="date")
      let fechaCumpleanos = ''
      if (cliente.cumpleanos) {
        const fecha = new Date(cliente.cumpleanos)
        if (!isNaN(fecha.getTime())) {
          fechaCumpleanos = fecha.toISOString().split('T')[0]
        }
      }
      setForm({
        nombre: cliente.nombre,
        telefono: cliente.telefono || '',
        correo: cliente.correo || '',
        cedula: cliente.cedula || '',
        direccion: cliente.direccion || '',
        cumpleanos: fechaCumpleanos
      })
      setEditingId(id)
      setIsFormOpen(true)
    }
  }

  async function handleSave() {
    if (!form.nombre.trim()) {
      alert('El nombre es obligatorio')
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
        correo: form.correo.trim() || null,
        cedula: form.cedula.trim() || null,
        direccion: form.direccion.trim() || null,
        cumpleanos: form.cumpleanos.trim() || null,
        updated_at: new Date().toISOString()
      }

      if (editingId) {
        const { error } = await supabase
          .from('clientes')
          .update(payload)
          .eq('id', editingId)
        
        if (!error) {
          setClientes(clientes.map(c => 
            c.id === editingId ? { ...c, ...payload } : c
          ))
        } else {
          alert('Error al actualizar el cliente')
        }
      } else {
        const { data, error } = await supabase
          .from('clientes')
          .insert(payload)
          .select()
          .single()
        
        if (!error && data) {
          setClientes([data as ClienteRecord, ...clientes])
        } else {
          alert('Error al crear el cliente')
        }
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar el cliente')
    } finally {
      setIsLoading(false)
      setIsFormOpen(false)
      setEditingId(null)
      setForm({
        nombre: '',
        telefono: '',
        correo: '',
        cedula: '',
        direccion: '',
        cumpleanos: ''
      })
    }
  }

  function handleDelete(id: string) {
    setDeleteConfirmId(id)
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return
    
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', deleteConfirmId)
      
      if (!error) {
        setClientes(clientes.filter(c => c.id !== deleteConfirmId))
      } else {
        alert('Error al eliminar el cliente')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar el cliente')
    } finally {
      setIsLoading(false)
      setDeleteConfirmId(null)
    }
  }

  async function abrirHistorial(cliente: ClienteRecord) {
    setHistorialCliente(cliente)
    setIsHistorialOpen(true)
    
    // Cargar compras del cliente
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error || !sales) {
      setComprasCliente([])
      return
    }
    
    // Filtrar compras que correspondan al cliente
    const compras = sales.filter((sale: any) => {
      if (!sale.customer) return false
      
      let customerData: any = {}
      try {
        customerData = typeof sale.customer === 'string' 
          ? JSON.parse(sale.customer) 
          : sale.customer
      } catch {
        customerData = sale.customer
      }
      
      return (
        (cliente.telefono && customerData.phone && cliente.telefono === customerData.phone) ||
        (cliente.correo && customerData.email && cliente.correo === customerData.email) ||
        (cliente.cedula && customerData.cedula && cliente.cedula === customerData.cedula)
      )
    })
    
    setComprasCliente(compras)
  }

  const formatCurrency = (value: number | string) => {
    const num = Number(value)
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-3 sm:p-4">
      <PageHeader title="Clientes" subtitle="Gestión y seguimiento de clientes" />
      
      <div className="mt-3 sm:mt-4">
        {/* Barra de búsqueda y acciones */}
        <div className="mb-3 sm:mb-4 flex flex-col gap-2 sm:gap-3">
          <div className="relative">
            <SearchIcon size={16} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1) }}
              placeholder="Buscar por nombre, teléfono, correo..."
              className="w-full pl-8 sm:pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded bg-white text-black"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <button 
              onClick={openCreate} 
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded bg-black text-white text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2 hover:bg-gray-800"
            >
              <PlusIcon size={14} className="sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Agregar Nuevo Cliente</span><span className="xs:hidden">Agregar Cliente</span>
            </button>
            <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
              {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}
            </div>
          </div>
        </div>

        {/* Tabla de clientes */}
        <div className="bg-white border border-gray-200 rounded">
          <div className="p-2 sm:p-3 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="text-xs sm:text-sm text-gray-600">
              Página {page} de {totalPages || 1}
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span>Filas:</span>
              <select 
                value={pageSize} 
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} 
                className="border rounded px-2 py-1 text-xs sm:text-sm bg-white text-black"
              >
                {[10, 20, 50, 100].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {isLoading && clientes.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-500 text-xs sm:text-sm">
              Cargando clientes...
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto apple-scrollbar">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 bg-gray-50">
                      <th className="py-2 sm:py-3 px-3 sm:px-4 font-semibold">Nombre</th>
                      <th className="py-2 sm:py-3 px-3 sm:px-4 font-semibold">Teléfono</th>
                      <th className="py-2 sm:py-3 px-3 sm:px-4 font-semibold">Correo</th>
                      <th className="py-2 sm:py-3 px-3 sm:px-4 font-semibold">Cédula</th>
                      <th className="py-2 sm:py-3 px-3 sm:px-4 font-semibold">Cumpleaños</th>
                      <th className="py-2 sm:py-3 px-3 sm:px-4 font-semibold">Dirección</th>
                      <th className="py-2 sm:py-3 px-3 sm:px-4 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map(cliente => (
                      <tr key={cliente.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="py-2 sm:py-3 px-3 sm:px-4 text-gray-900 font-medium">
                          {cliente.nombre}
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4 text-gray-600">
                          {cliente.telefono || '-'}
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4 text-gray-600">
                          {cliente.correo || '-'}
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4 text-gray-600">
                          {cliente.cedula || '-'}
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4 text-gray-600">
                          {cliente.cumpleanos 
                            ? new Date(cliente.cumpleanos).toLocaleDateString('es-ES', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })
                            : '-'}
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4 text-gray-600">
                          {cliente.direccion || '-'}
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            {clientesConCompras.has(cliente.id) && (
                              <button
                                onClick={() => abrirHistorial(cliente)}
                                className="px-2 py-1 border rounded text-blue-600 hover:bg-blue-50 flex items-center gap-1 text-[10px] sm:text-xs"
                              >
                                <HistoryIcon size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Historial</span>
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(cliente.id)}
                              className="px-2 py-1 border rounded text-gray-700 hover:bg-gray-50 flex items-center gap-1 text-[10px] sm:text-xs"
                            >
                              <EditIcon size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Editar</span>
                            </button>
                            <button
                              onClick={() => handleDelete(cliente.id)}
                              className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 flex items-center gap-1 text-[10px] sm:text-xs"
                            >
                              <TrashIcon size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden lg:inline">Eliminar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pageData.length === 0 && (
                      <tr>
                        <td className="py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm" colSpan={7}>
                          {query ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden p-3 space-y-3">
                {pageData.length > 0 ? (
                  pageData.map(cliente => (
                    <div key={cliente.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between pb-2 border-b border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{cliente.nombre}</p>
                          {cliente.telefono && (
                            <p className="text-xs text-gray-600 mt-0.5">📞 {cliente.telefono}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        {cliente.correo && (
                          <div>
                            <span className="text-gray-600">Correo: </span>
                            <span className="text-gray-800">{cliente.correo}</span>
                          </div>
                        )}
                        {cliente.cedula && (
                          <div>
                            <span className="text-gray-600">Cédula: </span>
                            <span className="text-gray-800">{cliente.cedula}</span>
                          </div>
                        )}
                        {cliente.cumpleanos && (
                          <div>
                            <span className="text-gray-600">Cumpleaños: </span>
                            <span className="text-gray-800">
                              {new Date(cliente.cumpleanos).toLocaleDateString('es-ES', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </span>
                          </div>
                        )}
                        {cliente.direccion && (
                          <div>
                            <span className="text-gray-600">Dirección: </span>
                            <span className="text-gray-800">{cliente.direccion}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                        {clientesConCompras.has(cliente.id) && (
                          <button
                            onClick={() => abrirHistorial(cliente)}
                            className="flex-1 px-2 py-1.5 border rounded text-blue-600 hover:bg-blue-50 text-[10px] sm:text-xs flex items-center justify-center gap-1"
                          >
                            <HistoryIcon size={12} /> Historial
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(cliente.id)}
                          className="flex-1 px-2 py-1.5 border rounded text-gray-700 hover:bg-gray-50 text-[10px] sm:text-xs flex items-center justify-center gap-1"
                        >
                          <EditIcon size={12} /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(cliente.id)}
                          className="flex-1 px-2 py-1.5 border rounded text-red-600 hover:bg-red-50 text-[10px] sm:text-xs flex items-center justify-center gap-1"
                        >
                          <TrashIcon size={12} /> Eliminar
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-xs sm:text-sm">
                    {query ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="p-2 sm:p-3 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs sm:text-sm">
                  <div className="text-gray-600 text-center sm:text-left">
                    Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} de {filtered.length}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-2 sm:px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50 text-xs sm:text-sm"
                    >
                      Anterior
                    </button>
                    <span className="text-gray-600 text-xs sm:text-sm">Página {page} / {totalPages}</span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="px-2 sm:px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50 text-xs sm:text-sm"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Formulario Agregar/Editar */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" style={{ minHeight: '100vh', height: '100%' }}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-black">
                  {editingId ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-600">Completa los campos del cliente</p>
              </div>
              <button
                onClick={() => {
                  setIsFormOpen(false)
                  setEditingId(null)
                  setForm({
                    nombre: '',
                    telefono: '',
                    correo: '',
                    cedula: '',
                    direccion: ''
                  })
                }}
                className="text-gray-500 hover:text-gray-800 text-lg sm:text-xl"
              >
                <XIcon size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded bg-white text-black text-xs sm:text-sm"
                  placeholder="Nombre completo del cliente"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={e => setForm({ ...form, telefono: e.target.value })}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded bg-white text-black text-xs sm:text-sm"
                  placeholder="Número de teléfono"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={form.correo}
                  onChange={e => setForm({ ...form, correo: e.target.value })}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded bg-white text-black text-xs sm:text-sm"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                  Cédula
                </label>
                <input
                  value={form.cedula}
                  onChange={e => setForm({ ...form, cedula: e.target.value })}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded bg-white text-black text-xs sm:text-sm"
                  placeholder="Número de cédula"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  value={form.cumpleanos}
                  onChange={e => setForm({ ...form, cumpleanos: e.target.value })}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded bg-white text-black text-xs sm:text-sm"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <textarea
                  value={form.direccion}
                  onChange={e => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded bg-white text-black text-xs sm:text-sm"
                  rows={3}
                  placeholder="Dirección completa del cliente"
                />
              </div>
            </div>
            <div className="p-3 sm:p-4 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  setIsFormOpen(false)
                  setEditingId(null)
                  setForm({
                    nombre: '',
                    telefono: '',
                    correo: '',
                    cedula: '',
                    direccion: ''
                  })
                }}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 border rounded text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1 text-xs sm:text-sm"
              >
                <XIcon size={14} className="sm:w-4 sm:h-4" /> Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading || !form.nombre.trim()}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                <SaveIcon size={14} className="sm:w-4 sm:h-4" /> {isLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de eliminación */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-md p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3 mb-3">
              <AlertTriangleIcon size={18} className="sm:w-5 sm:h-5 text-red-600" />
              <h4 className="font-semibold text-sm sm:text-base text-gray-900">¿Estás seguro?</h4>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 mb-4">
              Esta acción eliminará permanentemente el cliente. Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="w-full sm:w-auto px-3 py-2 border rounded text-gray-700 hover:bg-gray-50 text-xs sm:text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={isLoading}
                className="w-full sm:w-auto px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 text-xs sm:text-sm"
              >
                {isLoading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Compras */}
      {isHistorialOpen && historialCliente && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" style={{ minHeight: '100vh', height: '100%' }}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-black">
                  Historial de Compras
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-600">
                  {historialCliente.nombre} - {comprasCliente.length} {comprasCliente.length === 1 ? 'compra' : 'compras'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsHistorialOpen(false)
                  setHistorialCliente(null)
                  setComprasCliente([])
                }}
                className="text-gray-500 hover:text-gray-800 text-lg sm:text-xl"
              >
                <XIcon size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 apple-scrollbar">
              {comprasCliente.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-xs sm:text-sm">
                  No se encontraron compras para este cliente
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {comprasCliente.map((compra: any) => {
                    let items: any[] = []
                    let payments: any[] = []
                    
                    try {
                      items = typeof compra.items === 'string' 
                        ? JSON.parse(compra.items) 
                        : (compra.items || [])
                      payments = typeof compra.payments === 'string' 
                        ? JSON.parse(compra.payments) 
                        : (compra.payments || [])
                    } catch {
                      items = compra.items || []
                      payments = compra.payments || []
                    }

                    return (
                      <div key={compra.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0 mb-2 sm:mb-3">
                          <div>
                            <div className="font-semibold text-xs sm:text-sm text-gray-900">
                              Compra #{compra.id.slice(0, 8)}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 mt-1">
                              {formatDate(compra.created_at)} a las {formatTime(compra.created_at)}
                            </div>
                            {compra.seller && (
                              <div className="text-[10px] sm:text-xs text-gray-600 mt-1">
                                Vendedor: {compra.seller}
                              </div>
                            )}
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="font-bold text-base sm:text-lg text-gray-900">
                              {formatCurrency(compra.total)}
                            </div>
                            {Number(compra.discount) > 0 && (
                              <div className="text-[10px] sm:text-xs text-gray-500">
                                Descuento: {formatCurrency(compra.discount)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="mb-2 sm:mb-3">
                          <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-2">Productos:</div>
                          <div className="space-y-2">
                            {items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm bg-gray-50 p-2 rounded">
                                {item.imageUrl && (
                                  <img 
                                    src={item.imageUrl} 
                                    alt={item.name}
                                    className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate">{item.name}</div>
                                  {item.variantLabel && (
                                    <div className="text-[10px] sm:text-xs text-gray-600 truncate">{item.variantLabel}</div>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-gray-900 text-xs sm:text-sm">
                                    {item.quantity} x {formatCurrency(item.unitPrice)}
                                  </div>
                                  <div className="text-[10px] sm:text-xs text-gray-600">
                                    = {formatCurrency(Number(item.unitPrice) * Number(item.quantity))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-gray-200 pt-2 sm:pt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                            <div>
                              <span className="text-gray-600">Subtotal:</span>
                              <span className="ml-2 font-medium">{formatCurrency(compra.subtotal)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Total:</span>
                              <span className="ml-2 font-bold">{formatCurrency(compra.total)}</span>
                            </div>
                          </div>
                          {payments.length > 0 && (
                            <div className="mt-2 text-[10px] sm:text-xs text-gray-600">
                              <span className="font-semibold">Métodos de pago:</span>
                              <div className="flex flex-wrap gap-1 sm:gap-2 mt-1">
                                {payments.map((p: any, idx: number) => (
                                  <span key={idx}>
                                    {p.method === 'cash' ? 'Efectivo' : 
                                     p.method === 'card' ? 'Tarjeta' : 
                                     p.method === 'transfer' ? 'Transferencia' : p.method}: {formatCurrency(p.amount)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
