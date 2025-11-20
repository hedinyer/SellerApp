import { useMemo, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './animations.css'
import './config-styles.css'
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
  DollarSignIcon,
  XIcon
} from './icons'

interface Modification {
  id: string
  nombre: string
  descripcion?: string
  precio_unitario: number
  cantidad: number
  subtotal: number
}

interface SaleItem {
  id: string
  name: string
  variant?: string
  image?: string
  quantity: number
  unitPrice: number
  modifications?: Modification[]
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
  // Selecciones y modales
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [logoBase64, setLogoBase64] = useState<string>('')
  const [modalPosition, setModalPosition] = useState({ top: 0 })
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

  // Helper function to get first name only
  const getFirstName = (fullName: string | undefined | null): string => {
    if (!fullName) return '—'
    const parts = fullName.trim().split(/\s+/)
    return parts[0] || fullName
  }

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

  // Cargar ventas y cotizaciones aprobadas desde Supabase
  useEffect(() => {
    async function fetchSales() {
      // Cargar ventas
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      // Cargar cotizaciones aprobadas
      const { data: quotesData, error: quotesError } = await supabase
        .from('cotizaciones')
        .select('*')
        .eq('estado', 'aprobada')
        .order('created_at', { ascending: false })
        .limit(200)

      if (salesError && quotesError) return

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
        status?: string
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

      // Mapear ventas
      const mappedSales: SaleRecord[] = (salesData || []).map((r: any) => {
        const d = new Date(r.created_at)
        const date = d.toISOString().slice(0, 10)
        const time = d.toTimeString().slice(0, 5)
        const payments = r.payments || []
        const methodInfo = payments.length > 0 ? mapMethod(payments) : { method: 'efectivo' as PaymentMethod }

        const items: SaleItem[] = (r.items || []).map((it: any) => ({
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
          status: (r.status as SaleStatus) || 'completada',
          payments: r.payments || []
        }
        return sr
      })

        // Mapear cotizaciones aprobadas
        const mappedQuotes: SaleRecord[] = (quotesData || []).map((q: any) => {
          const d = new Date(q.created_at)
          const date = d.toISOString().slice(0, 10)
          const time = d.toTimeString().slice(0, 5)

          // Convertir items de cotización al formato de venta
          const items: SaleItem[] = (q.resumen_pedido?.items || []).map((item: any) => ({
            id: item.id || '',
            name: item.descripcion || 'Producto',
            variant: undefined,
            image: item.imagen_url,
            quantity: Number(item.cantidad || 0),
            unitPrice: Number(item.precio_unitario || 0),
            modifications: (item.modificaciones || []).map((mod: any) => ({
              id: mod.id || '',
              nombre: mod.nombre || 'Modificación',
              descripcion: mod.descripcion,
              precio_unitario: Number(mod.precio_unitario || 0),
              cantidad: Number(mod.cantidad || 0),
              subtotal: Number(mod.subtotal || 0)
            }))
          }))

          // Calcular descuento total desde los items (descuento_unitario * cantidad)
          const totalDiscount = (q.resumen_pedido?.items || []).reduce((acc: number, item: any) => {
            return acc + (Number(item.descuento_unitario || 0) * Number(item.cantidad || 0))
          }, 0)

          // Obtener datos del cliente
          const customer = q.datos_cliente?.tipo === 'natural'
            ? { name: q.datos_cliente?.nombre, phone: q.datos_cliente?.telefono }
            : { name: q.datos_cliente?.empresa?.nombre, phone: q.datos_cliente?.telefono }

          // Crear pago por defecto para cotizaciones
          const payments: DbPaymentPart[] = [{ method: 'transfer', amount: Number(q.total || 0) }]
          const methodInfo = mapMethod(payments)

          const sr: SaleRecord = {
            id: q.id,
            date,
            time,
            seller: 'Cotización',
            register: 'Cotización',
            customer: customer.name ? customer : undefined,
            items,
            subtotal: Number(q.subtotal || 0),
            discount: totalDiscount > 0 ? { label: 'Descuento', amount: totalDiscount } : undefined,
            totalPaid: Number(q.total || 0),
            paymentMethod: methodInfo.method,
            paymentDetail: 'Cotización aprobada',
            status: 'completada' as SaleStatus,
            payments
          }
          return sr
        })

      // Combinar y ordenar por fecha
      const allRecords = [...mappedSales, ...mappedQuotes].sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`)
        const dateB = new Date(`${b.date}T${b.time}`)
        return dateB.getTime() - dateA.getTime()
      })

      setSalesHistory(allRecords)
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
      return withinFrom && withinTo && matchesFolio && matchesMethod && matchesSeller && matchesCustomer
    })
  }, [salesHistory, dateFrom, dateTo, folioSearch, methodFilter, sellerFilter, customerFilter])

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
    setModalPosition({ top: window.scrollY + window.innerHeight / 2 })
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
  }

  const updateSaleStatus = async (saleId: string, newStatus: SaleStatus) => {
    try {
      // Actualizar en Supabase
      const { error } = await supabase
        .from('sales')
        .update({ status: newStatus })
        .eq('id', saleId)
      
      if (error) {
        console.error('Error updating sale status:', error)
        alert('Error al actualizar el estado de la venta')
        return
      }

      // Actualizar en el estado local
      setSalesHistory(prev => prev.map(sale => 
        sale.id === saleId ? { ...sale, status: newStatus } : sale
      ))
    } catch (error) {
      console.error('Error updating sale status:', error)
      alert('Error al actualizar el estado de la venta')
    }
  }

  const printInvoice = (sale: SaleRecord) => {
    try {
      const w = window.open('', '_blank')
      if (!w) return

      const itemsHtml = sale.items.map(item => `
        <div class="item-row">
            <div class="item-image">
                 ${item.image ? `<img src="${item.image}" alt="img" />` : '<div class="no-img">IMG</div>'}
            </div>
            <div class="item-details">
                <div class="item-name">${item.name}</div>
                ${item.variant ? `<div class="item-variant">${item.variant}</div>` : ''}
            </div>
            <div class="item-totals">
                <div class="item-qty">x${item.quantity}</div>
                <div class="item-price">${formatNumber(item.unitPrice * item.quantity)}</div>
            </div>
        </div>
      `).join('')

      const customerHtml = sale.customer ? `
        <div class="customer-box">
            <div class="customer-name">${sale.customer.name || 'Cliente General'}</div>
            ${sale.customer.phone ? `<div class="customer-row"><span class="label">Tel:</span><span class="value">${sale.customer.phone}</span></div>` : ''}
        </div>
      ` : ''

      const barcodeHtml = `
        <div class="barcode-container">
           <div class="barcode-lines">
              ${Array.from({ length: 45 }).map(() => `<div class="bar" style="width: ${Math.random() > 0.6 ? '3px' : '1px'}"></div>`).join('')}
           </div>
           <div class="barcode-text">
              <span>${sale.id.slice(0, 4)}</span>
              <span>${sale.id.slice(-4)}</span>
           </div>
        </div>
      `

      w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ticket - ${sale.id}</title>
          <style>
            @font-face {
              font-family: 'Helvetica Neue';
              src: url('/fonts/HelveticaNeueMedium.otf') format('opentype');
              font-weight: 500;
              font-style: normal;
              font-display: swap;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #f3f4f6;
              color: #111827;
              font-size: 12px;
              line-height: 1.4;
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              padding: 20px;
            }
            .container {
              width: 100%;
              max-width: 380px;
              margin: 0 auto;
              padding: 24px;
              background: white;
              border-radius: 24px;
              border: 1px solid #e5e7eb;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { height: 64px; object-fit: contain; margin-bottom: 16px; max-width: 100%; }
            .ticket-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 4px; }
            .ticket-value { font-size: 14px; font-weight: 700; color: #111827; font-family: monospace; margin-bottom: 12px; }
            .date-row { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 500; color: #374151; }
            .dot { width: 4px; height: 4px; background: #d1d5db; border-radius: 50%; }
            
            .dashed-line {
              border-top: 2px dashed #e5e7eb;
              margin: 16px 0;
              position: relative;
            }
            .dashed-line::before,
            .dashed-line::after {
              content: '';
              position: absolute;
              top: 50%;
              transform: translateY(-50%);
              width: 24px;
              height: 24px;
              background: #f3f4f6;
              border-radius: 50%;
            }
            .dashed-line::before { left: -36px; }
            .dashed-line::after { right: -36px; }
            
            /* Customer Box */
            .customer-box {
              background: #f9fafb;
              border: 1px solid #f3f4f6;
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 24px;
            }
            .customer-name { font-weight: 700; font-size: 14px; margin-bottom: 8px; }
            .customer-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 12px; }
            .customer-row .label { color: #9ca3af; min-width: 40px; }
            .customer-row .value { color: #4b5563; word-break: break-word; }
            
            /* Items */
            .section-title { font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: 600; margin-bottom: 8px; }
            .items-list { margin-bottom: 20px; border-top: 1px solid #f3f4f6; padding-top: 16px; }
            .item-row { display: flex; gap: 12px; margin-bottom: 12px; align-items: center; }
            .item-image { width: 48px; height: 48px; border-radius: 8px; background: #f3f4f6; overflow: hidden; flex-shrink: 0; border: 1px solid #e5e7eb; }
            .item-image img { width: 100%; height: 100%; object-fit: cover; }
            .item-image .no-img { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 8px; }
            .item-details { flex: 1; min-width: 0; }
            .item-name { font-weight: 500; font-size: 12px; color: #111827; }
            .item-variant { font-size: 10px; color: #6b7280; }
            .item-totals { text-align: right; }
            .item-qty { font-family: monospace; font-size: 12px; color: #111827; }
            .item-price { font-size: 10px; color: #6b7280; }
            
            /* Totals */
            .totals-section { border-top: 1px solid #f3f4f6; padding-top: 16px; margin-bottom: 24px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
            .total-row.final { font-weight: 700; font-size: 14px; border-top: 1px solid #f3f4f6; padding-top: 12px; margin-top: 12px; }
            
            /* Barcode */
            .barcode-container { text-align: center; margin-top: 24px; }
            .barcode-lines { height: 48px; display: flex; justify-content: center; gap: 3px; overflow: hidden; opacity: 0.8; margin-bottom: 4px; }
            .barcode-lines .bar { background: black; }
            .barcode-text { display: flex; justify-content: space-between; padding: 0 16px; font-family: monospace; font-size: 10px; color: #9ca3af; letter-spacing: 2px; }
            
            @media print {
              body { background-color: white; padding: 0; display: block; }
              .container {
                width: 100%;
                max-width: 380px;
                margin: 0 auto;
                border: 1px solid #e5e7eb;
                border-radius: 24px;
                padding: 20px;
                box-shadow: none;
              }
              .dashed-line::before,
              .dashed-line::after {
                background: white;
              }
              @page { 
                margin: 1cm;
                size: auto; 
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo" />` : ''}
              <div class="ticket-label">TICKET ID</div>
              <div class="ticket-value">${sale.id}</div>
              <div class="ticket-label" style="margin-top: 16px;">DATE & TIME</div>
              <div class="date-row">
                <span>${new Date(`${sale.date}T${sale.time}`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}</span>
                <span class="dot"></span>
                <span>${sale.time}</span>
              </div>
              ${sale.seller ? `
                 <div class="ticket-label" style="margin-top: 12px;">Vendedor</div>
                 <div style="font-weight:500;">${sale.seller}</div>
              ` : ''}
            </div>

            <div class="dashed-line"></div>

            ${customerHtml}

            <div class="section-title">Products</div>
            <div class="items-list">
                ${itemsHtml}
            </div>

            <div class="totals-section">
               <div class="total-row">
                   <span style="color: #6b7280;">Subtotal</span>
                   <span style="font-weight: 500;">${formatNumber(sale.subtotal)}</span>
               </div>
               ${sale.discount ? `
               <div class="total-row">
                   <span style="color: #6b7280;">Descuento</span>
                   <span style="font-weight: 500; color: #dc2626;">-${formatNumber(sale.discount.amount)}</span>
               </div>
               ` : ''}
               <div class="total-row final">
                   <span>Total</span>
                   <span>${formatNumber(sale.totalPaid)}</span>
               </div>
            </div>

            ${barcodeHtml}
            
            <div style="text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px dashed #d1d5db;">
               <h3 style="font-size: 12px; font-weight: 700; color: #111827; margin-bottom: 8px; letter-spacing: 0.5px;">DWELL ROPA DEPORTIVA</h3>
               <p style="font-size: 9px; color: #4b5563; line-height: 1.4; margin-bottom: 8px; max-width: 320px; margin-left: auto; margin-right: auto;">
                  Somos una empresa Santandereana especializada en ropa deportiva premium y de alto rendimiento, fabricada con las mejores textiles del mercado y con la mejor calidad garantizada.
               </p>
               <div style="margin-bottom: 12px; font-size: 8px; color: #6b7280;">
                  <a href="https://dwellcol.com" style="color: #6b7280; text-decoration: none;">dwellcol.com</a>
               </div>
               <div style="font-size: 9px; color: #9ca3af; margin-top: 12px;">
                  <p style="margin-bottom: 4px;">Gracias por su compra</p>
                  <p style="margin-bottom: 4px;">Este documento es válido como comprobante de pago</p>
                  <p style="margin-top: 4px; font-size: 8px; color: #6b7280;">Cambios solo por talla, no devolución de dinero. Garantía de dos meses por prenda</p>
               </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                // window.close(); // Optional: close after print
              }, 500);
            }
          </script>
        </body>
        </html>
      `)
      w.document.close()
    } catch (error) {
      console.error('Error printing invoice:', error)
    }
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
      className={`min-h-screen h-full overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 transition-opacity duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      } ${getFontSizeClass()}`} 
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <div className="p-3 sm:p-4 lg:p-6 min-h-full">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6 lg:mb-8">
          <div className="bg-white rounded-xl sm:rounded-2xl px-3 sm:px-4 lg:px-5 py-4 sm:py-5 lg:py-6 border border-gray-200">
            <p className="text-[9px] sm:text-[11px] text-gray-600 font-semibold tracking-wide leading-tight">Ingresos totales</p>
            <p className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-black mt-1 leading-none">${` ${formatNumber(totalRevenue)}`}</p>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl px-3 sm:px-4 lg:px-5 py-4 sm:py-5 lg:py-6 border border-gray-200">
            <p className="text-[9px] sm:text-[11px] text-gray-600 font-semibold tracking-wide leading-tight">Descuentos</p>
            <p className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-black mt-1 leading-none">${` ${formatNumber(totalDiscounts)}`}</p>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl px-3 sm:px-4 lg:px-5 py-4 sm:py-5 lg:py-6 border border-gray-200">
            <p className="text-[9px] sm:text-[11px] text-gray-600 font-semibold tracking-wide leading-tight">Ticket promedio</p>
            <p className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-black mt-1 leading-none">${` ${formatNumber2(averageTicket)}`}</p>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl px-3 sm:px-4 lg:px-5 py-4 sm:py-5 lg:py-6 border border-gray-200">
            <p className="text-[9px] sm:text-[11px] text-gray-600 font-semibold tracking-wide leading-tight">Ventas</p>
            <p className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-black mt-1 leading-none">{filteredSales.length}</p>
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
                <button onClick={() => {/* Buscar aplica por estado actual */}} className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded bg-black hover:bg-gray-800 text-white text-[10px] sm:text-xs font-bold transition-colors">Buscar</button>
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
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto flex-1 overflow-y-auto kitchen-scrollbar" style={{ maxHeight: '60vh' }}>
            <table className="w-full min-w-[980px] table-fixed">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Fecha/Hora</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Folio</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Vendedor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Cliente</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">Productos</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Método</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSales.map((sale, index) => {
                  const productsCount = sale.items.reduce((c,i)=>c+i.quantity,0)
                  const isAdmin = user?.role === 'admin'
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors duration-150 animate-slideInUp" style={{ animationDelay: `${(index * 50) + 600}ms` }}>
                      <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <div className="text-sm text-gray-900">{sale.date}</div>
                        <div className="text-xs text-gray-500">{sale.time}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <div className="text-sm font-semibold text-gray-900" title={sale.id}>{sale.id.slice(0, 10)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <div className="text-sm text-gray-900" title={sale.seller}>{getFirstName(sale.seller)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <div className="text-sm text-gray-900" title={sale.customer?.name || 'Anónimo'}>{getFirstName(sale.customer?.name) || 'Anónimo'}</div>
                      </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <div className="text-sm text-gray-900">{productsCount}</div>
                    </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <div className="text-sm font-bold text-green-600 break-all leading-tight">{formatNumber(sale.totalPaid)}</div>
                    </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getPaymentMethodColor(sale.paymentMethod)}`}>
                          <span className="mr-1">{getPaymentMethodIcon(sale.paymentMethod)}</span>
                          {getPaymentMethodName(sale.paymentMethod)}
                        </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openSaleDetail(sale)} className="text-gray-700 underline text-xs">Ver detalle</button>
                          <button onClick={() => printInvoice(sale)} className="text-blue-600 underline text-xs">Ver PDF</button>
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
                        <span className="text-gray-800" title={sale.seller}>{getFirstName(sale.seller)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Cliente: </span>
                        <span className="text-gray-800 truncate block" title={sale.customer?.name || 'Anónimo'}>{getFirstName(sale.customer?.name) || 'Anónimo'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Productos: </span>
                        <span className="text-gray-800">{productsCount}</span>
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

      {/* Modal Detalle de Venta - Ticket Style */}
      {isDetailOpen && selectedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-0 transition-all duration-300" onClick={closeSaleDetail}></div>
          
          <div className="absolute inset-0 flex items-center justify-center p-4 z-10 pointer-events-none min-h-full overflow-x-hidden">
            <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden flex flex-col relative pointer-events-auto max-h-[90vh] my-4 overflow-x-hidden">
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {/* Ticket Info Header */}
              <div className="pt-8 pb-4 px-8 flex flex-col space-y-4">
                  {/* Logo */}
                  {logoBase64 && (
                      <div className="flex justify-center mb-4">
                          <img 
                              src={logoBase64} 
                              alt="Logo" 
                              className="h-16 object-contain max-w-full"
                          />
                      </div>
                  )}
                  
                  {/* Ticket ID */}
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">TICKET ID</span>
                      <span className="text-sm font-bold text-gray-900 font-mono">{selectedSale.id}</span>
                  </div>

                  {/* Date & Time */}
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">DATE & TIME</span>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <span>{new Date(`${selectedSale.date}T${selectedSale.time}`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          <span>{selectedSale.time}</span>
                      </div>
                  </div>

                  {/* Seller info */}
                  {selectedSale.seller && (
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Vendedor</span>
                        <span className="text-sm font-medium text-gray-900">{selectedSale.seller}</span>
                    </div>
                  )}
              </div>

              {/* Dashed Divider */}
              <div className="relative w-full h-px my-2">
                <div className="absolute inset-0 border-t-2 border-dashed border-gray-200"></div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-gray-900 rounded-full"></div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 bg-gray-900 rounded-full"></div>
              </div>

              {/* Ticket Details */}
              <div className="px-8 py-6 space-y-6">

                   {/* Customer Info */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="text-sm font-bold text-gray-900 mb-2">{selectedSale.customer?.name || 'Cliente General'}</div>
                      <div className="space-y-1.5">
                          {selectedSale.customer?.phone && (
                              <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Tel:</span>
                                  <span className="text-xs text-gray-600 break-words">{selectedSale.customer.phone}</span>
                              </div>
                          )}
                          {!selectedSale.customer?.phone && (
                              <span className="text-xs text-gray-400">Sin datos adicionales</span>
                          )}
                      </div>
                  </div>

                   {/* Products Summary */}
                  <div className="border-t border-gray-100 pt-4">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2 block">Products</span>
                      <div className="space-y-2">
                           {selectedSale.items.map((item, idx) => (
                              <div key={item.id || idx} className="flex items-center gap-3">
                                  {/* Product Image */}
                                  <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden">
                                      {item.image ? (
                                          <img 
                                              src={item.image} 
                                              alt={item.name}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none'
                                              }}
                                          />
                                      ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                              <span className="text-gray-400 text-[8px]">IMG</span>
                                          </div>
                                      )}
                                  </div>
                                  {/* Product Name and Quantity */}
                                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                          <div className="text-xs text-gray-900 font-medium">{item.name}</div>
                                          {item.variant && (
                                              <div className="text-[10px] text-gray-500">{item.variant}</div>
                                          )}
                                      </div>
                                      <div className="text-right">
                                         <div className="text-xs font-mono text-gray-900 whitespace-nowrap">x{item.quantity}</div>
                                         <div className="text-[10px] text-gray-500">{formatNumber(item.unitPrice * item.quantity)}</div>
                                      </div>
                                  </div>
                              </div>
                           ))}
                      </div>
                  </div>
                  
                  {/* Totals */}
                  <div className="border-t border-gray-100 pt-4 space-y-2">
                      <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="font-medium text-gray-900">{formatNumber(selectedSale.subtotal)}</span>
                      </div>
                      {selectedSale.discount && (
                          <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Descuento</span>
                              <span className="font-medium text-red-600">-{formatNumber(selectedSale.discount.amount)}</span>
                          </div>
                      )}
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                          <span className="text-gray-900">Total</span>
                          <span className="text-gray-900">{formatNumber(selectedSale.totalPaid)}</span>
                      </div>
                  </div>
              </div>
              
              {/* Barcode */}
              <div className="pb-4 px-8 flex flex-col items-center">
                  <div className="h-12 w-full flex justify-center items-stretch gap-[3px] opacity-80 overflow-hidden">
                     {Array.from({ length: 45 }).map((_, i) => (
                       <div key={i} className="bg-black flex-shrink-0" style={{ width: Math.random() > 0.6 ? '3px' : '1px' }}></div>
                     ))}
                  </div>
                   <div className="flex justify-between w-full text-[10px] font-mono text-gray-400 mt-1 px-4 tracking-widest">
                      <span>{selectedSale.id.slice(0, 4)}</span>
                      <span>{selectedSale.id.slice(-4)}</span>
                   </div>
              </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                  {user?.role === 'admin' && (
                    <button 
                        onClick={() => setIsReturnOpen(true)}
                        className="flex-1 py-2.5 text-white font-bold text-xs rounded-xl bg-amber-500 hover:bg-amber-600 flex items-center justify-center gap-2 transition-colors"
                    >
                        Devolución
                    </button>
                  )}
                  <button 
                      onClick={closeSaleDetail}
                      className="flex-1 py-2.5 text-gray-600 font-medium text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                      Cerrar
                  </button>
              </div>

              {/* Close Button absolute top right */}
              <button 
                  onClick={closeSaleDetail}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
              >
                  <XIcon size={20} />
              </button>
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