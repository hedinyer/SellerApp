import { useState, useEffect, useMemo } from 'react'
import './animations.css'
import './config-styles.css'
import SpotlightCard from './SpotlightCard'
import { useConfig } from '../contexts/ConfigContext'
import {
  ClockIcon,
  TableIcon,
  UsersIcon,
  AlertTriangleIcon,
  EyeIcon,
  UserIcon,
  TrendingUpIcon,
  DollarSignIcon
} from './icons'
import { LineChart, Line, ResponsiveContainer, Area, CartesianGrid, YAxis, XAxis } from 'recharts';
import { supabase } from '../lib/supabaseClient'

interface SalesData {
  today: number
  week: number
  month: number
  year: number
}

interface EmployeeStats {
  id: string
  name: string
  role: string
  servicesCount: number
  totalTips: number
  avgServiceTime: string
  rating: number
  sales: number
  itemsSold?: number
  avgTicket?: number
}

interface DishStats {
  name: string
  orders: number
  revenue: number
  category: string
  trend: 'up' | 'down' | 'stable'
}

interface CustomerStats {
  totalToday: number
  totalWeek: number
  totalMonth: number
  avgTableTime: string
  returnRate: number
  satisfaction: number
}

// Componentes de iconos personalizados
const MoneyIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./Credit_Card_01.png" 
    alt="Dinero" 
    width={size} 
    height={size} 
    className={className}
  />
)

const TrendingUpCustomIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./Trending_Up.png" 
    alt="Trending Up" 
    width={size} 
    height={size} 
    className={className}
  />
)

const StarIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

// Custom Dot for the last point (larger)
const AnimatedDot = ({ cx, cy, index, data, color }: { cx: number, cy: number, index: number, data: any[], color: string }) => {
  if (index !== data.length - 1) return null;
  return (
    <circle cx={cx} cy={cy} r={9} fill={color} stroke="white" strokeWidth={3} />
  );
};

export function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const { formatCurrency, getFontSizeClass } = useConfig()
  const [salesData, setSalesData] = useState<SalesData>({ today: 0, week: 0, month: 0, year: 0 })
  const [customerStats, setCustomerStats] = useState<CustomerStats>({ totalToday: 0, totalWeek: 0, totalMonth: 0, avgTableTime: '-', returnRate: 0, satisfaction: 0 })
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
  const [topDishes, setTopDishes] = useState<DishStats[]>([])
  const [leastPopularDishes, setLeastPopularDishes] = useState<DishStats[]>([])

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true)
      try {
        const now = new Date()
        const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0)
        const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - 6)
        const startOfMonth = new Date(startOfToday); startOfMonth.setDate(1)
        const startOfYear = new Date(startOfToday); startOfYear.setMonth(0,1)

        // Pull recent window for computations (last 60 days)
        const since60d = new Date(startOfToday); since60d.setDate(startOfToday.getDate() - 60)

        const { data: salesRows } = await supabase
          .from('sales')
          .select('id, created_at, subtotal, discount, total, items, payments, customer, seller')
          .gte('created_at', since60d.toISOString())
          .order('created_at', { ascending: false })
          .limit(5000)

        const rows = (salesRows || []) as any[]

        // Normalize JSON fields that may arrive as strings
        const parsed = rows.map(r => {
          const parseJson = (v: any) => {
            if (!v) return undefined
            try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return undefined }
          }
          return {
            id: r.id as string,
            created_at: r.created_at as string,
            subtotal: Number(r.subtotal) || 0,
            discount: Number(r.discount) || 0,
            total: Number(r.total) || 0,
            items: (parseJson(r.items) as any[]) || [],
            payments: (parseJson(r.payments) as any[]) || [],
            customer: parseJson(r.customer) as any | undefined,
            seller: r.seller as string | undefined
          }
        })

        // Sales summary
        const sumInRange = (from: Date) => parsed
          .filter(s => new Date(s.created_at) >= from)
          .reduce((acc, s) => acc + s.total, 0)

        setSalesData({
          today: sumInRange(startOfToday),
          week: sumInRange(startOfWeek),
          month: sumInRange(startOfMonth),
          year: sumInRange(startOfYear)
        })

        // Customer stats (using sales count as proxy of comensales)
        const countInRange = (from: Date) => parsed.filter(s => new Date(s.created_at) >= from).length
        setCustomerStats({
          totalToday: countInRange(startOfToday),
          totalWeek: countInRange(startOfWeek),
          totalMonth: countInRange(startOfMonth),
          avgTableTime: '-',
          returnRate: 0,
          satisfaction: 0
        })

        // Per-seller today
        const bySeller = new Map<string, { servicesCount: number, total: number, items: number }>()
        parsed.filter(s => new Date(s.created_at) >= startOfToday).forEach(s => {
          const key = s.seller || 'Sin vendedor'
          const curr = bySeller.get(key) || { servicesCount: 0, total: 0, items: 0 }
          curr.servicesCount += 1
          curr.total += s.total
          try {
            const sumItems = (s.items || []).reduce((n: number, it: any) => n + (Number(it.quantity) || 0), 0)
            curr.items += sumItems
          } catch {}
          bySeller.set(key, curr)
        })
        const sellerStats: EmployeeStats[] = Array.from(bySeller.entries()).map(([seller, v], i) => ({
          id: String(i+1),
          name: seller,
          role: 'Vendedor',
          servicesCount: v.servicesCount,
          totalTips: 0,
          avgServiceTime: '-',
          rating: 4.7,
          sales: Number(v.total),
          itemsSold: Number(v.items),
          avgTicket: v.servicesCount > 0 ? Number(v.total) / v.servicesCount : 0
        }))
        setEmployeeStats(sellerStats)

        // Aggregate items sold today for top/least dishes
        const aggByKey = new Map<string, { name: string, sku?: string, quantity: number, revenue: number }>()
        parsed.filter(s => new Date(s.created_at) >= startOfMonth).forEach(s => {
          (s.items || []).forEach((it: any) => {
            const sku = it.sku as string | undefined
            const name = (it.name as string) || sku || 'Producto'
            const key = sku || name
            const curr = aggByKey.get(key) || { name, sku, quantity: 0, revenue: 0 }
            const qty = Number(it.quantity) || 0
            const price = Number(it.unitPrice) || 0
            curr.quantity += qty
            curr.revenue += qty * price
            aggByKey.set(key, curr)
          })
        })

        // Fetch minimal garments meta by sku for category
        let metaBySku = new Map<string, { category?: string }>()
        try {
          const skus = Array.from(aggByKey.values()).map(v => v.sku).filter(Boolean) as string[]
          if (skus.length) {
            const { data: garments } = await supabase
              .from('garments')
              .select('sku, category')
              .in('sku', Array.from(new Set(skus)))
            if (garments) {
              metaBySku = new Map((garments as any[]).map(g => [g.sku as string, { category: g.category as string | undefined }]))
            }
          }
        } catch {}

        const dishes = Array.from(aggByKey.values()).map(v => ({
          name: v.name,
          orders: v.quantity,
          revenue: Number(v.revenue),
          category: (v.sku && metaBySku.get(v.sku)?.category) || 'General',
          trend: 'stable' as const
        }))

        // Ordenar por más vendidos (desc)
        const sorted = dishes
          .filter(d => d.orders > 0)
          .sort((a,b) => b.orders - a.orders)

        // Top N sin repetir
        const TOP_N = 5
        const BOTTOM_N = 4
        const top = sorted.slice(0, TOP_N)
        const topNames = new Set(top.map(d => d.name))

        // Oportunidades: menos vendidos, excluyendo los top
        const bottomCandidates = [...sorted].reverse().filter(d => !topNames.has(d.name))
        const bottom = bottomCandidates.slice(0, BOTTOM_N)

        setTopDishes(top)
        setLeastPopularDishes(bottom)
      } finally {
        setIsLoading(false)
      }
    }
    loadDashboard()
  }, [])

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈'
      case 'down': return '📉'
      default: return '➖'
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600'
      case 'down': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  // Chart data derived from available KPIs (keep simple placeholders based on totals)
  const chartDataComensales = useMemo(() => {
    const base = customerStats.totalToday || 0
    return [0.6, 0.8, 0.7, 0.9, 0.75, 0.85, 1].map(p => ({ v: Math.max(0, Math.round(base * p)) }))
  }, [customerStats.totalToday])
  const chartDataTableTime = [{ v: 60 }, { v: 70 }, { v: 65 }, { v: 75 }, { v: 68 }, { v: 72 }, { v: 71 }]
  const chartDataReturnRate = [{ v: 40 }, { v: 45 }, { v: 50 }, { v: 55 }, { v: 52 }, { v: 57 }, { v: 58 }]
  const chartDataSatisfaction = [{ v: 4.1 }, { v: 4.2 }, { v: 4.3 }, { v: 4.2 }, { v: 4.4 }, { v: 4.3 }, { v: 4.4 }]

  const chartDataSalesToday = useMemo(() => {
    const v = Math.round(salesData.today)
    return [0.6, 0.7, 0.65, 0.75, 0.8, 0.7, 1].map(p => ({ v: Math.round(v * p) }))
  }, [salesData.today])
  const chartDataSalesWeek = useMemo(() => {
    const v = Math.round(salesData.week)
    return [0.6, 0.75, 0.8, 0.7, 1, 0.85, 1].map(p => ({ v: Math.round(v * p) }))
  }, [salesData.week])
  const chartDataSalesMonth = useMemo(() => {
    const v = Math.round(salesData.month)
    return [0.7, 0.8, 0.85, 0.82, 1, 0.97, 1].map(p => ({ v: Math.round(v * p) }))
  }, [salesData.month])
  const chartDataSalesYear = useMemo(() => {
    const v = Math.round(salesData.year)
    return [0.78, 0.86, 0.9, 0.95, 1, 0.98, 1].map(p => ({ v: Math.round(v * p) }))
  }, [salesData.year])
  const averageTicketToday = useMemo(() => {
    const count = Math.max(1, customerStats.totalToday || 0)
    return (salesData.today || 0) / count
  }, [salesData.today, customerStats.totalToday])
  const chartDataAvgTicketToday = useMemo(() => {
    const v = Math.round(averageTicketToday)
    return [0.7, 0.8, 0.75, 0.85, 0.9, 0.82, 1].map(p => ({ v: Math.max(0, Math.round(v * p)) }))
  }, [averageTicketToday])

  // Etiquetas para los ejes X de los charts de ventas
  const daysLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const weekLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const monthLabels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5', 'Semana 6', 'Semana 7']
  const yearLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul']

  return (
    <div 
      className={`h-full overflow-y-auto bg-gray-50 transition-opacity duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      } ${getFontSizeClass()}`}
    >
      <div className="p-4 lg:p-6">
        {/* Stats Overview - Combined */}
        <div
          className="relative rounded-[16px] border border-gray-200 shadow-sm mb-8 lg:mb-10 p-4 lg:p-6 overflow-hidden bg-white"
        >
          <div className="relative z-10">
            <div className="mb-4">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900">Resumen de Ventas</h2>
              <p className="text-xs lg:text-sm text-gray-600 font-normal mt-1">Visión general de las ventas del día, semana, mes y año</p>
            </div>
            <div className="grid grid-cols-2 lg:flex lg:justify-center gap-3 lg:gap-4">
              {/* Resumen de Ventas */}
          <div className="w-full lg:w-64">
            <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
              <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(34,197,94,0.15)' }}>
                <div className="absolute inset-0 pointer-events-none metallic-shine" />
                <div className="flex flex-col justify-between h-full relative z-10">
                  <div className="flex flex-col items-center justify-center pt-1 pb-2">
                    <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Hoy</h3>
                    <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(salesData.today)}</p>
                    <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Ventas del día</p>
                    </div>
                  <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                    <ResponsiveContainer width="100%" height={48}>
                      <LineChart data={chartDataSalesToday.map((d, i) => ({ ...d, label: daysLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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
          <div className="w-full lg:w-64">
            <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
              <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                <div className="absolute inset-0 pointer-events-none metallic-shine" />
                <div className="flex flex-col justify-between h-full relative z-10">
                  <div className="flex flex-col items-center justify-center pt-1 pb-2">
                    <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Semana</h3>
                    <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(salesData.week)}</p>
                    <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Últimos 7 días</p>
                    </div>
                  <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                    <ResponsiveContainer width="100%" height={48}>
                      <LineChart data={chartDataSalesWeek.map((d, i) => ({ ...d, label: weekLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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
          <div className="w-full lg:w-64">
            <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
              <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(251,146,60,0.15)' }}>
                <div className="absolute inset-0 pointer-events-none metallic-shine" />
                <div className="flex flex-col justify-between h-full relative z-10">
                  <div className="flex flex-col items-center justify-center pt-1 pb-2">
                    <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Mes</h3>
                    <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(salesData.month)}</p>
                    <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Mes actual</p>
                    </div>
                  <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                    <ResponsiveContainer width="100%" height={48}>
                      <LineChart data={chartDataSalesMonth.map((d, i) => ({ ...d, label: monthLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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
          <div className="w-full lg:w-64">
            <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
              <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '300ms', boxShadow: '0 4px 16px 0 rgba(168,85,247,0.15)' }}>
                <div className="absolute inset-0 pointer-events-none metallic-shine" />
                <div className="flex flex-col justify-between h-full relative z-10">
                  <div className="flex flex-col items-center justify-center pt-1 pb-2">
                    <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Año</h3>
                    <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(salesData.year)}</p>
                    <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Año en curso</p>
                    </div>
                  <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                    <ResponsiveContainer width="100%" height={48}>
                      <LineChart data={chartDataSalesYear.map((d, i) => ({ ...d, label: yearLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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
          </div>
        </div>

        

        {/* Resumen del Personal - Nuevo Diseño */}
        <div
          className="relative rounded-[16px] border border-gray-200 shadow-sm mb-8 lg:mb-10 p-4 lg:p-6 overflow-hidden bg-white"
        >
          <div className="relative z-10">
            <div className="mb-2">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900 text-center">Resumen del Personal</h2>
              <div className="text-xs text-gray-500 font-normal text-center mt-1">{new Date().toLocaleDateString('es-ES')}</div>
            </div>
            <p className="text-xs lg:text-sm text-gray-600 font-normal mb-4 text-center">Indicadores clave del equipo en el día actual</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
              {/* Total Servicios */}
              <div className="w-full">
                <SpotlightCard spotlightColor={'rgba(59,130,246,0.08)' as `rgba(${number}, ${number}, ${number}, ${number})`}>
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Total Servicios</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{employeeStats.reduce((sum, emp) => sum + emp.servicesCount, 0)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Atenciones completadas</p>
                      </div>
                      {/* Mini chart: simulate services per hour */}
                      <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                        <ResponsiveContainer width="100%" height={48}>
                          <LineChart data={[{v:5},{v:8},{v:7},{v:10},{v:9},{v:12},{v:11}].map((d, i) => ({ ...d, label: daysLabels[i] }))}
                            margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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
              {/* Ticket Promedio Hoy */}
              <div className="w-full">
                <SpotlightCard spotlightColor={'rgba(16,185,129,0.08)' as `rgba(${number}, ${number}, ${number}, ${number})`}>
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(16,185,129,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Ticket Promedio</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(averageTicketToday)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Hoy</p>
                      </div>
                      {/* Mini chart: promedio del día */}
                      <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                        <ResponsiveContainer width="100%" height={48}>
                          <LineChart data={chartDataAvgTicketToday.map((d, i) => ({ ...d, label: daysLabels[i] }))}
                            margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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
              {/* Ventas Generadas */}
              <div className="w-full">
                <SpotlightCard spotlightColor={'rgba(168,85,247,0.08)' as `rgba(${number}, ${number}, ${number}, ${number})`}>
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(168,85,247,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-between h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Ventas Generadas</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(employeeStats.reduce((sum, emp) => sum + emp.sales, 0))}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Por el equipo</p>
                      </div>
                      {/* Mini chart: simulate sales per hour */}
                      <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                        <ResponsiveContainer width="100%" height={48}>
                          <LineChart data={[{v:200},{v:350},{v:300},{v:400},{v:370},{v:420},{v:410}].map((d, i) => ({ ...d, label: daysLabels[i] }))}
                            margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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
          </div>
        </div>

        {/* Main Content Stacked */}
        <div className="flex flex-col gap-6 mb-8">
          {/* Empleados Performance */}
          <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm animate-slideInUp" style={{ animationDelay: '600ms' }}>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-center">
                <h3 className="text-sm font-medium text-gray-800 text-center">Rendimiento Empleados</h3>
              </div>
              
            </div>
            <div className="p-4 h-[400px] overflow-y-auto kitchen-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {employeeStats.map((employee, index) => {
                  // Simular datos de rendimiento en el tiempo (últimos 7 días)
                  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
                  const performanceData = days.map((day, i) => ({
                    day,
                    servicios: Math.max(0, Math.round(employee.servicesCount * (0.7 + 0.6 * Math.random()) / 7)),
                    propinas: +(employee.totalTips * (0.7 + 0.6 * Math.random()) / 7).toFixed(2),
                    ventas: +(employee.sales * (0.7 + 0.6 * Math.random()) / 7).toFixed(2)
                  }))
                  return (
                    <div key={employee.id} className="bg-white border border-gray-200 rounded-xl shadow p-2 md:p-3 hover:shadow-md transition-all duration-200 flex flex-col gap-2 md:gap-3">
                      {/* Avatar e info principal */}
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                        <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-300 text-blue-800 font-bold text-base shadow-inner">
                          {employee.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5">
                            <div>
                              <h4 className="font-semibold text-gray-900 text-sm md:text-base leading-tight">{employee.name}</h4>
                              <p className="text-[11px] text-gray-500 leading-tight">{employee.role}</p>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 md:mt-0">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-medium">Ticket: {formatCurrency(employee.avgTicket || 0)}</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px] font-medium">Items: {employee.itemsSold || 0}</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px] font-medium">{formatCurrency(employee.sales)}</span>
                            </div>
                      </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 text-[11px]">Servicios: <b>{employee.servicesCount}</b></span>
                            <span className="bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 text-[11px]">Prom: <b>{employee.avgServiceTime}</b></span>
                      </div>
                    </div>
                      </div>
                      {/* Gráficas de rendimiento */}
                      <div className="flex flex-row gap-2 mt-2 w-full">
                        {/* Servicios */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 text-center mb-0.5">Servicios</div>
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={performanceData} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} label={{ value: 'Día', position: 'insideBottom', offset: -2, fontSize: 9 }} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="servicios" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Ticket Promedio */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 text-center mb-0.5">Ticket Promedio</div>
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={performanceData.map(d => ({ ...d, ticket: (employee.avgTicket || 0) * (0.9 + Math.random()*0.2) }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} label={{ value: 'Día', position: 'insideBottom', offset: -2, fontSize: 9 }} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="ticket" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                      </div>
                        {/* Items Vendidos */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 text-center mb-0.5">Items Vendidos</div>
                          <ResponsiveContainer width="100%" height={48}>
                            <LineChart data={performanceData.map(d => ({ ...d, items: Math.max(0, Math.round((employee.itemsSold || 0)/7 * (0.8 + Math.random()*0.4))) }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                              <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} label={{ value: 'Día', position: 'insideBottom', offset: -2, fontSize: 9 }} />
                              <YAxis hide />
                              <Line type="monotone" dataKey="items" stroke="#f59e42" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                            </LineChart>
                          </ResponsiveContainer>
                      </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Platos Más Populares */}
          <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm animate-slideInUp" style={{ animationDelay: '700ms' }}>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-center">
                <h3 className="text-sm font-medium text-gray-800 text-center">Productos Más Vendidos</h3>
              </div>
              <p className="text-xs text-gray-600 mt-1 text-center">Más vendidos del mes</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {topDishes.map((dish, index) => {
                  // Simular datos de pedidos de la semana para el chart
                  const dishOrdersWeek = [
                    { day: 'Lun', v: Math.round(dish.orders * (0.12 + Math.random() * 0.1)) },
                    { day: 'Mar', v: Math.round(dish.orders * (0.13 + Math.random() * 0.1)) },
                    { day: 'Mié', v: Math.round(dish.orders * (0.14 + Math.random() * 0.1)) },
                    { day: 'Jue', v: Math.round(dish.orders * (0.15 + Math.random() * 0.1)) },
                    { day: 'Vie', v: Math.round(dish.orders * (0.16 + Math.random() * 0.1)) },
                    { day: 'Sáb', v: Math.round(dish.orders * (0.18 + Math.random() * 0.1)) },
                    { day: 'Dom', v: Math.round(dish.orders * (0.12 + Math.random() * 0.1)) },
                  ];
                  return (
                    <div key={index} className="flex flex-col sm:flex-row items-stretch justify-between p-3 rounded-xl transition-all border border-green-100 bg-white shadow-sm min-h-[84px]">
                      {/* Izquierda: Nombre, categoría, ranking */}
                      <div className="flex flex-row items-center min-w-0 flex-1 gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 text-base font-bold text-green-700">#{index + 1}</div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-gray-900 text-base truncate leading-tight">{dish.name}</h4>
                          <p className="text-xs text-green-700 font-medium mt-0.5">{dish.category}</p>
                        </div>
                      </div>
                      {/* Derecha: Pedidos y revenue */}
                      <div className="flex flex-col items-end justify-center min-w-[70px] gap-1 sm:ml-4">
                        <span className="text-lg font-bold text-green-700 leading-tight">{dish.orders}</span>
                        <span className="text-xs text-gray-500">pedidos</span>
                        <span className="text-xs text-green-600 font-semibold">{formatCurrency(dish.revenue)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Platos Menos Populares */}
          <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm animate-slideInUp" style={{ animationDelay: '800ms' }}>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-center">
                <h3 className="text-sm font-medium text-gray-800 text-center">Oportunidades</h3>
              </div>
              <p className="text-xs text-gray-600 mt-1 text-center">Productos con menor demanda</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {leastPopularDishes.map((dish, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-stretch justify-between p-3 rounded-xl transition-all border border-orange-100 bg-white shadow-sm min-h-[84px]">
                    {/* Izquierda: Ranking, nombre, categoría */}
                    <div className="flex flex-row items-center min-w-0 flex-1 gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 text-base font-bold text-orange-700">⚠️</div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-gray-900 text-base truncate leading-tight">{dish.name}</h4>
                        <p className="text-xs text-orange-700 font-medium mt-0.5">{dish.category}</p>
                      </div>
                    </div>
                    {/* Derecha: Pedidos y revenue */}
                    <div className="flex flex-col items-end justify-center min-w-[70px] gap-1 sm:ml-4">
                      <span className="text-lg font-bold text-orange-700 leading-tight">{dish.orders}</span>
                      <span className="text-xs text-gray-500">pedidos</span>
                      <span className="text-xs text-red-600 font-semibold">{formatCurrency(dish.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-orange-50 rounded border border-orange-100">
                <p className="text-xs text-orange-700">
                  💡 <strong>Sugerencia:</strong> Considera promociones especiales.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}