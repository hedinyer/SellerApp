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
  const [pendingQuotes, setPendingQuotes] = useState(0)
  const [approvedQuotes, setApprovedQuotes] = useState(0)
  const [rejectedQuotes, setRejectedQuotes] = useState(0)
  const [convertedQuotes, setConvertedQuotes] = useState(0)
  const [totalQuotesValue, setTotalQuotesValue] = useState(0)
  const [approvedQuotesValue, setApprovedQuotesValue] = useState(0)
  const [convertedQuotesValue, setConvertedQuotesValue] = useState(0)
  const [quotesToday, setQuotesToday] = useState(0)
  const [quotesWeek, setQuotesWeek] = useState(0)
  const [productionOrdersTotal, setProductionOrdersTotal] = useState(0)
  const [productionOrdersReceived, setProductionOrdersReceived] = useState(0)
  const [productionOrdersInProcess, setProductionOrdersInProcess] = useState(0)
  const [productionOrdersFinished, setProductionOrdersFinished] = useState(0)
  const [productionOrdersOnWay, setProductionOrdersOnWay] = useState(0)
  const [productionOrdersDelivered, setProductionOrdersDelivered] = useState(0)
  const [ordersHistory, setOrdersHistory] = useState<{ date: string, pending: number, inProgress: number, completed: number }[]>([])
  const [quotesHistory, setQuotesHistory] = useState<{ date: string, total: number, approved: number }[]>([])
  
  // Datos históricos diarios para las gráficas
  const [quotesHistoryDaily, setQuotesHistoryDaily] = useState<{ date: string, total: number, pending: number, approved: number, converted: number, rejected: number, today: number, week: number }[]>([])
  const [productionHistoryDaily, setProductionHistoryDaily] = useState<{ date: string, total: number, received: number, inProcess: number, finished: number, onWay: number, delivered: number }[]>([])

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const now = new Date()
        const startOfToday = new Date(now)
        startOfToday.setHours(0, 0, 0, 0)
        const startOfWeek = new Date(startOfToday)
        startOfWeek.setDate(startOfToday.getDate() - 6)
        
        // Fecha de inicio: 3 de noviembre de 2025
        const startDate = new Date('2025-11-03')
        startDate.setHours(0, 0, 0, 0)
        
        // Generar array de fechas desde startDate hasta hoy
        const dates: string[] = []
        const currentDate = new Date(startDate)
        while (currentDate <= startOfToday) {
          dates.push(currentDate.toISOString().split('T')[0])
          currentDate.setDate(currentDate.getDate() + 1)
        }

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

        // Cargar cotizaciones desde cotizaciones (desde startDate)
        const { data: quotesData } = await supabase
          .from('cotizaciones')
          .select('id, estado, total, created_at')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })

        if (quotesData) {
          setTotalQuotes(quotesData.length)
          
          // Cotizaciones por estado
          setPendingQuotes(quotesData.filter((q: any) => {
            const estado = (q.estado || '').toLowerCase()
            return estado === 'pendiente' || estado === 'pending' || !estado
          }).length)
          
          setApprovedQuotes(quotesData.filter((q: any) => {
            const estado = (q.estado || '').toLowerCase()
            return estado === 'aprobada' || estado === 'approved'
          }).length)
          
          setRejectedQuotes(quotesData.filter((q: any) => {
            const estado = (q.estado || '').toLowerCase()
            return estado === 'rechazada' || estado === 'rejected'
          }).length)
          
          setConvertedQuotes(quotesData.filter((q: any) => {
            const estado = (q.estado || '').toLowerCase()
            return estado === 'convertida' || estado === 'converted'
          }).length)
          
          // Valores de cotizaciones
          const totalValue = quotesData.reduce((sum: number, q: any) => sum + (Number(q.total) || 0), 0)
          setTotalQuotesValue(totalValue)
          
          const approvedValue = quotesData
            .filter((q: any) => {
              const estado = (q.estado || '').toLowerCase()
              return estado === 'aprobada' || estado === 'approved'
            })
            .reduce((sum: number, q: any) => sum + (Number(q.total) || 0), 0)
          setApprovedQuotesValue(approvedValue)
          
          const convertedValue = quotesData
            .filter((q: any) => {
              const estado = (q.estado || '').toLowerCase()
              return estado === 'convertida' || estado === 'converted'
            })
            .reduce((sum: number, q: any) => sum + (Number(q.total) || 0), 0)
          setConvertedQuotesValue(convertedValue)
          
          // Cotizaciones del día y semana
          const quotesTodayCount = quotesData.filter((q: any) => {
            const quoteDate = q.created_at ? new Date(q.created_at) : null
            return quoteDate && quoteDate >= startOfToday
          }).length
          setQuotesToday(quotesTodayCount)
          
          const quotesWeekCount = quotesData.filter((q: any) => {
            const quoteDate = q.created_at ? new Date(q.created_at) : null
            return quoteDate && quoteDate >= startOfWeek
          }).length
          setQuotesWeek(quotesWeekCount)
          
          // Preparar datos históricos de cotizaciones (últimos 7 días)
          const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
          const quotesHistoryData = days.map((day, index) => {
            const date = new Date(startOfToday)
            date.setDate(startOfToday.getDate() - (6 - index))
            const dateStr = date.toISOString().split('T')[0]
            
            const dayQuotes = quotesData.filter((q: any) => {
              const quoteDate = q.created_at ? q.created_at.split('T')[0] : ''
              return quoteDate === dateStr
            })
            
            return {
              date: day,
              total: dayQuotes.length,
              approved: dayQuotes.filter((q: any) => {
                const estado = (q.estado || '').toLowerCase()
                return estado === 'aprobada' || estado === 'approved'
              }).length
            }
          })
          setQuotesHistory(quotesHistoryData)
          
          // Crear datos históricos diarios desde startDate hasta hoy
          const quotesDailyHistory = dates.map(dateStr => {
            const dayQuotes = quotesData.filter((q: any) => {
              const quoteDate = q.created_at ? q.created_at.split('T')[0] : ''
              return quoteDate === dateStr
            })
            
            const getEstado = (estado: string) => {
              const e = (estado || '').toLowerCase()
              if (e === 'pendiente' || e === 'pending' || !estado) return 'pending'
              if (e === 'aprobada' || e === 'approved') return 'approved'
              if (e === 'convertida' || e === 'converted') return 'converted'
              if (e === 'rechazada' || e === 'rejected') return 'rejected'
              return 'other'
            }
            
            const date = new Date(dateStr)
            const isToday = dateStr === startOfToday.toISOString().split('T')[0]
            const isInWeek = date >= startOfWeek
            
            return {
              date: dateStr,
              total: dayQuotes.length,
              pending: dayQuotes.filter((q: any) => getEstado(q.estado) === 'pending').length,
              approved: dayQuotes.filter((q: any) => getEstado(q.estado) === 'approved').length,
              converted: dayQuotes.filter((q: any) => getEstado(q.estado) === 'converted').length,
              rejected: dayQuotes.filter((q: any) => getEstado(q.estado) === 'rejected').length,
              today: isToday ? dayQuotes.length : 0,
              week: isInWeek ? dayQuotes.length : 0
            }
          })
          setQuotesHistoryDaily(quotesDailyHistory)
        }
        
        // Cargar órdenes de producción desde OrdenesProduccion (desde startDate)
        const { data: productionOrdersData } = await supabase
          .from('OrdenesProduccion')
          .select('id, status, created_at')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
        
        if (productionOrdersData) {
          setProductionOrdersTotal(productionOrdersData.length)
          setProductionOrdersReceived(productionOrdersData.filter((o: any) => o.status === 'Recibida').length)
          setProductionOrdersInProcess(productionOrdersData.filter((o: any) => o.status === 'En proceso').length)
          setProductionOrdersFinished(productionOrdersData.filter((o: any) => o.status === 'Terminada').length)
          setProductionOrdersOnWay(productionOrdersData.filter((o: any) => o.status === 'En camino').length)
          setProductionOrdersDelivered(productionOrdersData.filter((o: any) => o.status === 'Entregada').length)
          
          // Crear datos históricos diarios desde startDate hasta hoy
          const productionDailyHistory = dates.map(dateStr => {
            const dayOrders = productionOrdersData.filter((o: any) => {
              const orderDate = o.created_at ? o.created_at.split('T')[0] : ''
              return orderDate === dateStr
            })
            
            return {
              date: dateStr,
              total: dayOrders.length,
              received: dayOrders.filter((o: any) => o.status === 'Recibida').length,
              inProcess: dayOrders.filter((o: any) => o.status === 'En proceso').length,
              finished: dayOrders.filter((o: any) => o.status === 'Terminada').length,
              onWay: dayOrders.filter((o: any) => o.status === 'En camino').length,
              delivered: dayOrders.filter((o: any) => o.status === 'Entregada').length
            }
          })
          setProductionHistoryDaily(productionDailyHistory)
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

  const chartDataQuotes = useMemo(() => {
    return quotesHistory.map(d => ({ date: d.date, v: d.total }))
  }, [quotesHistory])

  const chartDataQuotesApproved = useMemo(() => {
    return quotesHistory.map(d => ({ date: d.date, v: d.approved }))
  }, [quotesHistory])

  // Función para formatear fecha para el eje X (mostrar solo día/mes si hay muchos datos)
  const formatDateLabel = (dateStr: string, index: number, total: number) => {
    const date = new Date(dateStr)
    if (total > 30) {
      // Si hay más de 30 días, mostrar solo día/mes cada 7 días
      if (index % 7 === 0 || index === total - 1) {
        return `${date.getDate()}/${date.getMonth() + 1}`
      }
      return ''
    } else if (total > 14) {
      // Si hay más de 14 días, mostrar día/mes cada 3 días
      if (index % 3 === 0 || index === total - 1) {
        return `${date.getDate()}/${date.getMonth() + 1}`
      }
      return ''
    } else {
      // Si hay pocos días, mostrar día de la semana
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      return days[date.getDay()]
    }
  }
  
  // Datos para gráficos usando datos históricos reales
  const chartDataTotalQuotes = useMemo(() => {
    if (!quotesHistoryDaily || quotesHistoryDaily.length === 0) return []
    return quotesHistoryDaily.map((d, i) => ({
      v: d.total,
      label: formatDateLabel(d.date, i, quotesHistoryDaily.length)
    }))
  }, [quotesHistoryDaily])

  const chartDataPendingQuotes = useMemo(() => {
    if (!quotesHistoryDaily || quotesHistoryDaily.length === 0) return []
    return quotesHistoryDaily.map((d, i) => ({
      v: d.pending,
      label: formatDateLabel(d.date, i, quotesHistoryDaily.length)
    }))
  }, [quotesHistoryDaily])

  const chartDataApprovedQuotes = useMemo(() => {
    if (!quotesHistoryDaily || quotesHistoryDaily.length === 0) return []
    return quotesHistoryDaily.map((d, i) => ({
      v: d.approved,
      label: formatDateLabel(d.date, i, quotesHistoryDaily.length)
    }))
  }, [quotesHistoryDaily])

  const chartDataConvertedQuotes = useMemo(() => {
    if (!quotesHistoryDaily || quotesHistoryDaily.length === 0) return []
    return quotesHistoryDaily.map((d, i) => ({
      v: d.converted,
      label: formatDateLabel(d.date, i, quotesHistoryDaily.length)
    }))
  }, [quotesHistoryDaily])

  const chartDataQuotesToday = useMemo(() => {
    if (!quotesHistoryDaily || quotesHistoryDaily.length === 0) return []
    return quotesHistoryDaily.map((d, i) => ({
      v: d.today,
      label: formatDateLabel(d.date, i, quotesHistoryDaily.length)
    }))
  }, [quotesHistoryDaily])

  const chartDataQuotesWeek = useMemo(() => {
    if (!quotesHistoryDaily || quotesHistoryDaily.length === 0) return []
    // Mostrar valores de la semana (últimos 7 días desde cada fecha)
    return quotesHistoryDaily.map((d, i) => {
      // Calcular cuántas cotizaciones hubo en los últimos 7 días desde esta fecha
      const weekStart = new Date(d.date)
      weekStart.setDate(weekStart.getDate() - 6)
      const weekStartStr = weekStart.toISOString().split('T')[0]
      
      const weekCount = quotesHistoryDaily
        .filter((item, idx) => {
          const itemDate = item.date
          return itemDate >= weekStartStr && itemDate <= d.date
        })
        .reduce((sum, item) => sum + item.total, 0)
      
      return {
        v: weekCount,
        label: formatDateLabel(d.date, i, quotesHistoryDaily.length)
      }
    })
  }, [quotesHistoryDaily])

  const chartDataRejectedQuotes = useMemo(() => {
    if (!quotesHistoryDaily || quotesHistoryDaily.length === 0) return []
    return quotesHistoryDaily.map((d, i) => ({
      v: d.rejected,
      label: formatDateLabel(d.date, i, quotesHistoryDaily.length)
    }))
  }, [quotesHistoryDaily])

  const chartDataProductionTotal = useMemo(() => {
    if (!productionHistoryDaily || productionHistoryDaily.length === 0) return []
    return productionHistoryDaily.map((d, i) => ({
      v: d.total,
      label: formatDateLabel(d.date, i, productionHistoryDaily.length)
    }))
  }, [productionHistoryDaily])

  const chartDataProductionReceived = useMemo(() => {
    if (!productionHistoryDaily || productionHistoryDaily.length === 0) return []
    return productionHistoryDaily.map((d, i) => ({
      v: d.received,
      label: formatDateLabel(d.date, i, productionHistoryDaily.length)
    }))
  }, [productionHistoryDaily])

  const chartDataProductionInProcess = useMemo(() => {
    if (!productionHistoryDaily || productionHistoryDaily.length === 0) return []
    return productionHistoryDaily.map((d, i) => ({
      v: d.inProcess,
      label: formatDateLabel(d.date, i, productionHistoryDaily.length)
    }))
  }, [productionHistoryDaily])

  const chartDataProductionFinished = useMemo(() => {
    if (!productionHistoryDaily || productionHistoryDaily.length === 0) return []
    return productionHistoryDaily.map((d, i) => ({
      v: d.finished,
      label: formatDateLabel(d.date, i, productionHistoryDaily.length)
    }))
  }, [productionHistoryDaily])

  const chartDataProductionOnWay = useMemo(() => {
    if (!productionHistoryDaily || productionHistoryDaily.length === 0) return []
    return productionHistoryDaily.map((d, i) => ({
      v: d.onWay,
      label: formatDateLabel(d.date, i, productionHistoryDaily.length)
    }))
  }, [productionHistoryDaily])

  const chartDataProductionDelivered = useMemo(() => {
    if (!productionHistoryDaily || productionHistoryDaily.length === 0) return []
    return productionHistoryDaily.map((d, i) => ({
      v: d.delivered,
      label: formatDateLabel(d.date, i, productionHistoryDaily.length)
    }))
  }, [productionHistoryDaily])

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

        {/* Resumen Detallado */}
        <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm animate-slideInUp overflow-hidden" style={{ animationDelay: '400ms' }}>
          <div className="p-4 lg:p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h3 className="text-lg lg:text-xl font-bold text-gray-900">Resumen Detallado</h3>
            <p className="text-xs lg:text-sm text-gray-600 font-normal mt-1">Métricas consolidadas de cotizaciones y producción</p>
          </div>
          <div className="p-4 lg:p-6">
            {/* Sección Cotizaciones */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Cotizaciones</h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                {/* Total */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(34,197,94,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Total</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(totalQuotes)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">{formatCurrency(totalQuotesValue)}</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataTotalQuotes} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#34d399" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* Pendientes */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Pendientes</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(pendingQuotes)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">En revisión</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataPendingQuotes} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* Aprobadas */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(251,146,60,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Aprobadas</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(approvedQuotes)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">{formatCurrency(approvedQuotesValue)}</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataApprovedQuotes} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#fb923c" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* Convertidas */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '300ms', boxShadow: '0 4px 16px 0 rgba(168,85,247,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Convertidas</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(convertedQuotes)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">{formatCurrency(convertedQuotesValue)}</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataConvertedQuotes} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4 mt-4">
                {/* Hoy */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '400ms', boxShadow: '0 4px 16px 0 rgba(16,185,129,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Hoy</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{quotesToday}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Cotizaciones</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataQuotesToday} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* Esta Semana */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '500ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Esta Semana</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{quotesWeek}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Últimos 7 días</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataQuotesWeek} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* Rechazadas */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '600ms', boxShadow: '0 4px 16px 0 rgba(239,68,68,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Rechazadas</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(rejectedQuotes)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">No aprobadas</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataRejectedQuotes} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
              </div>
            </div>

            {/* Sección Órdenes de Producción */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Órdenes de Producción</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
                {/* Total */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '700ms', boxShadow: '0 4px 16px 0 rgba(34,197,94,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Total</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(productionOrdersTotal)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Órdenes</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataProductionTotal} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#34d399" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* Recibidas */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '800ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Recibidas</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(productionOrdersReceived)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Nuevas</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataProductionReceived} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* En Proceso */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '900ms', boxShadow: '0 4px 16px 0 rgba(251,146,60,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">En Proceso</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(productionOrdersInProcess)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Trabajando</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataProductionInProcess} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#fb923c" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* Terminadas */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '1000ms', boxShadow: '0 4px 16px 0 rgba(168,85,247,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Terminadas</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(productionOrdersFinished)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Completadas</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataProductionFinished} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* En Camino */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '1100ms', boxShadow: '0 4px 16px 0 rgba(16,185,129,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">En Camino</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(productionOrdersOnWay)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">En tránsito</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataProductionOnWay} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
                {/* Entregadas */}
                <div className="w-full">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '1200ms', boxShadow: '0 4px 16px 0 rgba(34,197,94,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full relative z-10">
                        <div className="flex flex-col items-center justify-center pt-1 pb-2">
                          <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Entregadas</h3>
                          <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatThousands(productionOrdersDelivered)}</p>
                          <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Finalizadas</p>
                        </div>
                        <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={chartDataProductionDelivered} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="v" stroke="#34d399" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
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
        </div>
      </div>
    </div>
  )
}

