import { useMemo, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './animations.css'
import './config-styles.css'
import SpotlightCard from './SpotlightCard'
import { useConfig } from '../contexts/ConfigContext'
import { useAuth } from '../contexts/AuthContext'
import {
  ClockIcon,
  CheckIcon,
  CreditCardIcon,
  CalendarIcon,
  FilterIcon,
  SearchIcon,
  ExternalLinkIcon,
  UserIcon,
  DollarSignIcon
} from './icons'

interface SaleItem {
  id: string
  name: string
  variant?: string
  image?: string
  quantity: number
  unitPrice: number
}

type PaymentMethod = 'efectivo' | 'tarjeta' | 'mixto' | 'transferencia'
type SaleStatus = 'completada' | 'pendiente' | 'devolucion_parcial' | 'anulada'

interface ReturnRecord {
  id: string
  date: string
  user: string
  reason: string
  items: { itemId: string; quantity: number }[]
  refundType: 'reembolso' | 'vale'
}

interface SaleRecord {
  id: string // Folio e.g., V-10245
  date: string // YYYY-MM-DD
  time: string // HH:mm
  seller: string // Vendedor
  register: string // Caja
  customer?: { name?: string; phone?: string }
  items: SaleItem[]
  subtotal: number
  discount?: { label: string; amount: number }
  totalPaid: number
  paymentMethod: PaymentMethod
  paymentDetail?: string // e.g., Visa **1234
  status: SaleStatus
  internalNotes?: string[]
  returns?: ReturnRecord[]
  payments?: { method: 'cash' | 'card' | 'transfer' | 'voucher' | 'store-credit'; amount: number }[]
}

// Componentes para iconos mejorados de métodos de pago - mantenemos consistencia con Dashboard
const CashIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./Credit_Card_01.png" 
    alt="Efectivo" 
    width={size} 
    height={size} 
    className={className}
  />
)

const CardIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./Credit_Card_01.png" 
    alt="Tarjeta" 
    width={size} 
    height={size} 
    className={className}
  />
)

const TransferIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./Trending_Up.png" 
    alt="Transferencia" 
    width={size} 
    height={size} 
    className={className}
  />
)

// Componente para el ícono de historial personalizado - siguiendo el patrón de Dashboard
const HistoryIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./Credit_Card_01.png" 
    alt="Historial" 
    width={size} 
    height={size} 
    className={className}
  />
)

export function PaymentHistory() {
  const [isLoading, setIsLoading] = useState(true)
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([])
  // Filtros
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [folioSearch, setFolioSearch] = useState<string>('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [sellerFilter, setSellerFilter] = useState<string>('all')
  const [customerFilter, setCustomerFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  // Selecciones y modales
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [logoBase64, setLogoBase64] = useState<string>('')
  const { t, getFontSizeClass } = useConfig()
  const { user } = useAuth()

  // Cargar logo como base64
  useEffect(() => {
    async function loadLogo() {
      try {
        // Intentar múltiples rutas posibles
        const paths = [
          window.location.origin + '/dwell.avif',
          new URL('/dwell.avif', window.location.href).href,
          './dwell.avif',
          '/dwell.avif'
        ]
        
        for (const logoPath of paths) {
          try {
            const response = await fetch(logoPath)
            if (response.ok) {
              const blob = await response.blob()
              const reader = new FileReader()
              reader.onloadend = () => {
                const base64 = reader.result as string
                setLogoBase64(base64)
              }
              reader.readAsDataURL(blob)
              return // Éxito, salir
            }
          } catch (e) {
            // Continuar con la siguiente ruta
            continue
          }
        }
      } catch (err) {
        console.error('Error loading logo:', err)
      }
    }
    loadLogo()
  }, [])

  const formatNumber = (value: number | string) => {
    const num = Number(value)
    if (Number.isNaN(num)) return String(value)
    const raw = String(value)
    const hasDecimals = raw.includes('.')
    const decimals = hasDecimals ? Math.min(20, (raw.split('.')[1] || '').length) : 0
    return new Intl.NumberFormat('es-ES', {
      useGrouping: true,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const formatNumber2 = (value: number | string) => {
    const num = Number(value)
    if (Number.isNaN(num)) return String(value)
    return new Intl.NumberFormat('es-ES', {
      useGrouping: true,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num)
  }

  useEffect(() => {
    // Initial lightweight loading state
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  // Cargar ventas desde Supabase
  useEffect(() => {
    async function fetchSales() {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error || !data) return

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
      type DbPaymentPart = { method: 'cash' | 'card' | 'transfer' | 'voucher' | 'store-credit'; amount: number }
      type DbCustomer = { name?: string; phone?: string; email?: string; id?: string }
      type DbSaleRow = {
        id: string
        created_at: string
        subtotal: number
        discount: number
        total: number
        items: DbCartLine[]
        payments: DbPaymentPart[]
        customer: DbCustomer | null
        seller: string | null
      }

      function mapMethod(parts: DbPaymentPart[]): { method: PaymentMethod; detail?: string } {
        const methods = Array.from(new Set(parts.map(p => p.method)))
        if (methods.length > 1) return { method: 'mixto', detail: methods.join('+') }
        const m = methods[0]
        switch (m) {
          case 'cash': return { method: 'efectivo' }
          case 'card': return { method: 'tarjeta' }
          case 'transfer': return { method: 'transferencia' }
          default: return { method: 'efectivo' }
        }
      }

      const mapped: SaleRecord[] = (data as unknown as DbSaleRow[]).map(r => {
        const d = new Date(r.created_at)
        const date = d.toISOString().slice(0, 10)
        const time = d.toTimeString().slice(0, 5)
        const payments = r.payments || []
        const methodInfo = payments.length > 0 ? mapMethod(payments) : { method: 'efectivo' as PaymentMethod }

        const items: SaleItem[] = (r.items || []).map(it => ({
          id: it.id || it.itemId,
          name: it.name,
          variant: it.variantLabel,
          image: it.imageUrl,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0
        }))

        const sr: SaleRecord = {
          id: r.id,
          date,
          time,
          seller: r.seller || 'Vendedor',
          register: 'Caja 1',
          customer: r.customer ? { name: r.customer.name, phone: r.customer.phone } : undefined,
          items,
          subtotal: Number(r.subtotal) || 0,
          discount: (Number(r.discount) || 0) > 0 ? { label: 'Descuento', amount: Number(r.discount) || 0 } : undefined,
          totalPaid: Number(r.total) || 0,
          paymentMethod: methodInfo.method,
          paymentDetail: methodInfo.detail,
          status: 'completada',
          payments: r.payments || []
        }
        return sr
      })

      setSalesHistory(mapped)
    }
    fetchSales()
  }, [])

  // Ventas cargadas desde la base de datos

  // Listas derivadas
  const sellers = useMemo(() => Array.from(new Set(salesHistory.map(s => s.seller))), [salesHistory])

  // Aplicación de filtros
  const filteredSales = useMemo(() => {
    return salesHistory.filter(sale => {
      const withinFrom = !dateFrom || sale.date >= dateFrom
      const withinTo = !dateTo || sale.date <= dateTo
      const matchesFolio = !folioSearch || sale.id.toLowerCase().includes(folioSearch.toLowerCase())
      const matchesMethod = methodFilter === 'all' || sale.paymentMethod === methodFilter
      const matchesSeller = sellerFilter === 'all' || sale.seller === sellerFilter
      const matchesCustomer = !customerFilter ||
        (sale.customer?.name && sale.customer.name.toLowerCase().includes(customerFilter.toLowerCase())) ||
        (sale.customer?.phone && sale.customer.phone.toLowerCase().includes(customerFilter.toLowerCase()))
      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter
      return withinFrom && withinTo && matchesFolio && matchesMethod && matchesSeller && matchesCustomer && matchesStatus
    })
  }, [salesHistory, dateFrom, dateTo, folioSearch, methodFilter, sellerFilter, customerFilter, statusFilter])

  // Estadísticas
  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.status !== 'anulada' ? s.totalPaid : 0), 0)
  const totalDiscounts = filteredSales.reduce((sum, s) => sum + (s.discount?.amount || 0), 0)
  const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'efectivo':
        return <CashIcon size={14} />
      case 'tarjeta':
        return <CardIcon size={14} />
      case 'mixto':
        return <CardIcon size={14} />
      case 'transferencia':
        return <TransferIcon size={14} />
      default:
        return <DollarSignIcon size={14} />
    }
  }

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'efectivo':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'tarjeta':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'mixto':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'transferencia':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPaymentMethodName = (method: string) => {
    const methods = {
      'efectivo': t('cash'),
      'tarjeta': t('card'),
      'mixto': 'Mixto',
      'transferencia': t('transfer')
    }
    return methods[method as keyof typeof methods] || method
  }

  const openSaleDetail = (sale: SaleRecord) => {
    setSelectedSale(sale)
    setIsDetailOpen(true)
  }

  const closeSaleDetail = () => {
    setSelectedSale(null)
    setIsDetailOpen(false)
    setIsReturnOpen(false)
  }

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setFolioSearch('')
    setMethodFilter('all')
    setSellerFilter('all')
    setCustomerFilter('')
    setStatusFilter('all')
  }

  const printInvoice = (sale: SaleRecord) => {
    try {
      const w = window.open('', '_blank')
      if (!w) return
      
      const itemsHtml = sale.items.map(l => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; font-size: 14px; color: #111827;">
            <div style="font-weight: 500; margin-bottom: 2px;">${l.name}</div>
            ${l.variant ? `<div style=\"font-size: 12px; color: #6b7280;\">${l.variant}</div>` : ''}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-size: 14px; color: #111827; font-weight: 500;">
            x${l.quantity}
          </td>
          <td style="padding: 10px 0; text-align: right; font-size: 14px; color: #111827; font-weight: 600;">
            ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(l.unitPrice * l.quantity)}
          </td>
        </tr>
      `).join('')

      const paymentsHtml = (sale.payments || []).map((p) => {
        const methodNames: Record<string, string> = {
          'cash': 'Efectivo',
          'card': 'Tarjeta',
          'transfer': 'Transferencia',
          'voucher': 'Vale',
          'store-credit': 'Crédito interno'
        }
        return `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
            <span style="color: #6b7280; text-transform: capitalize;">${methodNames[p.method] || p.method}:</span>
            <span style="font-weight: 600; color: #111827;">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(p.amount)}</span>
          </div>
        `
      }).join('')

      const customerInfo = sale.customer ? `
        <div style="margin-top: 24px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
          <div style="font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Información del Cliente</div>
          <div style="font-size: 13px; color: #111827; line-height: 1.8;">
            <div><strong>Nombre:</strong> ${sale.customer.name || '—'}</div>
            ${sale.customer.phone ? `<div><strong>Teléfono:</strong> ${sale.customer.phone}</div>` : ''}
          </div>
        </div>
      ` : ''

      w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Factura de venta - ${sale.id}</title>
          <style>
            @font-face {
              font-family: 'Helvetica Neue';
              src: url('/fonts/HelveticaNeueMedium.otf') format('opentype');
              font-weight: 500;
              font-style: normal;
              font-display: swap;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; color: #111827; line-height: 1.5; }
            .container { max-width: 600px; margin: 0 auto; padding: 32px; background: white; }
            .header { display: flex; align-items: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }
            .logo { width: 80px; height: 80px; object-fit: contain; margin-right: 20px; }
            .header-text { flex: 1; }
            .header-title { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 4px; letter-spacing: -0.5px; }
            .header-subtitle { font-size: 13px; color: #6b7280; font-weight: 500; }
            .items-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
            .items-table thead { background: #f9fafb; border-bottom: 2px solid #e5e7eb; }
            .items-table th { padding: 12px 0; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
            .items-table th:last-child { text-align: right; }
            .items-table th:nth-child(2) { text-align: center; }
            .totals { margin-top: 24px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .total-row.final { margin-top: 12px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 20px; font-weight: 700; color: #111827; }
            .payments-title { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            @media print { .container { padding: 24px; max-width: 100%; } @page { margin: 0.5cm; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${logoBase64 ? `<img src="${logoBase64}" alt="Dwell Logo" class="logo" />` : ''}
              <div class="header-text">
                <div class="header-title">Ticket de Venta</div>
                <div class="header-subtitle">Factura #${sale.id}</div>
              </div>
            </div>
            <div class="info-section">
              <div class="info-row" style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;">
                <span class="info-label" style="color:#6b7280;font-weight:500;">Fecha y Hora:</span>
                <span class="info-value" style="color:#111827;font-weight:600;">${sale.date} ${sale.time}</span>
              </div>
            </div>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <div class="totals">
              <div class="total-row">
                <span class="total-label" style="color:#6b7280;font-weight:500;">Subtotal:</span>
                <span class="total-value" style="color:#111827;font-weight:600;">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.subtotal)}</span>
              </div>
              ${sale.discount ? `
              <div class="total-row">
                <span class="total-label" style="color:#6b7280;font-weight:500;">Descuento:</span>
                <span class="total-value" style="color:#dc2626;font-weight:600;">-${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.discount.amount)}</span>
              </div>
              ` : ''}
              <div class="total-row final">
                <span class="total-label">Total a Pagar:</span>
                <span class="total-value">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.totalPaid)}</span>
              </div>
            </div>
            ${(sale.payments && sale.payments.length > 0) ? `
            <div class="payments-section" style="margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb;">
              <div class="payments-title">Métodos de Pago</div>
              ${paymentsHtml}
            </div>` : ''}
            ${customerInfo}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); window.close(); }, 300);
            }
          </script>
        </body>
        </html>
      `)
      w.document.close()
    } catch {}
  }

  const exportCSV = () => {
    const headers = ['Folio','Fecha','Hora','Vendedor','Cliente','Productos','Subtotal','Descuento','Total','Método','Detalle','Estado']
    const rows = filteredSales.map(s => {
      const productsCount = s.items.reduce((c,i)=>c+i.quantity,0)
      return [
        s.id,
        s.date,
        s.time,
        s.seller,
        s.customer?.name || 'Anónimo',
        String(productsCount),
        String(s.subtotal),
        String(s.discount?.amount || 0),
        String(s.totalPaid),
        s.paymentMethod,
        s.paymentDetail || '',
        s.status
      ]
    })
    const csv = [headers.join(','), ...rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ventas_export_${new Date().toISOString().slice(0,10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Devolución: estado local de selección
  const [returnSelections, setReturnSelections] = useState<Record<string, number>>({})
  const [returnReason, setReturnReason] = useState<string>('talla incorrecta')
  const [refundType, setRefundType] = useState<'reembolso' | 'vale'>('reembolso')

  const openReturn = (sale: SaleRecord) => {
    setSelectedSale(sale)
    const defaults: Record<string, number> = {}
    sale.items.forEach(i => { defaults[i.id] = 0 })
    setReturnSelections(defaults)
    setReturnReason('talla incorrecta')
    setRefundType('reembolso')
    setIsDetailOpen(true)
    setIsReturnOpen(true)
  }

  const commitReturn = () => {
    if (!selectedSale) return
    const anyQty = Object.values(returnSelections).some(q => q > 0)
    if (!anyQty) return
    // Simula registro de devolución y restauración de stock
    const newReturn: ReturnRecord = {
      id: 'R-' + Math.floor(Math.random()*100000).toString(),
      date: new Date().toISOString().replace('T',' ').slice(0,16),
      user: user?.name || 'Usuario',
      reason: returnReason,
      items: Object.entries(returnSelections).filter(([,q])=>q>0).map(([itemId, quantity])=>({ itemId, quantity })),
      refundType
    }
    const updated: SaleRecord = {
      ...selectedSale,
      returns: [...(selectedSale.returns || []), newReturn],
      status: 'devolucion_parcial'
    }
    // Actualiza en memoria (solo demo)
    setSelectedSale(updated)
    setIsReturnOpen(false)
  }

  return (
    <div 
      className={`h-full overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 transition-opacity duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      } ${getFontSizeClass()}`} 
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <div className="p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-8 animate-fadeInSlide">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-black mb-1 sm:mb-2 tracking-tight">
            Historial de Ventas
          </h1>
          <p className="text-gray-600 font-medium text-xs sm:text-sm lg:text-base">
            Tienda de Ropa • {new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:flex lg:justify-center gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6 lg:mb-8">
          <div className="w-full lg:w-48">
            <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
              <div className="rounded-xl sm:rounded-2xl px-3 sm:px-4 py-4 sm:py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-24 sm:h-32 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(34,197,94,0.15)' }}>
                <div className="absolute inset-0 pointer-events-none metallic-shine" />
                <div className="flex flex-col justify-between h-full">
                  <h3 className="font-semibold text-black text-[10px] sm:text-xs lg:text-sm mb-1 sm:mb-2 tracking-wide uppercase opacity-80 text-center w-full leading-tight">Ingresos Totales</h3>
                  <div className="flex flex-col items-center justify-center flex-1">
                    <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-extrabold text-black leading-none" style={{ fontFamily: 'Helvetica Neue' }}>{formatNumber(totalRevenue)}</p>
                  </div>
                  <p className="text-[10px] sm:text-xs lg:text-sm font-normal text-black/70 leading-tight">total recaudado</p>
                </div>
              </div>
            </SpotlightCard>
          </div>

          <div className="w-full lg:w-48">
            <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
              <div className="rounded-xl sm:rounded-2xl px-3 sm:px-4 py-4 sm:py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-24 sm:h-32 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                <div className="absolute inset-0 pointer-events-none metallic-shine" />
                <div className="flex flex-col justify-between h-full">
                  <h3 className="font-semibold text-black text-[10px] sm:text-xs lg:text-sm mb-1 sm:mb-2 tracking-wide uppercase opacity-80 text-center w-full leading-tight">Descuentos</h3>
                  <div className="flex flex-col items-center justify-center flex-1">
                    <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-extrabold text-black leading-none" style={{ fontFamily: 'Helvetica Neue' }}>{formatNumber(totalDiscounts)}</p>
                  </div>
                  <p className="text-[10px] sm:text-xs lg:text-sm font-normal text-black/70 leading-tight">aplicados</p>
                </div>
              </div>
            </SpotlightCard>
          </div>

          <div className="w-full lg:w-48">
            <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
              <div className="rounded-xl sm:rounded-2xl px-3 sm:px-4 py-4 sm:py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-24 sm:h-32 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(168,85,247,0.15)' }}>
                <div className="absolute inset-0 pointer-events-none metallic-shine" />
                <div className="flex flex-col justify-between h-full">
                  <h3 className="font-semibold text-black text-[10px] sm:text-xs lg:text-sm mb-1 sm:mb-2 tracking-wide uppercase opacity-80 text-center w-full leading-tight">Ticket Promedio</h3>
                  <div className="flex flex-col items-center justify-center flex-1">
                    <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-extrabold text-black leading-none" style={{ fontFamily: 'Helvetica Neue' }}>{formatNumber2(averageTicket)}</p>
                  </div>
                  <p className="text-[10px] sm:text-xs lg:text-sm font-normal text-black/70 leading-tight">por venta</p>
                </div>
              </div>
            </SpotlightCard>
          </div>

          <div className="w-full lg:w-48">
            <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
              <div className="rounded-xl sm:rounded-2xl px-3 sm:px-4 py-4 sm:py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-24 sm:h-32 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '300ms', boxShadow: '0 4px 16px 0 rgba(251,146,60,0.15)' }}>
                <div className="absolute inset-0 pointer-events-none metallic-shine" />
                <div className="flex flex-col justify-between h-full">
                  <h3 className="font-semibold text-black text-[10px] sm:text-xs lg:text-sm mb-1 sm:mb-2 tracking-wide uppercase opacity-80 text-center w-full leading-tight">Ventas</h3>
                  <div className="flex flex-col items-center justify-center flex-1">
                    <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-extrabold text-black leading-none" style={{ fontFamily: 'Helvetica Neue' }}>{filteredSales.length}</p>
                  </div>
                  <p className="text-[10px] sm:text-xs lg:text-sm font-normal text-black/70 leading-tight">encontradas</p>
                </div>
              </div>
            </SpotlightCard>
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <div className="bg-white rounded-xl sm:rounded-[15px] border border-gray-100 shadow-sm animate-slideInUp w-full flex flex-col" style={{ animationDelay: '500ms', margin: 0, maxWidth: '100vw' }}>
          <div className="p-3 sm:p-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <div className="flex items-center">
                <HistoryIcon size={16} className="sm:w-[18px] sm:h-[18px] text-blue-600 mr-2" />
                <h3 className="font-semibold text-black text-xs sm:text-sm">Filtros de Búsqueda</h3>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full sm:w-auto">
                <button onClick={() => {/* Buscar aplica por estado actual */}} className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded bg-blue-600 text-white text-[10px] sm:text-xs font-bold">Buscar</button>
                <button onClick={resetFilters} className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-[10px] sm:text-xs font-bold border">Restablecer</button>
                {user?.role === 'admin' && (
                  <button onClick={exportCSV} className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded bg-emerald-600 text-white text-[10px] sm:text-xs font-bold">Exportar CSV</button>
                )}
              </div>
            </div>
            <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              <div>
                <label className="text-[10px] sm:text-xs text-black">Desde</label>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded text-xs sm:text-sm text-black" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs text-black">Hasta</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded text-xs sm:text-sm text-black" />
              </div>
              <div className="relative">
                <label className="text-[10px] sm:text-xs text-black">Folio / ID</label>
                <input type="text" value={folioSearch} onChange={e=>setFolioSearch(e.target.value)} placeholder="V-10245..." className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded text-xs sm:text-sm text-black placeholder:text-black" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs text-black">Método de pago</label>
                <select value={methodFilter} onChange={e=>setMethodFilter(e.target.value)} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded text-xs sm:text-sm text-black">
                  <option value="all">Todos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="mixto">Mixto</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] sm:text-xs text-black">Vendedor</label>
                <select value={sellerFilter} onChange={e=>setSellerFilter(e.target.value)} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded text-xs sm:text-sm text-black">
                  <option value="all">Todos</option>
                  {sellers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
              </select>
              </div>
              <div className="relative">
                <label className="text-[10px] sm:text-xs text-black">Cliente</label>
                <input type="text" value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)} placeholder="Nombre o teléfono" className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded text-xs sm:text-sm text-black placeholder:text-black" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs text-black">Estado</label>
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded text-xs sm:text-sm text-black">
                  <option value="all">Todos</option>
                  <option value="completada">Completada</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="devolucion_parcial">Devolución parcial</option>
                  <option value="anulada">Anulada</option>
              </select>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto flex-1 overflow-y-auto kitchen-scrollbar" style={{ maxHeight: '60vh' }}>
            <table className="w-full min-w-[980px] table-fixed">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Fecha/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Folio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Vendedor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Cliente</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Productos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Método</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSales.map((sale, index) => {
                  const productsCount = sale.items.reduce((c,i)=>c+i.quantity,0)
                  const isAdmin = user?.role === 'admin'
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors duration-150 animate-slideInUp" style={{ animationDelay: `${(index * 50) + 600}ms` }}>
                      <td className="px-4 py-4 whitespace-nowrap align-middle">
                        <div className="text-sm text-gray-900">{sale.date}</div>
                        <div className="text-xs text-gray-500">{sale.time}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap align-middle">
                        <div className="text-sm font-semibold text-gray-900" title={sale.id}>{sale.id.slice(0, 10)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap align-middle">
                        <div className="text-sm text-gray-900">{sale.seller}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap align-middle">
                        <div className="text-sm text-gray-900">{sale.customer?.name || 'Anónimo'}</div>
                      </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <div className="text-sm text-gray-900">{productsCount}</div>
                    </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right align-middle">
                        <div className="text-sm font-bold text-green-600 break-all leading-tight">{formatNumber(sale.totalPaid)}</div>
                    </td>
                      <td className="px-4 py-4 whitespace-nowrap align-middle">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getPaymentMethodColor(sale.paymentMethod)}`}>
                          <span className="mr-1">{getPaymentMethodIcon(sale.paymentMethod)}</span>
                          {getPaymentMethodName(sale.paymentMethod)}
                        </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${
                          sale.status === 'completada' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          sale.status === 'pendiente' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          sale.status === 'devolucion_parcial' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                          'bg-red-100 text-red-800 border-red-200'
                        }`}>
                          {sale.status.replace('_',' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openSaleDetail(sale)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1.5 px-2 rounded">Ver</button>
                          <button onClick={() => printInvoice(sale)} className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold py-1.5 px-2 rounded">Imprimir</button>
                          {isAdmin && (
                            <>
                              <button onClick={() => openReturn(sale)} className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-1.5 px-2 rounded">Devolución</button>
                              <button disabled className="bg-red-500/70 text-white text-xs font-bold py-1.5 px-2 rounded opacity-60 cursor-not-allowed">Anular</button>
                            </>
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
          <div className="md:hidden flex-1 overflow-y-auto kitchen-scrollbar p-3 space-y-3" style={{ maxHeight: '60vh' }}>
            {filteredSales.length > 0 ? (
              filteredSales.map((sale, index) => {
                const productsCount = sale.items.reduce((c,i)=>c+i.quantity,0)
                const isAdmin = user?.role === 'admin'
                return (
                  <div key={sale.id} className="border border-gray-200 rounded-lg p-3 space-y-2 animate-slideInUp" style={{ animationDelay: `${(index * 50) + 600}ms` }}>
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{sale.date}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{sale.time}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">Folio: {sale.id.slice(0, 10)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-green-600">{formatNumber(sale.totalPaid)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border mt-1 ${getPaymentMethodColor(sale.paymentMethod)}`}>
                          {getPaymentMethodName(sale.paymentMethod)}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Vendedor: </span>
                        <span className="text-gray-800">{sale.seller}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Cliente: </span>
                        <span className="text-gray-800 truncate block">{sale.customer?.name || 'Anónimo'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Productos: </span>
                        <span className="text-gray-800">{productsCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Estado: </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          sale.status === 'completada' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          sale.status === 'pendiente' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          sale.status === 'devolucion_parcial' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                          'bg-red-100 text-red-800 border-red-200'
                        }`}>
                          {sale.status.replace('_',' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                      <button onClick={() => openSaleDetail(sale)} className="flex-1 px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] sm:text-xs font-bold rounded">Ver</button>
                      <button onClick={() => printInvoice(sale)} className="flex-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-[10px] sm:text-xs font-bold rounded">Imprimir</button>
                      {isAdmin && (
                        <>
                          <button onClick={() => openReturn(sale)} className="flex-1 px-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] sm:text-xs font-bold rounded">Devolución</button>
                          <button disabled className="flex-1 px-2 py-1.5 bg-red-500/70 text-white text-[10px] sm:text-xs font-bold rounded opacity-60 cursor-not-allowed">Anular</button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">No se encontraron ventas</div>
            )}
          </div>

          {filteredSales.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <HistoryIcon size={32} className="sm:w-12 sm:h-12 mx-auto text-gray-300 mb-3 sm:mb-4 opacity-30" />
              <h3 className="text-sm sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">No se encontraron ventas</h3>
              <p className="text-xs sm:text-base text-gray-500">Intenta ajustar los filtros</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detalle de Venta */}
      {isDetailOpen && selectedSale && (
        <div className="fixed inset-0 z-50 p-2 sm:p-4 lg:p-6 flex justify-center items-center" style={{ overflow: 'auto' }}>
          {/* Blur overlay */}
          <div className="fixed inset-0 bg-white/20 backdrop-blur-[2px] z-0 transition-all duration-300" />
          {/* Modal centrado */}
          <div 
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gray-100 flex flex-col z-10 relative"
            style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)' }}
          >
            {/* Header */}
            <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-100 bg-white sticky top-0 z-10">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2">
                  <div>
                    <div className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight leading-tight">{formatNumber(selectedSale.totalPaid)}</div>
                    <div className="text-xs sm:text-sm lg:text-base font-semibold text-gray-700 mt-1 uppercase tracking-wider">Folio: {selectedSale.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs sm:text-sm lg:text-base text-gray-500 font-medium">{selectedSale.date}</div>
                    <div className="text-[10px] sm:text-xs text-gray-400">{selectedSale.time}</div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-3 sm:mt-4 text-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 mb-1">{selectedSale.seller}</div>
                    <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-medium">Vendedor</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 mb-1">{selectedSale.register}</div>
                    <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-medium">Caja</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 mb-1 truncate">{selectedSale.customer?.name || 'Anónimo'}</div>
                    <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-medium">Cliente</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Productos */}
            <div className="px-3 sm:px-6 py-3 sm:py-5 flex-1 overflow-y-auto bg-white apple-scrollbar">
              <h3 className="font-semibold text-gray-800 mb-3 sm:mb-4 text-xs sm:text-sm lg:text-base border-b border-gray-100 pb-2 tracking-wide uppercase">Productos vendidos</h3>
              <div className="divide-y divide-gray-50">
                {selectedSale.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 items-center py-2 text-xs sm:text-sm">
                    <div className="col-span-7 font-medium text-gray-900 truncate text-left">
                      <div className="text-xs sm:text-sm">{item.name}{item.variant ? ` – ${item.variant}` : ''}</div>
                    </div>
                    <div className="col-span-2 text-gray-500 font-mono text-[10px] sm:text-xs text-center">x{item.quantity}</div>
                    <div className="col-span-3 font-semibold text-gray-900 text-right text-xs sm:text-sm">{formatNumber(item.unitPrice * item.quantity)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen financiero y acciones */}
            <div className="px-3 sm:px-6 pt-3 sm:pt-5 pb-4 sm:pb-6 bg-gray-50 border-t border-gray-100 sticky bottom-0">
              <div className="max-w-md mx-auto">
                <div className="flex flex-col gap-1.5 sm:gap-2 text-xs sm:text-sm lg:text-base">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-normal">Subtotal</span>
                    <span className="font-semibold text-gray-900">{formatNumber(selectedSale.subtotal)}</span>
                  </div>
                  {selectedSale.discount && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-normal">Descuento ({selectedSale.discount.label})</span>
                      <span className="font-semibold text-green-600">-{formatNumber(selectedSale.discount.amount)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 my-1.5 sm:my-2"></div>
                  <div className="flex justify-between items-center text-base sm:text-lg lg:text-xl font-black">
                    <span className="text-gray-900">Total pagado</span>
                    <span className="text-green-600">{formatNumber(selectedSale.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] sm:text-xs text-gray-400">Método de pago</span>
                    <span className="text-[10px] sm:text-xs font-medium text-gray-700 capitalize truncate ml-2">{getPaymentMethodName(selectedSale.paymentMethod)}{selectedSale.paymentDetail ? ` (${selectedSale.paymentDetail})` : ''}</span>
                  </div>
                </div>
                {selectedSale.internalNotes && selectedSale.internalNotes.length > 0 && (
                  <div className="mt-3 sm:mt-4">
                    <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-medium mb-1">Notas internas</div>
                    <ul className="list-disc pl-4 sm:pl-5 text-xs sm:text-sm text-gray-700 space-y-1">
                      {selectedSale.internalNotes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}
                {selectedSale.returns && selectedSale.returns.length > 0 && (
                  <div className="mt-3 sm:mt-4">
                    <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-medium mb-1">Historial de ajustes</div>
                    <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                      {selectedSale.returns.map(r => (
                        <div key={r.id} className="flex flex-col sm:flex-row justify-between gap-1">
                          <span className="text-xs">{r.date} • {r.user} • {r.reason}</span>
                          <span className="text-[10px] sm:text-xs text-gray-500">{r.refundType === 'reembolso' ? 'Reembolso' : 'Vale'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row justify-end mt-4 sm:mt-6 gap-2">
                  {user?.role === 'admin' && (
                    <button onClick={() => setIsReturnOpen(true)} className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded-lg bg-amber-500 text-white font-bold text-xs sm:text-sm">Registrar devolución</button>
                  )}
                  <button onClick={closeSaleDetail} className="w-full sm:w-auto px-4 sm:px-6 py-2 rounded-lg bg-gray-900 text-white font-bold text-xs sm:text-sm lg:text-base">Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Devolución */}
      {isDetailOpen && isReturnOpen && selectedSale && (
        <div className="fixed inset-0 z-50 p-2 sm:p-4 flex justify-center items-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setIsReturnOpen(false)} />
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Registrar devolución</h3>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {selectedSale.items.map(item => {
                const maxQty = item.quantity
                const current = returnSelections[item.id] ?? 0
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 border rounded p-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.name}{item.variant ? ` – ${item.variant}` : ''}</div>
                      <div className="text-xs text-gray-500">Comprado: {item.quantity} • Unit: {formatNumber(item.unitPrice)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 border rounded" onClick={() => setReturnSelections(s => ({...s, [item.id]: Math.max(0, current-1)}))}>-</button>
                      <div className="w-8 text-center text-sm">{current}</div>
                      <button className="px-2 py-1 border rounded" onClick={() => setReturnSelections(s => ({...s, [item.id]: Math.min(maxQty, current+1)}))}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-xs text-gray-500">Motivo</label>
                <select value={returnReason} onChange={e=>setReturnReason(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm">
                  <option value="talla incorrecta">Talla incorrecta</option>
                  <option value="defecto">Defecto</option>
                  <option value="cambio de opinión">Cambio de opinión</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Reembolso</label>
                <select value={refundType} onChange={e=>setRefundType(e.target.value as any)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm">
                  <option value="reembolso">Mismo método</option>
                  <option value="vale">Vale / crédito</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4 sm:mt-5">
              <button onClick={() => setIsReturnOpen(false)} className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded bg-gray-100 text-gray-800 text-xs sm:text-sm font-bold">Cancelar</button>
              <button onClick={commitReturn} className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded bg-amber-600 text-white text-xs sm:text-sm font-bold">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 