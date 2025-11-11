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
      const { data, error } = await supabase
        .from('solicitudes_reposicion')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error cargando solicitudes:', error)
        return
      }

      if (data) {
        setSolicitudes(data as SolicitudReposicion[])
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
    const badges = {
      pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      en_proceso: 'bg-blue-100 text-blue-800 border-blue-200',
      completada: 'bg-green-100 text-green-800 border-green-200',
      cancelada: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return badges[estado as keyof typeof badges] || badges.pendiente
  }

  const getEstadoLabel = (estado: string) => {
    const labels = {
      pendiente: 'Pendiente',
      en_proceso: 'En Proceso',
      completada: 'Completada',
      cancelada: 'Cancelada'
    }
    return labels[estado as keyof typeof labels] || estado
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                  className="w-full sm:w-48 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white"
                >
                  <option value="all">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="completada">Completada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadSolicitudes}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Disponible
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Umbral
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Cantidad Solicitada
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSolicitudes.map((solicitud) => (
                      <tr
                        key={solicitud.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            {solicitud.cantidad_actual < solicitud.umbral ? (
                              <AlertTriangleIcon size={18} className="text-red-500 mr-2 flex-shrink-0" />
                            ) : (
                              <CheckCircleIcon size={18} className="text-green-500 mr-2 flex-shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-sm font-medium text-gray-900">{solicitud.producto_nombre}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-sm font-mono text-gray-600">{solicitud.sku}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-sm font-semibold ${
                              solicitud.cantidad_actual < solicitud.umbral
                                ? 'text-red-600'
                                : 'text-gray-900'
                            }`}
                          >
                            {solicitud.cantidad_actual}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-sm text-gray-600">{solicitud.umbral}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-sm font-medium text-gray-900">
                            {solicitud.cantidad_solicitada !== null && solicitud.cantidad_solicitada !== undefined
                              ? solicitud.cantidad_solicitada
                              : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getEstadoBadge(
                              solicitud.estado
                            )}`}
                          >
                            {getEstadoLabel(solicitud.estado)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {solicitud.estado === 'pendiente' && (
                              <>
                                <button
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
                                  className="px-3 py-1.5 bg-gray-500 text-white text-xs font-medium rounded-lg hover:bg-gray-600 transition-colors"
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
                                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
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
                                  className="px-3 py-1.5 bg-gray-500 text-white text-xs font-medium rounded-lg hover:bg-gray-600 transition-colors"
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

