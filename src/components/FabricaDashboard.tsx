import { useState, useEffect, useMemo } from 'react'
import './animations.css'
import './config-styles.css'
import SpotlightCard from './SpotlightCard'
import { useConfig } from '../contexts/ConfigContext'
import {
  TableIcon,
  FileTextIcon,
  HammerIcon,
  AlertTriangleIcon
} from './icons'
import { LineChart, Line, ResponsiveContainer, CartesianGrid, YAxis, XAxis } from 'recharts'
import { supabase } from '../lib/supabaseClient'

export function FabricaDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const { formatCurrency, getFontSizeClass } = useConfig()

  const numberFormatter = useMemo(() => new Intl.NumberFormat('es-ES'), [])
  const formatThousands = (value: number) => (Number.isFinite(value) ? numberFormatter.format(value) : value)

  const [totalOrders, setTotalOrders] = useState(0)
  const [pendingOrders, setPendingOrders] = useState(0)
  const [inProgressOrders, setInProgressOrders] = useState(0)
  const [completedOrders, setCompletedOrders] = useState(0)
  const [totalQuotes, setTotalQuotes] = useState(0)
  const [inventoryItems, setInventoryItems] = useState(0)
  const [lowStockItems, setLowStockItems] = useState(0)
  const [ordersHistory, setOrdersHistory] = useState<{ date: string, pending: number, inProgress: number, completed: number }[]>([])

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const now = new Date()
        const startOfToday = new Date(now)
        startOfToday.setHours(0, 0, 0, 0)
        const startOfWeek = new Date(startOfToday)
        startOfWeek.setDate(startOfToday.getDate() - 6)

        // Cargar órdenes de producción
        const { data: ordersData } = await supabase
          .from('production_orders')
          .select('id, estado, created_at')
          .order('created_at', { ascending: false })

        if (ordersData) {
          setTotalOrders(ordersData.length)
          setPendingOrders(ordersData.filter((o: any) => {
            const estado = (o.estado || '').toLowerCase()
            return estado === 'pendiente' || estado === 'pending'
          }).length)
          setInProgressOrders(ordersData.filter((o: any) => {
            const estado = (o.estado || '').toLowerCase()
            return estado === 'en_proceso' || estado === 'in_progress'
          }).length)
          setCompletedOrders(ordersData.filter((o: any) => {
            const estado = (o.estado || '').toLowerCase()
            return estado === 'completado' || estado === 'completed'
          }).length)

          // Preparar datos históricos para gráficos (últimos 7 días)
          const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
          const history = days.map((day, index) => {
            const date = new Date(startOfToday)
            date.setDate(startOfToday.getDate() - (6 - index))
            const dateStr = date.toISOString().split('T')[0]
            
            const dayOrders = ordersData.filter((o: any) => {
              const orderDate = o.created_at ? o.created_at.split('T')[0] : ''
              return orderDate === dateStr
            })

            return {
              date: day,
              pending: dayOrders.filter((o: any) => {
                const estado = (o.estado || '').toLowerCase()
                return estado === 'pendiente' || estado === 'pending'
              }).length,
              inProgress: dayOrders.filter((o: any) => {
                const estado = (o.estado || '').toLowerCase()
                return estado === 'en_proceso' || estado === 'in_progress'
              }).length,
              completed: dayOrders.filter((o: any) => {
                const estado = (o.estado || '').toLowerCase()
                return estado === 'completado' || estado === 'completed'
              }).length
            }
          })
          setOrdersHistory(history)
        }

        // Cargar cotizaciones
        const { data: quotesData } = await supabase
          .from('quotes')
          .select('id')
          .order('created_at', { ascending: false })

        if (quotesData) {
          setTotalQuotes(quotesData.length)
        }

        // Cargar inventario
        const { data: garmentsData } = await supabase
          .from('garments')
          .select('id, qty, low_stock_threshold')

        if (garmentsData) {
          setInventoryItems(garmentsData.length)
          const lowStock = garmentsData.filter((g: any) => 
            typeof g.qty === 'number' && 
            typeof g.low_stock_threshold === 'number' && 
            g.qty < g.low_stock_threshold
          )
          setLowStockItems(lowStock.length)
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Datos para gráficos
  const chartDataOrders = useMemo(() => {
    return ordersHistory.map(d => ({
      date: d.date,
      v: d.pending + d.inProgress + d.completed
    }))
  }, [ordersHistory])

  const chartDataPending = useMemo(() => {
    return ordersHistory.map(d => ({ date: d.date, v: d.pending }))
  }, [ordersHistory])

  const chartDataInProgress = useMemo(() => {
    return ordersHistory.map(d => ({ date: d.date, v: d.inProgress }))
  }, [ordersHistory])

  const chartDataCompleted = useMemo(() => {
    return ordersHistory.map(d => ({ date: d.date, v: d.completed }))
  }, [ordersHistory])

  return (
    <div 
      className={`h-full overflow-y-auto bg-gray-50 transition-opacity duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      } ${getFontSizeClass()}`}
    >
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-8 lg:mb-10">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 tracking-tight">
            Dashboard de Fábrica
          </h1>
          <p className="text-sm text-gray-600">
            Hoy • {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Resumen de Órdenes - Estilo similar a AdminDashboard */}
        <div className="relative rounded-[16px] border border-gray-200 shadow-sm mb-8 lg:mb-10 p-4 lg:p-6 overflow-hidden bg-white">
          <div className="relative z-10">
            <div className="mb-4">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900">Resumen de Órdenes</h2>
              <p className="text-xs lg:text-sm text-gray-600 font-normal mt-1">Estado de las órdenes de producción</p>
            </div>
            <div className="grid grid-cols-2 lg:flex lg:justify-center gap-3 lg:gap-4">
              {/* Total Órdenes */}
              <div className="w-full lg:w-64">
                <SpotlightCard spotlightColor="rgba(59,130,246,0.08)">
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Total</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(totalOrders)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Órdenes</p>
                      </div>
                      <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                        <ResponsiveContainer width="100%" height={48}>
                          <LineChart data={chartDataOrders} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                            <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

              {/* Órdenes Pendientes */}
              <div className="w-full lg:w-64">
                <SpotlightCard spotlightColor="rgba(251,191,36,0.08)">
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(251,191,36,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Pendientes</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(pendingOrders)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">En espera</p>
                      </div>
                      <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                        <ResponsiveContainer width="100%" height={48}>
                          <LineChart data={chartDataPending} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                            <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Line type="monotone" dataKey="v" stroke="#fbbf24" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

              {/* Órdenes en Proceso */}
              <div className="w-full lg:w-64">
                <SpotlightCard spotlightColor="rgba(251,146,60,0.08)">
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(251,146,60,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">En Proceso</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(inProgressOrders)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Producción</p>
                      </div>
                      <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                        <ResponsiveContainer width="100%" height={48}>
                          <LineChart data={chartDataInProgress} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                            <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Line type="monotone" dataKey="v" stroke="#fb923c" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

              {/* Órdenes Completadas */}
              <div className="w-full lg:w-64">
                <SpotlightCard spotlightColor="rgba(34,197,94,0.08)">
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '300ms', boxShadow: '0 4px 16px 0 rgba(34,197,94,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Completadas</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(completedOrders)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Finalizadas</p>
                      </div>
                      <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                        <ResponsiveContainer width="100%" height={48}>
                          <LineChart data={chartDataCompleted} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                            <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Line type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen de Inventario y Cotizaciones */}
        <div className="relative rounded-[16px] border border-gray-200 shadow-sm mb-8 lg:mb-10 p-4 lg:p-6 overflow-hidden bg-white">
          <div className="relative z-10">
            <div className="mb-2">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900 text-center">Resumen de Inventario y Cotizaciones</h2>
              <div className="text-xs text-gray-500 font-normal text-center mt-1">{new Date().toLocaleDateString('es-ES')}</div>
            </div>
            <p className="text-xs lg:text-sm text-gray-600 font-normal mb-4 text-center">Indicadores clave de inventario y cotizaciones</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
              {/* Total Cotizaciones */}
              <div className="w-full">
                <SpotlightCard spotlightColor={'rgba(168,85,247,0.08)' as `rgba(${number}, ${number}, ${number}, ${number})`}>
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(168,85,247,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Cotizaciones</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(totalQuotes)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Total</p>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

              {/* Items en Inventario */}
              <div className="w-full">
                <SpotlightCard spotlightColor={'rgba(99,102,241,0.08)' as `rgba(${number}, ${number}, ${number}, ${number})`}>
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(99,102,241,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Items Inventario</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(inventoryItems)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Productos</p>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

              {/* Items Bajo Stock */}
              <div className="w-full">
                <SpotlightCard spotlightColor={'rgba(239,68,68,0.08)' as `rgba(${number}, ${number}, ${number}, ${number})`}>
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(239,68,68,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Bajo Stock</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(lowStockItems)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Requieren atención</p>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen Detallado */}
        <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm animate-slideInUp" style={{ animationDelay: '400ms' }}>
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-800 text-center">Resumen Detallado</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Órdenes Pendientes</span>
                <span className="text-sm font-bold text-gray-900">{pendingOrders}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Órdenes en Proceso</span>
                <span className="text-sm font-bold text-gray-900">{inProgressOrders}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Órdenes Completadas</span>
                <span className="text-sm font-bold text-gray-900">{completedOrders}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Total Órdenes</span>
                <span className="text-sm font-bold text-gray-900">{totalOrders}</span>
              </div>
            </div>
            {lowStockItems > 0 && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-700">⚠️ Items con Stock Bajo</span>
                  <span className="text-sm font-bold text-red-900">{lowStockItems}</span>
                </div>
                <p className="text-xs text-red-600 mt-2">Considera reponer estos productos pronto</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

