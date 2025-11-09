import { useState, useEffect } from 'react'
import './animations.css'
import './config-styles.css'
import { useConfig } from '../contexts/ConfigContext'
import { HammerIcon, AlertTriangleIcon } from './icons'
import { supabase } from '../lib/supabaseClient'

interface ProductionOrder {
  id: string
  numero_orden: string
  estado: string
  created_at: string
  updated_at: string
  datos_cliente?: any
  items?: any[]
  notas?: string
}

export function Fabrica() {
  const [isLoading, setIsLoading] = useState(true)
  const { getFontSizeClass } = useConfig()
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')

  useEffect(() => {
    async function loadOrders() {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('production_orders')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading orders:', error)
        } else {
          setOrders(data || [])
        }
      } catch (error) {
        console.error('Error loading orders:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [])

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    const estado = order.estado?.toLowerCase() || ''
    if (filter === 'pending') return estado === 'pendiente' || estado === 'pending'
    if (filter === 'in_progress') return estado === 'en_proceso' || estado === 'in_progress'
    if (filter === 'completed') return estado === 'completado' || estado === 'completed'
    return true
  })

  const getStatusColor = (estado: string) => {
    const estadoLower = estado?.toLowerCase() || ''
    if (estadoLower === 'pendiente' || estadoLower === 'pending') return 'bg-yellow-100 text-yellow-800'
    if (estadoLower === 'en_proceso' || estadoLower === 'in_progress') return 'bg-blue-100 text-blue-800'
    if (estadoLower === 'completado' || estadoLower === 'completed') return 'bg-green-100 text-green-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (estado: string) => {
    const estadoLower = estado?.toLowerCase() || ''
    if (estadoLower === 'pendiente' || estadoLower === 'pending') return 'Pendiente'
    if (estadoLower === 'en_proceso' || estadoLower === 'in_progress') return 'En Proceso'
    if (estadoLower === 'completado' || estadoLower === 'completed') return 'Completado'
    return estado || 'Desconocido'
  }

  return (
    <div 
      className={`h-full overflow-y-auto bg-white/40 backdrop-blur-md transition-opacity duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      } ${getFontSizeClass()}`} 
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="mb-4 sm:mb-6 lg:mb-8 animate-fadeInSlide">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-black mb-1 sm:mb-2 tracking-tight">
            Gestión de Fábrica
          </h1>
          <p className="text-gray-600 font-medium text-xs sm:text-sm lg:text-base">
            Administración de órdenes de producción
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-4 sm:mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === 'all'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === 'in_progress'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            En Proceso
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === 'completed'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Completadas
          </button>
        </div>

        {/* Lista de órdenes */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
            <HammerIcon size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium">No hay órdenes de producción</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <HammerIcon size={20} className="text-gray-600" />
                      <h3 className="text-lg font-bold text-gray-900">
                        Orden #{order.numero_orden || order.id.slice(0, 8)}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Creada: {new Date(order.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.estado)}`}>
                    {getStatusLabel(order.estado)}
                  </span>
                </div>
                
                {order.notas && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Notas:</span> {order.notas}
                    </p>
                  </div>
                )}

                {order.items && Array.isArray(order.items) && order.items.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Items:</p>
                    <div className="space-y-1">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm text-gray-600">
                          • {item.name || item.description || 'Item'} - Cantidad: {item.quantity || 0}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

