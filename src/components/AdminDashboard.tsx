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
  quarter: number
  semester: number
}

type PeriodFilter = 'diario' | 'semanal' | 'mensual' | 'trimestral' | 'semestral' | 'anual'

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
  sku?: string
  imageUrl?: string
  color?: string
  size?: string
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
  const [salesData, setSalesData] = useState<SalesData>({ today: 0, week: 0, month: 0, year: 0, quarter: 0, semester: 0 })
  const [customerStats, setCustomerStats] = useState<CustomerStats>({ totalToday: 0, totalWeek: 0, totalMonth: 0, avgTableTime: '-', returnRate: 0, satisfaction: 0 })
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
  const [topDishes, setTopDishes] = useState<DishStats[]>([])
  const [leastPopularDishes, setLeastPopularDishes] = useState<DishStats[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('diario')

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  // Helper function to get start date based on period
  const getStartDateForPeriod = (period: PeriodFilter): Date => {
    const now = new Date()
    const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0)
    
    switch (period) {
      case 'diario':
        return startOfToday
      case 'semanal':
        const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - 6)
        return startOfWeek
      case 'mensual':
        const startOfMonth = new Date(startOfToday); startOfMonth.setDate(1)
        return startOfMonth
      case 'trimestral':
        const currentQuarter = Math.floor(now.getMonth() / 3)
        const startOfQuarter = new Date(startOfToday); startOfQuarter.setMonth(currentQuarter * 3, 1)
        return startOfQuarter
      case 'semestral':
        const currentSemester = Math.floor(now.getMonth() / 6)
        const startOfSemester = new Date(startOfToday); startOfSemester.setMonth(currentSemester * 6, 1)
        return startOfSemester
      case 'anual':
        const startOfYear = new Date(startOfToday); startOfYear.setMonth(0,1)
        return startOfYear
      default:
        return startOfToday
    }
  }

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true)
      try {
        const now = new Date()
        const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0)
        const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - 6)
        const startOfMonth = new Date(startOfToday); startOfMonth.setDate(1)
        
        // Calculate quarter start (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
        const currentQuarter = Math.floor(now.getMonth() / 3)
        const startOfQuarter = new Date(startOfToday); startOfQuarter.setMonth(currentQuarter * 3, 1)
        
        // Calculate semester start (H1: Jan-Jun, H2: Jul-Dec)
        const currentSemester = Math.floor(now.getMonth() / 6)
        const startOfSemester = new Date(startOfToday); startOfSemester.setMonth(currentSemester * 6, 1)
        
        const startOfYear = new Date(startOfToday); startOfYear.setMonth(0,1)

        // Pull recent window for computations (last 365 days to cover all periods)
        const since365d = new Date(startOfToday); since365d.setDate(startOfToday.getDate() - 365)

        const { data: salesRows } = await supabase
          .from('sales')
          .select('id, created_at, subtotal, discount, total, items, payments, customer, seller')
          .gte('created_at', since365d.toISOString())
          .order('created_at', { ascending: false })
          .limit(10000)

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
          quarter: sumInRange(startOfQuarter),
          semester: sumInRange(startOfSemester),
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

        // Store parsed data for period-based calculations
        // We'll calculate employee stats and products based on selectedPeriod in a separate effect
      } finally {
        setIsLoading(false)
      }
    }
    loadDashboard()
  }, [])

  // Recalculate employee stats and products based on selected period
  useEffect(() => {
    async function recalculateByPeriod() {
      if (isLoading) return
      
      try {
        const startDate = getStartDateForPeriod(selectedPeriod)
        const since365d = new Date(); since365d.setDate(since365d.getDate() - 365)

        const { data: salesRows } = await supabase
          .from('sales')
          .select('id, created_at, subtotal, discount, total, items, payments, customer, seller')
          .gte('created_at', since365d.toISOString())
          .order('created_at', { ascending: false })
          .limit(10000)

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

        // Per-seller stats for selected period
        const bySeller = new Map<string, { servicesCount: number, total: number, items: number }>()
        parsed.filter(s => new Date(s.created_at) >= startDate).forEach(s => {
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

        // Aggregate items sold for selected period for top/least dishes
        const aggByKey = new Map<string, { name: string, sku?: string, quantity: number, revenue: number, color?: string, size?: string }>()
        parsed.filter(s => new Date(s.created_at) >= startDate).forEach(s => {
          (s.items || []).forEach((it: any) => {
            const sku = it.sku as string | undefined
            const name = (it.name as string) || sku || 'Producto'
            const key = sku || name
            const curr = aggByKey.get(key) || { name, sku, quantity: 0, revenue: 0, color: it.color, size: it.size }
            const qty = Number(it.quantity) || 0
            const price = Number(it.unitPrice) || 0
            curr.quantity += qty
            curr.revenue += qty * price
            // Keep first non-empty color and size
            if (!curr.color && it.color) curr.color = it.color
            if (!curr.size && it.size) curr.size = it.size
            aggByKey.set(key, curr)
          })
        })

        // Fetch garments meta by sku for additional info
        let metaBySku = new Map<string, { category?: string, image_url?: string, color?: string, size?: string }>()
        try {
          const skus = Array.from(aggByKey.values()).map(v => v.sku).filter(Boolean) as string[]
          if (skus.length) {
            const { data: garments } = await supabase
              .from('garments')
              .select('sku, category, image_url, color, size')
              .in('sku', Array.from(new Set(skus)))
            if (garments) {
              metaBySku = new Map((garments as any[]).map(g => [g.sku as string, { 
                category: g.category as string | undefined,
                image_url: g.image_url as string | undefined,
                color: g.color as string | undefined,
                size: g.size as string | undefined
              }]))
            }
          }
        } catch {}

        const dishes = Array.from(aggByKey.values()).map(v => {
          const meta = v.sku ? metaBySku.get(v.sku) : undefined
          return {
            name: v.name,
            orders: v.quantity,
            revenue: Number(v.revenue),
            category: meta?.category || 'General',
            trend: 'stable' as const,
            sku: v.sku,
            imageUrl: meta?.image_url || undefined,
            color: v.color || meta?.color || undefined,
            size: v.size || meta?.size || undefined
          }
        })

        // Calcular promedio de ventas por categoría
        const categoryStats = new Map<string, { totalOrders: number, productCount: number }>()
        dishes.forEach(d => {
          const cat = d.category || 'General'
          const stats = categoryStats.get(cat) || { totalOrders: 0, productCount: 0 }
          stats.totalOrders += d.orders
          stats.productCount += 1
          categoryStats.set(cat, stats)
        })

        const categoryAverages = new Map<string, number>()
        categoryStats.forEach((stats, category) => {
          const avg = stats.productCount > 0 ? stats.totalOrders / stats.productCount : 0
          categoryAverages.set(category, avg)
        })

        // Oportunidades: productos con 0 ventas Y productos 50% por debajo del promedio de su categoría
        // Crear un Set de claves de productos vendidos (usando la misma lógica que aggByKey: sku || name)
        const soldProductKeys = new Set<string>()
        dishes.forEach(d => {
          const key = d.sku || d.name
          soldProductKeys.add(key)
        })

        // Productos con ventas 50% por debajo del promedio de su categoría
        const lowPerformingProducts: DishStats[] = dishes.filter(d => {
          const category = d.category || 'General'
          const categoryAvg = categoryAverages.get(category) || 0
          // Si el promedio es 0, no considerar este producto como bajo rendimiento
          if (categoryAvg === 0) return false
          // 50% inferior significa que las ventas son menos del 50% del promedio
          const threshold = categoryAvg * 0.5
          return d.orders < threshold
        })

        // Obtener todos los productos disponibles de garments
        let zeroSalesProducts: DishStats[] = []
        try {
          const { data: allGarments } = await supabase
            .from('garments')
            .select('sku, name, category, image_url, color, size')
            .eq('status', 'activo')
          
          if (allGarments) {
            // Filtrar productos que NO están en los vendidos (mostrar TODOS los productos con 0 ventas)
            const productsWithZeroSales = allGarments
              .filter((g: any) => {
                const key = g.sku || g.name
                return !soldProductKeys.has(key)
              })
            
            zeroSalesProducts = productsWithZeroSales.map((g: any) => ({
              name: g.name,
              orders: 0,
              revenue: 0,
              category: g.category || 'General',
              trend: 'stable' as const,
              sku: g.sku,
              imageUrl: g.image_url || undefined,
              color: g.color || undefined,
              size: g.size || undefined
            }))
          }
        } catch {}

        // Combinar productos con 0 ventas y productos con bajo rendimiento
        // Evitar duplicados usando un Map por clave (sku || name)
        const opportunitiesMap = new Map<string, DishStats>()
        
        // Agregar productos con 0 ventas
        zeroSalesProducts.forEach(p => {
          const key = p.sku || p.name
          opportunitiesMap.set(key, p)
        })
        
        // Agregar productos con bajo rendimiento (pueden sobrescribir si hay duplicado, pero estos tienen ventas > 0)
        lowPerformingProducts.forEach(p => {
          const key = p.sku || p.name
          opportunitiesMap.set(key, p)
        })
        
        const allOpportunities = Array.from(opportunitiesMap.values())

        // Crear un Set de claves de productos en oportunidades para excluirlos de los más vendidos
        const opportunitiesKeys = new Set<string>()
        allOpportunities.forEach(p => {
          const key = p.sku || p.name
          opportunitiesKeys.add(key)
        })

        // Ordenar por más vendidos (desc) y excluir productos que están en oportunidades
        const sorted = dishes
          .filter(d => {
            const key = d.sku || d.name
            return d.orders > 0 && !opportunitiesKeys.has(key)
          })
          .sort((a,b) => b.orders - a.orders)

        // Top N sin repetir (excluyendo productos en oportunidades)
        const TOP_N = 5
        const top = sorted.slice(0, TOP_N)

        setTopDishes(top)
        setLeastPopularDishes(allOpportunities)
      } catch (error) {
        console.error('Error recalculating by period:', error)
      }
    }
    recalculateByPeriod()
  }, [selectedPeriod, isLoading])

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
  const chartDataSalesQuarter = useMemo(() => {
    const v = Math.round(salesData.quarter)
    return [0.7, 0.85, 0.9, 0.95, 1, 0.98, 1].map(p => ({ v: Math.round(v * p) }))
  }, [salesData.quarter])
  const chartDataSalesSemester = useMemo(() => {
    const v = Math.round(salesData.semester)
    return [0.75, 0.85, 0.9, 0.95, 1, 0.98, 1].map(p => ({ v: Math.round(v * p) }))
  }, [salesData.semester])

  // Etiquetas para los ejes X de los charts de ventas
  const daysLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const weekLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const monthLabels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5', 'Semana 6', 'Semana 7']
  const quarterLabels = ['Mes 1', 'Mes 2', 'Mes 3', 'Mes 4', 'Mes 5', 'Mes 6', 'Mes 7']
  const semesterLabels = ['Mes 1', 'Mes 2', 'Mes 3', 'Mes 4', 'Mes 5', 'Mes 6', 'Mes 7']
  const yearLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul']

  // Get current period data and labels based on selected filter
  const getCurrentPeriodData = () => {
    switch (selectedPeriod) {
      case 'diario':
        return { value: salesData.today, chartData: chartDataSalesToday, labels: daysLabels, title: 'Hoy', subtitle: 'Ventas del día', color: 'rgba(34,197,94,0.15)', stroke: '#34d399' }
      case 'semanal':
        return { value: salesData.week, chartData: chartDataSalesWeek, labels: weekLabels, title: 'Semana', subtitle: 'Últimos 7 días', color: 'rgba(59,130,246,0.15)', stroke: '#3b82f6' }
      case 'mensual':
        return { value: salesData.month, chartData: chartDataSalesMonth, labels: monthLabels, title: 'Mes', subtitle: 'Mes actual', color: 'rgba(251,146,60,0.15)', stroke: '#fb923c' }
      case 'trimestral':
        return { value: salesData.quarter, chartData: chartDataSalesQuarter, labels: quarterLabels, title: 'Trimestre', subtitle: 'Trimestre actual', color: 'rgba(236,72,153,0.15)', stroke: '#ec4899' }
      case 'semestral':
        return { value: salesData.semester, chartData: chartDataSalesSemester, labels: semesterLabels, title: 'Semestre', subtitle: 'Semestre actual', color: 'rgba(139,92,246,0.15)', stroke: '#8b5cf6' }
      case 'anual':
        return { value: salesData.year, chartData: chartDataSalesYear, labels: yearLabels, title: 'Año', subtitle: 'Año en curso', color: 'rgba(168,85,247,0.15)', stroke: '#a855f7' }
      default:
        return { value: salesData.today, chartData: chartDataSalesToday, labels: daysLabels, title: 'Hoy', subtitle: 'Ventas del día', color: 'rgba(34,197,94,0.15)', stroke: '#34d399' }
    }
  }

  const currentPeriodData = getCurrentPeriodData()

  // Calculate average ticket based on selected period
  const averageTicketForPeriod = useMemo(() => {
    const periodValue = currentPeriodData.value
    // Use employeeStats to calculate count (servicesCount represents sales count)
    const totalServices = employeeStats.reduce((sum, emp) => sum + emp.servicesCount, 0)
    const count = Math.max(1, totalServices)
    return count > 0 ? periodValue / count : 0
  }, [selectedPeriod, currentPeriodData.value, employeeStats])
  
  const averageTicketToday = useMemo(() => {
    const count = Math.max(1, customerStats.totalToday || 0)
    return (salesData.today || 0) / count
  }, [salesData.today, customerStats.totalToday])
  const chartDataAvgTicketToday = useMemo(() => {
    const v = Math.round(averageTicketToday)
    return [0.7, 0.8, 0.75, 0.85, 0.9, 0.82, 1].map(p => ({ v: Math.max(0, Math.round(v * p)) }))
  }, [averageTicketToday])

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
            
            {/* Filtros de período */}
            <div className="mb-4 flex flex-wrap gap-2 justify-center">
              {(['diario', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual'] as PeriodFilter[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 ${
                    selectedPeriod === period
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>

            {/* Tarjeta de resumen según el período seleccionado */}
            <div className="flex justify-center">
              <div className="w-full lg:w-64">
                <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-center config-font-medium metallic-bg" style={{ animationDelay: '0ms', boxShadow: `0 4px 16px 0 ${currentPeriodData.color}` }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-center h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">{currentPeriodData.title}</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(currentPeriodData.value)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">{currentPeriodData.subtitle}</p>
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
            <p className="text-xs lg:text-sm text-gray-600 font-normal mb-4 text-center">
              Indicadores clave del equipo - {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
              {/* Total Servicios */}
              <div className="w-full">
                <SpotlightCard spotlightColor={'rgba(59,130,246,0.08)' as `rgba(${number}, ${number}, ${number}, ${number})`}>
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-center metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-center h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Total Servicios</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{employeeStats.reduce((sum, emp) => sum + emp.servicesCount, 0)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Atenciones completadas</p>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>
              {/* Ticket Promedio Hoy */}
              <div className="w-full">
                <SpotlightCard spotlightColor={'rgba(16,185,129,0.08)' as `rgba(${number}, ${number}, ${number}, ${number})`}>
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-center metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(16,185,129,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-center h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Ticket Promedio</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(averageTicketForPeriod)}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">{selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}</p>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>
              {/* Ventas Generadas */}
              <div className="w-full">
                <SpotlightCard spotlightColor={'rgba(168,85,247,0.08)' as `rgba(${number}, ${number}, ${number}, ${number})`}>
                  <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-center metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(168,85,247,0.15)' }}>
                    <div className="absolute inset-0 pointer-events-none metallic-shine" />
                    <div className="flex flex-col justify-center h-full relative z-10">
                      <div className="flex flex-col items-center justify-center pt-1 pb-2">
                        <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Ventas Generadas</h3>
                        <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(employeeStats.reduce((sum, emp) => sum + emp.sales, 0))}</p>
                        <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Por el equipo</p>
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
              <p className="text-xs text-gray-600 mt-1 text-center">
                Período: {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
              </p>
            </div>
            <div className="p-4 h-[400px] overflow-y-auto kitchen-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {employeeStats.map((employee, index) => {
                  return (
                    <div key={employee.id} className="bg-white border border-gray-200 rounded-xl p-4 transition-all duration-200 flex flex-col gap-4">
                      {/* Header con Avatar y Nombre */}
                      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                        <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-300 text-blue-800 font-bold text-lg shadow-inner">
                          {employee.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-base md:text-lg leading-tight">{employee.name}</h4>
                          <p className="text-xs text-gray-500 leading-tight mt-0.5">{employee.role}</p>
                        </div>
                      </div>

                      {/* Métricas principales en grid */}
                      <div className="grid grid-cols-3 gap-3">
                        {/* Ticket Promedio */}
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="text-[10px] font-medium text-gray-600 uppercase tracking-wide mb-1">Ticket Promedio</div>
                          <div className="text-base md:text-lg font-bold text-gray-900 leading-tight">{formatCurrency(employee.avgTicket || 0)}</div>
                        </div>

                        {/* Items Vendidos */}
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="text-[10px] font-medium text-gray-600 uppercase tracking-wide mb-1">Items Vendidos</div>
                          <div className="text-base md:text-lg font-bold text-gray-900 leading-tight">{employee.itemsSold || 0}</div>
                        </div>

                        {/* Ventas Totales */}
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="text-[10px] font-medium text-gray-600 uppercase tracking-wide mb-1">Ventas Totales</div>
                          <div className="text-base md:text-lg font-bold text-gray-900 leading-tight">{formatCurrency(employee.sales)}</div>
                        </div>
                      </div>

                      {/* Servicios */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Servicios Completados</span>
                        <span className="text-lg font-bold text-gray-900">{employee.servicesCount}</span>
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
              <p className="text-xs text-gray-600 mt-1 text-center">
                Más vendidos - {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
              </p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topDishes.map((dish, index) => {
                  return (
                    <div key={index} className="flex flex-row items-stretch gap-4 p-4 rounded-xl transition-all border border-gray-200 bg-white hover:border-gray-300">
                      {/* Imagen del producto */}
                      <div className="flex-shrink-0">
                        {dish.imageUrl ? (
                          <img 
                            src={dish.imageUrl} 
                            alt={dish.name}
                            className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg border border-gray-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="12"%3ESin imagen%3C/text%3E%3C/svg%3E'
                            }}
                          />
                        ) : (
                          <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                            <span className="text-xs text-gray-400 text-center px-2">Sin imagen</span>
                          </div>
                        )}
                      </div>

                      {/* Información del producto */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          {/* Ranking y nombre */}
                          <div className="flex items-start gap-2 mb-2">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-700">#{index + 1}</div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 text-base md:text-lg truncate leading-tight">{dish.name}</h4>
                              <p className="text-xs text-gray-600 font-medium mt-0.5">{dish.category}</p>
                            </div>
                          </div>

                          {/* SKU, Color, Talla */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {dish.sku && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                                SKU: {dish.sku}
                              </span>
                            )}
                            {dish.color && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                                Color: {dish.color}
                              </span>
                            )}
                            {dish.size && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                                Talla: {dish.size}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Pedidos y revenue */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <div className="flex flex-col">
                            <span className="text-2xl font-bold text-gray-900 leading-tight">{dish.orders}</span>
                            <span className="text-xs text-gray-500">pedidos</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-bold text-green-600 leading-tight">{formatCurrency(dish.revenue)}</span>
                            <span className="text-xs text-gray-500">total</span>
                          </div>
                        </div>
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
              <p className="text-xs text-gray-600 mt-1 text-center">
                Productos con 0 ventas o 50% por debajo del promedio de su categoría - {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
              </p>
            </div>
            <div className="p-4">
              {leastPopularDishes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">🎉 ¡Excelente! Todos los productos tienen ventas adecuadas en este período.</p>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {leastPopularDishes.map((dish, index) => (
                  <div key={index} className="flex flex-row items-stretch gap-4 p-4 rounded-xl transition-all border border-gray-200 bg-white hover:border-gray-300">
                    {/* Imagen del producto */}
                    <div className="flex-shrink-0">
                      {dish.imageUrl ? (
                        <img 
                          src={dish.imageUrl} 
                          alt={dish.name}
                          className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg border border-gray-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="12"%3ESin imagen%3C/text%3E%3C/svg%3E'
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                          <span className="text-xs text-gray-400 text-center px-2">Sin imagen</span>
                        </div>
                      )}
                    </div>

                    {/* Información del producto */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        {/* Ranking y nombre */}
                        <div className="flex items-start gap-2 mb-2">
                          <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-orange-700">⚠️</div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-base md:text-lg truncate leading-tight">{dish.name}</h4>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">{dish.category}</p>
                          </div>
                        </div>

                        {/* SKU, Color, Talla */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {dish.sku && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                              SKU: {dish.sku}
                            </span>
                          )}
                          {dish.color && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                              Color: {dish.color}
                            </span>
                          )}
                          {dish.size && (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                              Talla: {dish.size}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pedidos y revenue */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-2xl font-bold text-red-600 leading-tight">{dish.orders}</span>
                          <span className="text-xs text-gray-500">ventas</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-bold text-red-600 leading-tight">{formatCurrency(dish.revenue)}</span>
                          <span className="text-xs text-gray-500">total</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
              {leastPopularDishes.length > 0 && (
              <div className="mt-4 p-3 bg-orange-50 rounded border border-orange-100">
                <p className="text-xs text-orange-700">
                  💡 <strong>Sugerencia:</strong> Considera promociones especiales para estos productos.
                </p>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}