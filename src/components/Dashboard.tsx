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
  UserIcon
} from './icons'
import { PaymentModal } from './PaymentModal'
import { supabase } from '../lib/supabaseClient'

interface OrderItem {
  name: string
  quantity: number
  price: number
  notes?: string
}

interface Order {
  id: string
  tableNumber: number
  items: number
  time: string
  status: 'ready' | 'cooking' | 'pending'
  priority: 'high' | 'medium' | 'low'
  guests?: number
  capacity?: number
  orderDetails: OrderItem[]
  total: number
  createdAt?: number; // timestamp when order is created
  pendingAt?: number; // when enters pending
  cookingAt?: number; // when enters cooking
  readyAt?: number;   // when enters ready
  paymentPendingAt?: number; // when enters payment_pending
}

interface Table {
  number: number
  status: 'occupied' | 'available' | 'payment_pending'
  guests: number
  capacity: number
  orderTotal?: number
  timeOccupied?: string
  orderDetails?: OrderItem[]
  paymentPendingAt?: number; // when enters payment_pending
}

// Componente para el ícono de check personalizado
const CheckIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./Wavy_Check.png" 
    alt="Check" 
    width={size} 
    height={size} 
    className={className}
    style={{ filter: 'invert(0)' }}
  />
)

// Componente para el ícono de cocina personalizado
const CocinaIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./cocina.png" 
    alt="Cocina" 
    width={size} 
    height={size} 
    className={className}
  />
)

// Componente para el ícono de tarjeta de crédito personalizado
const CreditCardCustomIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./Credit_Card_01.png" 
    alt="Tarjeta de Crédito" 
    width={size} 
    height={size} 
    className={className}
  />
)

// Componente para el ícono de trending up personalizado
const TrendingUpCustomIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./Trending_Up.png" 
    alt="Trending Up" 
    width={size} 
    height={size} 
    className={className}
  />
)

// Utility to format ms to mm:ss
function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Types from DB shapes used here
type DbCartLine = {
  id: string
  itemId: string
  name: string
  sku: string
  variantLabel?: string
  unitPrice: number
  quantity: number
  imageUrl?: string
}

type DbPaymentPart = { method: 'cash' | 'card' | 'transfer' | 'voucher' | 'other', amount: number }

type DbSale = {
  id: string
  created_at: string
  subtotal: number
  discount: number
  total: number
  items: DbCartLine[]
  payments: DbPaymentPart[]
  seller?: string | null
}

export function Dashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const { /* formatCurrency, */ getFontSizeClass } = useConfig()

  const numberFormatter = useMemo(() => new Intl.NumberFormat('es-ES'), [])
  const formatThousands = (value: number) => (Number.isFinite(value) ? numberFormatter.format(value) : value)

  const [todaySalesCount, setTodaySalesCount] = useState(0)
  const [todaySalesTotal, setTodaySalesTotal] = useState(0)
  const [yesterdaySalesTotal, setYesterdaySalesTotal] = useState(0)
  const [todayDiscountTotal, setTodayDiscountTotal] = useState(0)

  const avgTicket = useMemo(() => todaySalesCount > 0 ? todaySalesTotal / todaySalesCount : 0, [todaySalesCount, todaySalesTotal])
  const vsYesterdayPct = useMemo(() => {
    if (yesterdaySalesTotal <= 0) return todaySalesTotal > 0 ? 100 : 0
    return Math.round(((todaySalesTotal - yesterdaySalesTotal) / yesterdaySalesTotal) * 100)
  }, [todaySalesTotal, yesterdaySalesTotal])

  const [inventoryCritical, setInventoryCritical] = useState<{ name: string, sku: string, qty: number, threshold: number, imageUrl?: string }[]>([])

  const [recentSales, setRecentSales] = useState<{ time: string, folio: string, seller?: string, items: { name: string, qty: number, variantLabel?: string }[], total: number, payments: DbPaymentPart[] }[]>([])

  const [topProducts, setTopProducts] = useState<{ name: string, qty: number, revenue: number, img?: string, sku?: string, category?: string, price?: number }[]>([])

  const dailyGoal = 20000
  const goalProgress = Math.min(100, Math.round((todaySalesTotal / dailyGoal) * 100))
  const goalRemaining = Math.max(0, dailyGoal - todaySalesTotal)

  const notifications = [
    { title: 'Promoción 2x1 en playeras básicas', body: 'Vigente hoy hasta las 8pm.' },
    { title: 'Recordatorio cierre de caja', body: 'Cierre de caja en 1 hora.' },
    { title: 'Nueva política de devoluciones', body: 'Cambios permitidos hasta 15 días con ticket.' }
  ]

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const now = new Date()
        const startOfToday = new Date(now)
        startOfToday.setHours(0, 0, 0, 0)
        const startOfYesterday = new Date(startOfToday)
        startOfYesterday.setDate(startOfToday.getDate() - 1)
        const startOf7DaysAgo = new Date(startOfToday)
        startOf7DaysAgo.setDate(startOfToday.getDate() - 7)

        // 1) Garments - inventory crítico
        const { data: garmentsData } = await supabase
          .from('garments')
          .select('name, sku, category, price, qty, low_stock_threshold, image_url')
          .order('name', { ascending: true })

        if (garmentsData) {
          const metaBySku = new Map<string, { image_url?: string, category?: string, price?: number, name?: string }>()
          try {
            for (const g of garmentsData as any[]) {
              if (g.sku) metaBySku.set(g.sku as string, { image_url: g.image_url as string | undefined, category: g.category as string | undefined, price: Number(g.price) || 0, name: g.name as string | undefined })
            }
          } catch {}
          const crit = (garmentsData as any[])
            .filter(g => typeof g.qty === 'number' && typeof g.low_stock_threshold === 'number' && g.qty < g.low_stock_threshold)
            .map(g => ({ name: g.name as string, sku: g.sku as string, qty: Number(g.qty), threshold: Number(g.low_stock_threshold), imageUrl: g.image_url as string | undefined }))
          setInventoryCritical(crit)
          ;(window as any).__garmentMetaBySku = metaBySku
        }

        // 2) Sales - últimos 7 días para KPIs y top products; y recientes
        const { data: sales7d } = await supabase
          .from('sales')
          .select('id, created_at, subtotal, discount, total, items, payments, seller')
          .gte('created_at', startOf7DaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(1000)

        const sales = (sales7d || []) as unknown as DbSale[]

        // 3) Cotizaciones aprobadas - incluir en métricas
        const { data: approvedQuotes } = await supabase
          .from('cotizaciones')
          .select('id, created_at, subtotal, total, datos_cliente, resumen_pedido')
          .eq('estado', 'aprobada')
          .gte('created_at', startOf7DaysAgo.toISOString())
          .order('created_at', { ascending: false })

        // Convertir cotizaciones aprobadas a formato similar a ventas para métricas
        const quotesAsSales = (approvedQuotes || []).map((q: any) => {
          const items = (q.resumen_pedido?.items || []).map((item: any) => ({
            name: item.descripcion || 'Producto',
            quantity: Number(item.cantidad || 0),
            unitPrice: Number(item.precio_unitario || 0),
            variantLabel: undefined,
            sku: item.id || ''
          }))
          
          // Calcular descuento total desde los items (descuento_unitario * cantidad)
          const totalDiscount = (q.resumen_pedido?.items || []).reduce((acc: number, item: any) => {
            return acc + (Number(item.descuento_unitario || 0) * Number(item.cantidad || 0))
          }, 0)
          
          // Crear un pago por defecto para cotizaciones (se puede ajustar según necesidad)
          const payments = [{ method: 'transfer' as const, amount: Number(q.total || 0) }]
          
          return {
            id: q.id,
            created_at: q.created_at,
            subtotal: Number(q.subtotal || 0),
            discount: totalDiscount,
            total: Number(q.total || 0),
            items,
            payments,
            seller: 'Cotización'
          }
        })

        // Combinar ventas y cotizaciones aprobadas para métricas
        const allSales = [...sales, ...quotesAsSales]

        // KPIs hoy/ayer (incluyendo cotizaciones aprobadas)
        const today = allSales.filter(s => new Date(s.created_at) >= startOfToday)
        const yesterday = allSales.filter(s => new Date(s.created_at) >= startOfYesterday && new Date(s.created_at) < startOfToday)
        const todayCount = today.length
        const todayTotal = today.reduce((acc, s) => acc + Number(s.total || 0), 0)
        const todayDiscount = today.reduce((acc, s) => acc + Number(s.discount || 0), 0)
        const yestTotal = yesterday.reduce((acc, s) => acc + Number(s.total || 0), 0)
        setTodaySalesCount(todayCount)
        setTodaySalesTotal(todayTotal)
        setTodayDiscountTotal(todayDiscount)
        setYesterdaySalesTotal(yestTotal)

        // Ventas recientes (últimas 10) - incluyendo cotizaciones aprobadas
        const allRecent = [...sales, ...quotesAsSales]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
        
        const recent = allRecent.map(s => {
          const created = new Date(s.created_at)
          const hh = created.getHours().toString().padStart(2, '0')
          const mm = created.getMinutes().toString().padStart(2, '0')
          const items = (s.items || []).map(i => ({ name: i.name, qty: Number(i.quantity || 0), variantLabel: i.variantLabel }))
          // Defensive parsing: payments may come as array, object, or JSON string
          const raw = (s as any).payments
          let paymentsArr: any[] = []
          if (Array.isArray(raw)) {
            paymentsArr = raw
          } else if (typeof raw === 'string') {
            try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) paymentsArr = parsed } catch {}
          } else if (raw && typeof raw === 'object') {
            if (Array.isArray((raw as any).parts)) paymentsArr = (raw as any).parts
          }
          const payments = paymentsArr.map(p => ({ method: p.method, amount: Number(p.amount || 0) }))
          return { time: `${hh}:${mm}`, folio: s.id.slice(0, 8), seller: (s as any).seller || undefined, items, total: Number(s.total || 0), payments }
        })
        setRecentSales(recent)

        // Top products (por cantidad e ingresos en últimos 7 días) - incluyendo cotizaciones aprobadas
        const productMap = new Map<string, { sku: string, name: string, qty: number, revenue: number }>()
        const metaBySku = ((window as any).__garmentMetaBySku as Map<string, { image_url?: string, category?: string, price?: number, name?: string }>) || new Map()
        for (const s of allSales) {
          for (const line of (s.items || [])) {
            const key = `${line.sku || line.name}`
            const entry = productMap.get(key) || { sku: line.sku || line.name, name: line.name, qty: 0, revenue: 0 }
            entry.qty += Number(line.quantity || 0)
            entry.revenue += Number(line.unitPrice || 0) * Number(line.quantity || 0)
            productMap.set(key, entry)
          }
        }
        const top = Array.from(productMap.values())
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 10)
          .map(p => {
            const meta = metaBySku.get(p.sku) || {}
            return { name: p.name, qty: p.qty, revenue: p.revenue, img: meta.image_url, sku: p.sku, category: meta.category, price: meta.price }
          })
        setTopProducts(top)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

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
            Dashboard de Tienda de Ropa
          </h1>
          <p className="text-gray-600 font-medium text-xs sm:text-sm lg:text-base">
            Hoy • {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* 1. Resumen de Ventas del Día */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6 lg:mb-8">
          <div className="bg-white rounded-xl sm:rounded-2xl px-3 sm:px-4 lg:px-5 py-4 sm:py-5 lg:py-6 border border-gray-200">
            <p className="text-[9px] sm:text-[11px] text-gray-600 font-semibold tracking-wide leading-tight">Ventas de hoy</p>
            <p className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-black mt-1 leading-none">{todaySalesCount}</p>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl px-3 sm:px-4 lg:px-5 py-4 sm:py-5 lg:py-6 border border-gray-200">
            <p className="text-[9px] sm:text-[11px] text-gray-600 font-semibold tracking-wide leading-tight">Ingresos totales</p>
            <p className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-black mt-1 leading-none">${` ${formatThousands(todaySalesTotal)}`}</p>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl px-3 sm:px-4 lg:px-5 py-4 sm:py-5 lg:py-6 border border-gray-200">
            <p className="text-[9px] sm:text-[11px] text-gray-600 font-semibold tracking-wide leading-tight">Ticket promedio</p>
            <p className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-black mt-1 leading-none">${` ${formatThousands(avgTicket)}`}</p>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl px-3 sm:px-4 lg:px-5 py-4 sm:py-5 lg:py-6 border border-gray-200">
            <p className="text-[9px] sm:text-[11px] text-gray-600 font-semibold tracking-wide leading-tight">Descuentos</p>
            <p className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-black mt-1 leading-none">${` ${formatThousands(todayDiscountTotal)}`}</p>
          </div>
        </div>

        {/* 2. Inventario Crítico */}
        <div className="bg-white rounded-xl sm:rounded-[15px] border border-gray-200 shadow-sm mb-4 sm:mb-6 lg:mb-8">
          <div className="p-3 sm:p-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm sm:text-base text-gray-800">Inventario crítico</h3>
            <p className="text-[10px] sm:text-xs text-gray-600">Productos por debajo del umbral</p>
          </div>
          {/* Desktop Table View */}
          <div className="hidden md:block p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-gray-600">
                  <th className="py-2 px-4 font-medium text-center align-middle">Producto</th>
                  <th className="py-2 px-4 font-medium text-center align-middle">Nombre</th>
                  <th className="py-2 px-4 font-medium text-center align-middle">SKU</th>
                  <th className="py-2 px-4 font-medium text-center align-middle">Disponible</th>
                  <th className="py-2 px-4 font-medium text-center align-middle">Umbral</th>
                  <th className="py-2 px-4 font-medium text-center align-middle">Acción</th>
                </tr>
              </thead>
              <tbody>
                {inventoryCritical.map((p, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="py-2 px-4 text-center align-middle">
                      <div className="flex justify-center">
                        {p.imageUrl ? (
                          <img 
                            src={p.imageUrl} 
                            alt={p.name}
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
                    <td className="py-2 px-4 text-gray-800 text-center align-middle">{p.name}</td>
                    <td className="py-2 px-4 text-gray-600 text-center align-middle">{p.sku}</td>
                    <td className="py-2 px-4 font-semibold text-red-600 text-center align-middle">{p.qty}</td>
                    <td className="py-2 px-4 text-gray-600 text-center align-middle">{p.threshold}</td>
                    <td className="py-2 px-4 text-center align-middle">
                      <button className="text-xs px-2 py-1 rounded bg-black text-white hover:opacity-90">Solicitar reposición</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden p-3 space-y-3">
            {inventoryCritical.length > 0 ? (
              inventoryCritical.map((p, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    {p.imageUrl ? (
                      <img 
                        src={p.imageUrl} 
                        alt={p.name}
                        className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-400 text-xs">IMG</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-600 mt-1">SKU: {p.sku}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600">Disponible: </span>
                      <span className="font-semibold text-red-600">{p.qty}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Umbral: </span>
                      <span className="text-gray-800">{p.threshold}</span>
                    </div>
                  </div>
                  <button className="w-full text-xs px-3 py-2 rounded bg-black text-white hover:opacity-90">
                    Solicitar reposición
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No hay productos con inventario crítico</p>
            )}
          </div>
        </div>

        {/* 3. Detalle de Ventas Recientes */}
        <div className="bg-white rounded-xl sm:rounded-[15px] border border-gray-200 shadow-sm mb-4 sm:mb-6 lg:mb-8">
          <div className="p-3 sm:p-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm sm:text-base text-gray-800">Ventas recientes</h3>
            <p className="text-[10px] sm:text-xs text-gray-600">Últimas transacciones</p>
          </div>
          {/* Desktop Table View */}
          <div className="hidden md:block p-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-gray-600">
                  <th className="py-2 pr-4 font-medium text-center">Hora</th>
                  <th className="py-2 pr-4 font-medium text-center">Folio</th>
                  <th className="py-2 pr-4 font-medium text-center">Vendedor</th>
                  <th className="py-2 pr-4 font-medium text-center">Productos</th>
                  <th className="py-2 pr-4 font-medium text-center">Total</th>
                  <th className="py-2 font-medium text-center">Pago</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((s, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="py-2 pr-4 text-gray-800 text-center">{s.time}</td>
                    <td className="py-2 pr-4 text-gray-600 text-center">{s.folio}</td>
                    <td className="py-2 pr-4 text-gray-700 text-center">{s.seller || '—'}</td>
                    <td className="py-2 pr-4 text-gray-700 text-center">
                      {s.items.map((i, j) => (
                        <span key={j} className="inline-block mr-2 mb-1 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs">{i.name}{i.variantLabel ? ` – ${i.variantLabel}` : ''} ×{i.qty}</span>
                      ))}
                    </td>
                    <td className="py-2 pr-4 font-semibold text-center">
                      <div className="text-black font-extrabold">{formatThousands(s.total)}</div>
                    </td>
                    <td className="py-2 text-center">
                      {s.payments && s.payments.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {s.payments.map((p, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded border text-xs bg-white border-gray-200 text-gray-700">
                              <span className="font-semibold mr-1">{formatThousands(p.amount)}</span>
                              <span className="capitalize">{p.method === 'card' ? 'tarjeta' : p.method === 'cash' ? 'efectivo' : p.method === 'transfer' ? 'transferencia' : p.method === 'voucher' ? 'vale' : p.method}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden p-3 space-y-3">
            {recentSales.length > 0 ? (
              recentSales.map((s, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{s.time}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">Folio: {s.folio}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold text-black">{formatThousands(s.total)}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Vendedor:</span>
                      <span className="text-gray-800 font-medium">{s.seller || '—'}</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Productos:</p>
                      <div className="flex flex-wrap gap-1">
                        {s.items.map((i, j) => (
                          <span key={j} className="bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-[10px]">
                            {i.name}{i.variantLabel ? ` – ${i.variantLabel}` : ''} ×{i.qty}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Pago:</p>
                      {s.payments && s.payments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.payments.map((p, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded border text-[10px] bg-white border-gray-200 text-gray-700">
                              <span className="font-semibold mr-1">{formatThousands(p.amount)}</span>
                              <span className="capitalize">{p.method === 'card' ? 'tarjeta' : p.method === 'cash' ? 'efectivo' : p.method === 'transfer' ? 'transferencia' : p.method === 'voucher' ? 'vale' : p.method}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-500">N/A</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No hay ventas recientes</p>
            )}
          </div>
        </div>

        {/* 4. Productos Más Vendidos */}
        <div className="bg-white rounded-xl sm:rounded-[15px] border border-gray-200 shadow-sm mb-4 sm:mb-6 lg:mb-8">
          <div className="p-3 sm:p-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm sm:text-base text-gray-800">Productos más vendidos</h3>
            <p className="text-[10px] sm:text-xs text-gray-600">Hoy y últimos 7 días</p>
          </div>
          {/* Desktop Table View */}
          <div className="hidden md:block p-4">
            <div className="grid grid-cols-12 text-xs font-medium text-gray-700 border-b pb-1">
              <div className="col-span-1 text-center">Imagen</div>
              <div className="col-span-4 text-center">Producto</div>
              <div className="col-span-2">SKU</div>
              <div className="col-span-2">Categoría</div>
              <div className="col-span-1 text-right">Cantidad</div>
              <div className="col-span-2 text-right">Ingresos</div>
            </div>
            <div className="divide-y">
              {topProducts.map((p, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center py-2">
                  {/* Imagen */}
                  <div className="col-span-1">
                    <div className="w-12 h-9 bg-gray-100 rounded overflow-hidden mx-auto">
                      {p.img ? (
                        <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">IMG</div>
                      )}
                    </div>
                  </div>
                  {/* Producto (nombre y precio) */}
                  <div className="col-span-4">
                    <div className="min-w-0 text-center">
                      <div className="truncate font-medium text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-600 truncate">{typeof p.price === 'number' ? `Precio: ${formatThousands(p.price)}` : ''}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-gray-700 truncate">{p.sku || '—'}</div>
                  <div className="col-span-2 text-gray-700 truncate">{p.category || '—'}</div>
                  <div className="col-span-1 text-right font-semibold text-gray-900">{p.qty}</div>
                  <div className="col-span-2 text-right font-semibold text-gray-900">{formatThousands(p.revenue)}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden p-3 space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((p, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    {/* Imagen */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden">
                        {p.img ? (
                          <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">IMG</div>
                        )}
                      </div>
                    </div>
                    {/* Info del producto */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      {typeof p.price === 'number' && (
                        <p className="text-xs text-gray-600 mt-0.5">Precio: {formatThousands(p.price)}</p>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">SKU: </span>
                          <span className="text-gray-800 font-medium truncate block">{p.sku || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Categoría: </span>
                          <span className="text-gray-800 font-medium truncate block">{p.category || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-600">Cantidad vendida</p>
                      <p className="text-base font-semibold text-gray-900">{p.qty}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-600">Ingresos</p>
                      <p className="text-base font-semibold text-gray-900">{formatThousands(p.revenue)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No hay productos vendidos</p>
            )}
          </div>
        </div>

        
      </div>
    </div>
  )
}