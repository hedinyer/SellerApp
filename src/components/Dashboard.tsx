import { useState, useEffect } from 'react'
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

export function Dashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const { formatCurrency, getFontSizeClass } = useConfig()

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 250)
    return () => clearTimeout(timer)
  }, [])

  // Mock data para tienda de ropa
  const todaySalesCount = 24
  const todaySalesTotal = 12450
  const yesterdaySalesTotal = 11100
  const avgTicket = todaySalesTotal / todaySalesCount
  const vsYesterdayPct = Math.round(((todaySalesTotal - yesterdaySalesTotal) / yesterdaySalesTotal) * 100)

  const inventoryCritical = [
    { name: 'Playera Básica Blanca', sku: 'TS-001-WHT', qty: 3, threshold: 5 },
    { name: 'Jeans Slim Fit Azul 32', sku: 'JN-210-BLU-32', qty: 2, threshold: 5 },
    { name: 'Sudadera Negra M', sku: 'SW-045-BLK-M', qty: 4, threshold: 5 },
    { name: 'Camisa Cuadros L', sku: 'SH-120-PLD-L', qty: 1, threshold: 5 }
  ]

  const recentSales = [
    { time: '09:10', folio: 'V-12034', items: [ { name: 'Playera Básica', qty: 2 }, { name: 'Gorra', qty: 1 } ], total: 560, method: 'Tarjeta' },
    { time: '09:25', folio: 'V-12035', items: [ { name: 'Jeans Slim Fit', qty: 1 } ], total: 899, method: 'Efectivo' },
    { time: '09:41', folio: 'V-12036', items: [ { name: 'Sudadera', qty: 1 }, { name: 'Calcetines', qty: 3 } ], total: 1_150, method: 'Tarjeta' },
    { time: '09:52', folio: 'V-12037', items: [ { name: 'Camisa', qty: 1 } ], total: 720, method: 'Tarjeta' },
    { time: '10:05', folio: 'V-12038', items: [ { name: 'Vestido', qty: 1 } ], total: 1_299, method: 'Tarjeta' },
    { time: '10:18', folio: 'V-12039', items: [ { name: 'Jeans', qty: 1 }, { name: 'Playera', qty: 1 } ], total: 1_459, method: 'Tarjeta' },
    { time: '10:33', folio: 'V-12040', items: [ { name: 'Chamarra', qty: 1 } ], total: 2_199, method: 'Tarjeta' },
    { time: '10:41', folio: 'V-12041', items: [ { name: 'Polo', qty: 1 } ], total: 799, method: 'Efectivo' },
    { time: '10:55', folio: 'V-12042', items: [ { name: 'Falda', qty: 1 } ], total: 620, method: 'Tarjeta' },
    { time: '11:12', folio: 'V-12043', items: [ { name: 'Jeans Slim Fit', qty: 2 } ], total: 1_798, method: 'Tarjeta' }
  ]

  const topProducts = [
    { name: 'Jeans Slim Fit', qty: 18, revenue: 16182, img: '' },
    { name: 'Playera Básica', qty: 22, revenue: 6160, img: '' },
    { name: 'Sudadera Unisex', qty: 10, revenue: 8990, img: '' },
    { name: 'Camisa Casual', qty: 8, revenue: 5760, img: '' },
    { name: 'Chamarra Ligera', qty: 5, revenue: 10995, img: '' }
  ]

  const dailyGoal = 20000
  const goalProgress = Math.min(100, Math.round((todaySalesTotal / dailyGoal) * 100))
  const goalRemaining = Math.max(0, dailyGoal - todaySalesTotal)

  const notifications = [
    { title: 'Promoción 2x1 en playeras básicas', body: 'Vigente hoy hasta las 8pm.' },
    { title: 'Recordatorio cierre de caja', body: 'Cierre de caja en 1 hora.' },
    { title: 'Nueva política de devoluciones', body: 'Cambios permitidos hasta 15 días con ticket.' }
  ]

  return (
    <div 
      className={`h-full overflow-y-auto bg-white/40 backdrop-blur-md transition-opacity duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      } ${getFontSizeClass()}`} 
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <div className="p-4 lg:p-6">
        <div className="mb-6 lg:mb-8 animate-fadeInSlide">
          <h1 className="text-2xl lg:text-3xl font-bold text-black mb-2 tracking-tight">
            Dashboard de Tienda de Ropa
          </h1>
          <p className="text-gray-600 font-medium text-sm lg:text-base">
            Hoy • {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* 1. Resumen de Ventas del Día */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
          <div className="bg-white rounded-2xl px-4 py-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-600 font-medium">Ventas de hoy</p>
            <p className="text-3xl lg:text-4xl font-extrabold text-black mt-1">{todaySalesCount}</p>
          </div>
          <div className="bg-white rounded-2xl px-4 py-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-600 font-medium">Total vendido (hoy)</p>
            <p className="text-2xl lg:text-3xl font-extrabold text-black mt-1">{formatCurrency(todaySalesTotal)}</p>
          </div>
          <div className="bg-white rounded-2xl px-4 py-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-600 font-medium">Ticket promedio</p>
            <p className="text-2xl lg:text-3xl font-extrabold text-black mt-1">{formatCurrency(avgTicket)}</p>
          </div>
          <div className="bg-white rounded-2xl px-4 py-5 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-600 font-medium">Variación vs ayer</p>
            <p className={`text-2xl lg:text-3xl font-extrabold mt-1 ${vsYesterdayPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{vsYesterdayPct}%</p>
          </div>
        </div>

        {/* 2. Inventario Crítico */}
        <div className="bg-white rounded-[15px] border border-gray-200 shadow-sm mb-6 lg:mb-8">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Inventario crítico</h3>
            <p className="text-xs text-gray-600">Productos por debajo del umbral</p>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4 font-medium">Producto</th>
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 pr-4 font-medium">Disponible</th>
                  <th className="py-2 pr-4 font-medium">Umbral</th>
                  <th className="py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {inventoryCritical.map((p, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="py-2 pr-4 text-gray-800">{p.name}</td>
                    <td className="py-2 pr-4 text-gray-600">{p.sku}</td>
                    <td className="py-2 pr-4 font-semibold text-red-600">{p.qty}</td>
                    <td className="py-2 pr-4 text-gray-600">{p.threshold}</td>
                    <td className="py-2">
                      <button className="text-xs px-2 py-1 rounded bg-black text-white hover:opacity-90">Solicitar reposición</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Detalle de Ventas Recientes */}
        <div className="bg-white rounded-[15px] border border-gray-200 shadow-sm mb-6 lg:mb-8">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Ventas recientes</h3>
            <p className="text-xs text-gray-600">Últimas transacciones</p>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4 font-medium">Hora</th>
                  <th className="py-2 pr-4 font-medium">Folio</th>
                  <th className="py-2 pr-4 font-medium">Productos</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 font-medium">Pago</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((s, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="py-2 pr-4 text-gray-800">{s.time}</td>
                    <td className="py-2 pr-4 text-gray-600">{s.folio}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {s.items.map((i, j) => (
                        <span key={j} className="inline-block mr-2 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs">{i.name} ×{i.qty}</span>
                      ))}
                    </td>
                    <td className="py-2 pr-4 font-semibold">{formatCurrency(s.total)}</td>
                    <td className="py-2">{s.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Productos Más Vendidos */}
        <div className="bg-white rounded-[15px] border border-gray-200 shadow-sm mb-6 lg:mb-8">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Productos más vendidos</h3>
            <p className="text-xs text-gray-600">Hoy y últimos 7 días</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {topProducts.map((p, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-3">
                <div className="aspect-[4/3] bg-gray-100 rounded mb-2"></div>
                <p className="font-medium text-gray-900">{p.name}</p>
                <p className="text-sm text-gray-600">Cantidad: <span className="font-semibold text-gray-800">{p.qty}</span></p>
                <p className="text-sm text-gray-600">Ingresos: <span className="font-semibold text-gray-800">{formatCurrency(p.revenue)}</span></p>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Cumplimiento de Metas */}
        <div className="bg-white rounded-[15px] border border-gray-200 shadow-sm mb-6 lg:mb-8">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">Meta diaria</h3>
              <span className="text-sm text-gray-600">Meta: {formatCurrency(dailyGoal)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className={`h-3 rounded-full ${goalProgress >= 100 ? 'bg-green-600' : 'bg-blue-600'}`} style={{ width: `${goalProgress}%` }}></div>
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-gray-700 font-medium">{goalProgress}% de avance</span>
              {goalRemaining > 0 ? (
                <span className="text-orange-600">¡Faltan {formatCurrency(goalRemaining)} para alcanzar la meta!</span>
              ) : (
                <span className="text-green-600">Meta alcanzada</span>
              )}
            </div>
          </div>
        </div>

        {/* 6. Notificaciones Importantes y 7. Acciones Rápidas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-8">
          <div className="bg-white rounded-[15px] border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Notificaciones</h3>
              <p className="text-xs text-gray-600">Mensajes del gerente o sistema</p>
            </div>
            <div className="p-4 space-y-3">
              {notifications.map((n, idx) => (
                <div key={idx} className="border border-gray-200 rounded p-3">
                  <p className="font-medium text-gray-900">{n.title}</p>
                  <p className="text-sm text-gray-600">{n.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[15px] border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Acciones rápidas</h3>
              <p className="text-xs text-gray-600">Accesos directos</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <button className="h-24 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium">Abrir caja</button>
              <button className="h-24 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium">Registrar devolución</button>
              <button className="h-24 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium">Consultar en sucursales</button>
              <button className="h-24 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium">Reportar daño/faltante</button>
              <button className="h-24 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium col-span-2">Solicitar apoyo</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}