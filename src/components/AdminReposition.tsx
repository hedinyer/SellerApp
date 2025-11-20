import { useState, useEffect } from 'react'
import './animations.css'
import './config-styles.css'
import { useConfig } from '../contexts/ConfigContext'
import { supabase } from '../lib/supabaseClient'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  SearchIcon,
  FilterIcon,
  HistoryIcon
} from './icons'

interface SolicitudReposicion {
  id: string
  garment_id: string
  sku: string
  producto_nombre: string
  cantidad_actual: number
  umbral: number
  cantidad_solicitada: number | null
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'
  solicitado_por: string | null
  notas: string | null
  created_at: string
  updated_at: string
  image_url?: string
  color?: string
  size?: string
}

export function AdminReposition() {
  const [isLoading, setIsLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<SolicitudReposicion[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEstado, setFilterEstado] = useState<string>('all')
  const { getFontSizeClass } = useConfig()

  // Cargar datos desde Supabase
  useEffect(() => {
    loadSolicitudes()
  }, [])

  async function loadSolicitudes() {
    try {
      setIsLoading(true)
      // Obtener solicitudes con información del producto
      const { data: solicitudesData, error: solicitudesError } = await supabase
        .from('solicitudes_reposicion')
        .select('*')
        .order('created_at', { ascending: false })

      if (solicitudesError) {
        console.error('Error cargando solicitudes:', solicitudesError)
        return
      }

      if (solicitudesData && solicitudesData.length > 0) {
        // Obtener todos los garment_ids únicos
        const garmentIds = [...new Set(solicitudesData.map(s => s.garment_id).filter(Boolean))]
        const skus = [...new Set(solicitudesData.map(s => s.sku).filter(Boolean))]
        
        // Obtener todos los productos de una vez usando múltiples consultas si es necesario
        let garmentsData: any[] = []
        
        if (garmentIds.length > 0) {
          const { data: dataById } = await supabase
            .from('garments')
            .select('id, sku, image_url, color, size')
            .in('id', garmentIds)
          if (dataById) garmentsData.push(...dataById)
        }
        
        if (skus.length > 0) {
          const { data: dataBySku } = await supabase
            .from('garments')
            .select('id, sku, image_url, color, size')
            .in('sku', skus)
          if (dataBySku) {
            // Evitar duplicados
            const existingIds = new Set(garmentsData.map(g => g.id))
            garmentsData.push(...dataBySku.filter(g => !existingIds.has(g.id)))
          }
        }

        // Crear un mapa para búsqueda rápida
        const garmentsMap = new Map<string, { image_url?: string, color?: string, size?: string }>()
        garmentsData.forEach(garment => {
          if (garment.id) garmentsMap.set(garment.id, { image_url: garment.image_url || undefined, color: garment.color || undefined, size: garment.size || undefined })
          if (garment.sku) garmentsMap.set(garment.sku, { image_url: garment.image_url || undefined, color: garment.color || undefined, size: garment.size || undefined })
        })

        // Combinar solicitudes con información del producto
        const solicitudesConProducto = solicitudesData.map((solicitud) => {
          const garmentInfo = garmentsMap.get(solicitud.garment_id) || garmentsMap.get(solicitud.sku)
          return {
            ...solicitud,
            image_url: garmentInfo?.image_url,
            color: garmentInfo?.color,
            size: garmentInfo?.size
          } as SolicitudReposicion
        })

        setSolicitudes(solicitudesConProducto)
      } else {
        setSolicitudes([])
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Filtrar solicitudes
  const filteredSolicitudes = solicitudes.filter((solicitud) => {
    const matchesSearch =
      solicitud.producto_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      solicitud.sku.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesEstado = filterEstado === 'all' || solicitud.estado === filterEstado
    
    return matchesSearch && matchesEstado
  })

  const getEstadoBadge = (estado: string) => {
    if (!estado) {
      return <span className="text-xs text-gray-500">-</span>
    }
    
    const estadoLower = estado.toLowerCase()
    let bgColor = 'bg-gray-100'
    let textColor = 'text-gray-700'
    let label = estado
    
    if (estadoLower === 'pendiente') {
      bgColor = 'bg-yellow-100'
      textColor = 'text-yellow-700'
      label = 'Pendiente'
    } else if (estadoLower === 'en_proceso') {
      bgColor = 'bg-blue-100'
      textColor = 'text-blue-700'
      label = 'En proceso'
    } else if (estadoLower === 'completada') {
      bgColor = 'bg-green-100'
      textColor = 'text-green-700'
      label = 'Completada'
    } else if (estadoLower === 'cancelada') {
      bgColor = 'bg-red-100'
      textColor = 'text-red-700'
      label = 'Cancelada'
    }
    
    return (
      <span className={`text-xs px-2 py-1 rounded-full border border-gray-300 ${bgColor} ${textColor} font-medium`}>
        {label}
      </span>
    )
  }

  return (
    <div
      className={`min-h-screen bg-gray-50 transition-opacity duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      } ${getFontSizeClass()}`}
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6 lg:mb-8 animate-fadeInSlide">
          <h1 className="text-lg lg:text-xl font-bold text-gray-900">Gestión de Reposición</h1>
          <p className="text-xs lg:text-sm text-gray-600 font-normal mt-1">
            Administra y cambia los estados de las solicitudes de reposición de productos
          </p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 sm:mb-6 lg:mb-8 p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center">
            {/* Search */}
            <div className="flex-1 w-full sm:w-auto">
              <div className="relative">
                <SearchIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por producto o SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Filter by Estado */}
            <div className="w-full sm:w-auto">
              <div className="relative">
                <FilterIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="w-full sm:w-48 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white text-gray-900"
                >
                  <option value="all" className="text-gray-900">Todos los estados</option>
                  <option value="pendiente" className="text-gray-900">Pendiente</option>
                  <option value="en_proceso" className="text-gray-900">En Proceso</option>
                  <option value="completada" className="text-gray-900">Completada</option>
                  <option value="cancelada" className="text-gray-900">Cancelada</option>
                </select>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadSolicitudes}
              className="w-full sm:w-auto px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <HistoryIcon size={18} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-xl sm:rounded-[15px] border border-gray-200 shadow-sm mb-4 sm:mb-6 lg:mb-8 overflow-hidden">
          <div className="p-4 lg:p-6">
            <div className="mb-4">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">Inventario crítico</h2>
              <p className="text-xs lg:text-sm text-gray-600 mt-1">Productos por debajo del umbral</p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredSolicitudes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No se encontraron solicitudes de reposición</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="text-gray-600">
                        <th className="py-2 px-4 font-medium text-center align-middle">Producto</th>
                        <th className="py-2 px-4 font-medium text-center align-middle">Nombre</th>
                        <th className="py-2 px-4 font-medium text-center align-middle">SKU</th>
                        <th className="py-2 px-4 font-medium text-center align-middle">Color</th>
                        <th className="py-2 px-4 font-medium text-center align-middle">Talla</th>
                        <th className="py-2 px-4 font-medium text-center align-middle">Disponible</th>
                        <th className="py-2 px-4 font-medium text-center align-middle">Umbral</th>
                        <th className="py-2 px-4 font-medium text-center align-middle">Cantidad Solicitada</th>
                        <th className="py-2 px-4 font-medium text-center align-middle">Estado</th>
                        <th className="py-2 px-4 font-medium text-center align-middle">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSolicitudes.map((solicitud) => {
                        const isCritical = solicitud.cantidad_actual < solicitud.umbral
                        return (
                          <tr key={solicitud.id} className="border-t border-gray-100">
                            <td className="py-2 px-4 text-center align-middle">
                              <div className="flex justify-center">
                                {solicitud.image_url ? (
                                  <img 
                                    src={solicitud.image_url} 
                                    alt={solicitud.producto_nombre}
                                    className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                                    <span className="text-gray-400 text-xs">IMG</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-gray-800 text-center align-middle">{solicitud.producto_nombre}</td>
                            <td className="py-2 px-4 text-gray-600 text-center align-middle">{solicitud.sku}</td>
                            <td className="py-2 px-4 text-gray-600 text-center align-middle">{solicitud.color || 'N/A'}</td>
                            <td className="py-2 px-4 text-gray-600 text-center align-middle">{solicitud.size || 'N/A'}</td>
                            <td className={`py-2 px-4 font-semibold text-center align-middle ${
                              isCritical ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {solicitud.cantidad_actual}
                            </td>
                            <td className="py-2 px-4 text-gray-600 text-center align-middle">{solicitud.umbral}</td>
                            <td className="py-2 px-4 text-center align-middle">
                              <span className="text-xs font-medium text-gray-900">
                                {solicitud.cantidad_solicitada !== null && solicitud.cantidad_solicitada !== undefined
                                  ? solicitud.cantidad_solicitada
                                  : '—'}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-center align-middle">
                              {getEstadoBadge(solicitud.estado)}
                            </td>
                            <td className="py-2 px-4 text-center align-middle">
                              <div className="flex items-center justify-center gap-1.5">
                                {solicitud.estado === 'pendiente' && (
                                  <>
                                    <button
                                      className="px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                                      onClick={async () => {
                                        const { error } = await supabase
                                          .from('solicitudes_reposicion')
                                          .update({ estado: 'en_proceso' })
                                          .eq('id', solicitud.id)
                                        
                                        if (!error) {
                                          loadSolicitudes()
                                        }
                                      }}
                                    >
                                      Iniciar proceso
                                    </button>
                                    <button
                                      className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                      onClick={async () => {
                                        if (confirm('¿Está seguro de cancelar esta solicitud?')) {
                                          const { error } = await supabase
                                            .from('solicitudes_reposicion')
                                            .update({ estado: 'cancelada' })
                                            .eq('id', solicitud.id)
                                          
                                          if (!error) {
                                            loadSolicitudes()
                                          }
                                        }
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                )}
                                {solicitud.estado === 'en_proceso' && (
                                  <>
                                    <button
                                      className="px-2.5 py-1 text-xs font-medium text-green-700 border border-green-300 rounded hover:bg-green-50 transition-colors"
                                      onClick={async () => {
                                        try {
                                          // 1. Actualizar el estado de la solicitud a completada
                                          const { error: updateError } = await supabase
                                            .from('solicitudes_reposicion')
                                            .update({ estado: 'completada' })
                                            .eq('id', solicitud.id)
                                          
                                          if (updateError) {
                                            console.error('Error actualizando estado:', updateError)
                                            alert('Error al actualizar el estado. Por favor, intenta de nuevo.')
                                            return
                                          }

                                          // 2. Si hay cantidad_solicitada, sumarla al inventario del producto
                                          if (solicitud.cantidad_solicitada !== null && solicitud.cantidad_solicitada > 0) {
                                            // Buscar el garment por SKU
                                            const { data: garmentData, error: garmentError } = await supabase
                                              .from('garments')
                                              .select('id, qty')
                                              .eq('sku', solicitud.sku)
                                              .limit(1)
                                              .single()

                                            if (garmentError) {
                                              console.error('Error buscando garment:', garmentError)
                                              alert('Error al buscar el producto. El estado se actualizó pero no se pudo actualizar el inventario.')
                                            } else if (garmentData) {
                                              // Calcular nuevo qty sumando la cantidad solicitada
                                              const currentQty = Number(garmentData.qty || 0)
                                              const newQty = currentQty + solicitud.cantidad_solicitada

                                              // Actualizar el qty en garments
                                              const { error: qtyError } = await supabase
                                                .from('garments')
                                                .update({ qty: newQty })
                                                .eq('id', garmentData.id)

                                              if (qtyError) {
                                                console.error('Error actualizando qty:', qtyError)
                                                alert('Error al actualizar el inventario. El estado se actualizó pero el inventario no se modificó.')
                                              } else {
                                                alert(`Solicitud completada. Se agregaron ${solicitud.cantidad_solicitada} unidades al inventario.`)
                                              }
                                            }
                                          } else {
                                            alert('Solicitud completada. (No se especificó cantidad solicitada)')
                                          }

                                          // Recargar las solicitudes
                                          loadSolicitudes()
                                        } catch (error) {
                                          console.error('Error inesperado:', error)
                                          alert('Error al completar la solicitud. Por favor, intenta de nuevo.')
                                        }
                                      }}
                                    >
                                      Completar
                                    </button>
                                    <button
                                      className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                      onClick={async () => {
                                        if (confirm('¿Está seguro de cancelar esta solicitud?')) {
                                          const { error } = await supabase
                                            .from('solicitudes_reposicion')
                                            .update({ estado: 'cancelada' })
                                            .eq('id', solicitud.id)
                                          
                                          if (!error) {
                                            loadSolicitudes()
                                          }
                                        }
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                )}
                                {solicitud.estado === 'completada' && (
                                  <span className="text-xs text-gray-500 font-medium">Completada</span>
                                )}
                                {solicitud.estado === 'cancelada' && (
                                  <span className="text-xs text-gray-500 font-medium">Cancelada</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Mobile Card View */}
                <div className="md:hidden p-3 space-y-3">
                  {filteredSolicitudes.map((solicitud) => {
                    const isCritical = solicitud.cantidad_actual < solicitud.umbral
                    return (
                      <div key={solicitud.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-start gap-3">
                          {solicitud.image_url ? (
                            <img 
                              src={solicitud.image_url} 
                              alt={solicitud.producto_nombre}
                              className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                              <span className="text-gray-400 text-xs">IMG</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">{solicitud.producto_nombre}</h4>
                            <p className="text-xs text-gray-600 mt-0.5">SKU: {solicitud.sku}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-600">Color: </span>
                            <span className="text-gray-800">{solicitud.color || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Talla: </span>
                            <span className="text-gray-800">{solicitud.size || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Disponible: </span>
                            <span className={`font-semibold ${
                              isCritical ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {solicitud.cantidad_actual}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Umbral: </span>
                            <span className="text-gray-800">{solicitud.umbral}</span>
                          </div>
                          {solicitud.cantidad_solicitada !== null && solicitud.cantidad_solicitada !== undefined && (
                            <div>
                              <span className="text-gray-600">Solicitada: </span>
                              <span className="font-semibold text-blue-700">{solicitud.cantidad_solicitada}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          {getEstadoBadge(solicitud.estado)}
                          <div className="flex items-center gap-2">
                            {solicitud.estado === 'pendiente' && (
                              <>
                                <button
                                  className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                                  onClick={async () => {
                                    const { error } = await supabase
                                      .from('solicitudes_reposicion')
                                      .update({ estado: 'en_proceso' })
                                      .eq('id', solicitud.id)
                                    
                                    if (!error) {
                                      loadSolicitudes()
                                    }
                                  }}
                                >
                                  Iniciar
                                </button>
                                <button
                                  className="px-2 py-1 bg-gray-500 text-white text-xs font-medium rounded hover:bg-gray-600 transition-colors"
                                  onClick={async () => {
                                    if (confirm('¿Está seguro de cancelar esta solicitud?')) {
                                      const { error } = await supabase
                                        .from('solicitudes_reposicion')
                                        .update({ estado: 'cancelada' })
                                        .eq('id', solicitud.id)
                                      
                                      if (!error) {
                                        loadSolicitudes()
                                      }
                                    }
                                  }}
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                            {solicitud.estado === 'en_proceso' && (
                              <>
                                <button
                                  className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                                  onClick={async () => {
                                    try {
                                      const { error: updateError } = await supabase
                                        .from('solicitudes_reposicion')
                                        .update({ estado: 'completada' })
                                        .eq('id', solicitud.id)
                                      
                                      if (updateError) {
                                        console.error('Error actualizando estado:', updateError)
                                        alert('Error al actualizar el estado. Por favor, intenta de nuevo.')
                                        return
                                      }

                                      if (solicitud.cantidad_solicitada !== null && solicitud.cantidad_solicitada > 0) {
                                        const { data: garmentData, error: garmentError } = await supabase
                                          .from('garments')
                                          .select('id, qty')
                                          .eq('sku', solicitud.sku)
                                          .limit(1)
                                          .single()

                                        if (garmentError) {
                                          console.error('Error buscando garment:', garmentError)
                                          alert('Error al buscar el producto. El estado se actualizó pero no se pudo actualizar el inventario.')
                                        } else if (garmentData) {
                                          const currentQty = Number(garmentData.qty || 0)
                                          const newQty = currentQty + solicitud.cantidad_solicitada

                                          const { error: qtyError } = await supabase
                                            .from('garments')
                                            .update({ qty: newQty })
                                            .eq('id', garmentData.id)

                                          if (qtyError) {
                                            console.error('Error actualizando qty:', qtyError)
                                            alert('Error al actualizar el inventario. El estado se actualizó pero el inventario no se modificó.')
                                          } else {
                                            alert(`Solicitud completada. Se agregaron ${solicitud.cantidad_solicitada} unidades al inventario.`)
                                          }
                                        }
                                      } else {
                                        alert('Solicitud completada. (No se especificó cantidad solicitada)')
                                      }

                                      loadSolicitudes()
                                    } catch (error) {
                                      console.error('Error inesperado:', error)
                                      alert('Error al completar la solicitud. Por favor, intenta de nuevo.')
                                    }
                                  }}
                                >
                                  Completar
                                </button>
                                <button
                                  className="px-2 py-1 bg-gray-500 text-white text-xs font-medium rounded hover:bg-gray-600 transition-colors"
                                  onClick={async () => {
                                    if (confirm('¿Está seguro de cancelar esta solicitud?')) {
                                      const { error } = await supabase
                                        .from('solicitudes_reposicion')
                                        .update({ estado: 'cancelada' })
                                        .eq('id', solicitud.id)
                                      
                                      if (!error) {
                                        loadSolicitudes()
                                      }
                                    }
                                  }}
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                            {solicitud.estado === 'completada' && (
                              <span className="text-xs text-gray-500 font-medium">Completada</span>
                            )}
                            {solicitud.estado === 'cancelada' && (
                              <span className="text-xs text-gray-500 font-medium">Cancelada</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

