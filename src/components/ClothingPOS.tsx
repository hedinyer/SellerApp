import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfig } from '../contexts/ConfigContext'
import { supabase, type GarmentRecord } from '../lib/supabaseClient'
import {
  SearchIcon,
  FilterIcon,
  ShoppingCartIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  DollarSignIcon,
  UserIcon,
  XIcon,
  HistoryIcon,
  SaveIcon
} from './icons'

type InventoryStatus = 'activo' | 'inactivo'

interface VariantStock {
  color: string
  size: string
  qty: number
}

interface GarmentItem {
  id: string
  name: string
  sku: string
  category: string
  price: number
  status: InventoryStatus
  imageUrl?: string
  variants?: VariantStock[]
}

interface CartLine {
  id: string
  itemId: string
  name: string
  sku: string
  variantLabel?: string
  unitPrice: number
  quantity: number
  imageUrl?: string
}

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'voucher' | 'store-credit'

interface PaymentPart {
  method: PaymentMethod
  amount: number
}

interface CustomerRef {
  id?: string
  name?: string
  phone?: string
  email?: string
  cedula?: string
}

interface SaleRecord {
  id: string
  at: string
  total: number
  discount: number
  subtotal: number
  items: CartLine[]
  payments: PaymentPart[]
  customer?: CustomerRef
  seller?: string
}

type DbSaleRow = {
  id: string
  created_at: string
  subtotal: number
  discount: number
  total: number
  items: CartLine[]
  payments: PaymentPart[]
  customer: CustomerRef | null
  seller: string | null
}

const categories = ['Vestidos', 'Jeans', 'Camisas', 'Playeras', 'Sudaderas', 'Chamarras', 'Faldas', 'Accesorios']

const INVENTORY_KEY = 'clothing-pos-inventory'
const SALES_KEY = 'clothing-pos-sales'

function loadInventory(): GarmentItem[] {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveInventory(items: GarmentItem[]) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(items))
}

function loadSales(): SaleRecord[] {
  try {
    const raw = localStorage.getItem(SALES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveSales(sales: SaleRecord[]) {
  localStorage.setItem(SALES_KEY, JSON.stringify(sales))
}

export function ClothingPOS() {
  const { getFontSizeClass } = useConfig()
  const inputRef = useRef<HTMLInputElement>(null)

  

  const [inventory, setInventory] = useState<GarmentItem[]>(loadInventory())
  const [sales, setSales] = useState<SaleRecord[]>(loadSales())

  const [query, setQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [onlyInStock, setOnlyInStock] = useState<boolean>(true)
  const [onlyPromotions, setOnlyPromotions] = useState<boolean>(false)

  const [cart, setCart] = useState<CartLine[]>([])
  const [discountPct, setDiscountPct] = useState<number>(0)
  const [couponCode, setCouponCode] = useState<string>('')

  const [variantPicker, setVariantPicker] = useState<{ item: GarmentItem } | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<{ color: string; size: string } | null>(null)

  const [showCheckout, setShowCheckout] = useState(false)
  const [customer, setCustomer] = useState<CustomerRef>({})
  const [paymentParts, setPaymentParts] = useState<PaymentPart[]>([])
  const [detailSale, setDetailSale] = useState<SaleRecord | null>(null)
  const [isScanOpen, setIsScanOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerRef = useRef<any>(null)

  const fontClass = getFontSizeClass()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load garments from database and group variants by SKU
  useEffect(() => {
    async function loadFromDb() {
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .order('created_at', { ascending: false })
      if (error || !data) return

      const items: GarmentItem[] = (data as unknown as GarmentRecord[]).map(g => ({
        id: g.id,
        name: g.name,
        sku: g.sku,
        category: g.category,
        price: Number(g.price) || 0,
        status: (g.status === 'inactivo' ? 'inactivo' : 'activo'),
        imageUrl: g.image_url || undefined,
        variants: [{ color: g.color, size: g.size, qty: g.qty }]
      }))
      setInventory(items)
      try { localStorage.setItem(INVENTORY_KEY, JSON.stringify(items)) } catch {}
    }
    loadFromDb()
  }, [])

  useEffect(() => {
    saveInventory(inventory)
  }, [inventory])

  useEffect(() => {
    saveSales(sales)
  }, [sales])

  // Load recent sales from Supabase
  useEffect(() => {
    async function fetchRecentSales() {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error || !data) return
      const mapped: SaleRecord[] = (data as unknown as DbSaleRow[]).map(r => ({
        id: r.id,
        at: r.created_at,
        subtotal: Number(r.subtotal) || 0,
        discount: Number(r.discount) || 0,
        total: Number(r.total) || 0,
        items: r.items || [],
        payments: r.payments || [],
        customer: r.customer || undefined,
        seller: r.seller || undefined
      }))
      setSales(mapped)
      try { localStorage.setItem(SALES_KEY, JSON.stringify(mapped)) } catch {}
    }
    fetchRecentSales()
  }, [])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inventory.filter(it => {
      if (filterCategory && it.category !== filterCategory) return false
      if (onlyInStock && (it.variants?.every(v => v.qty <= 0))) return false
      if (onlyPromotions) return false // placeholder for future promos
      if (!q) return true
      const matchesText = [it.name, it.sku, it.category]
        .concat((it.variants || []).flatMap(v => [v.color, v.size]))
        .some(x => (x || '').toLowerCase().includes(q))
      return matchesText
    })
  }, [inventory, query, filterCategory, onlyInStock, onlyPromotions])

  const subtotal = useMemo(() => cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0), [cart])
  const pct = Math.max(0, Math.min(100, Number(discountPct) || 0))
  const discountTotal = Math.min(subtotal, Math.round((subtotal * (pct / 100)) * 100) / 100)
  const totalToPay = Math.max(0, subtotal - discountTotal)

  function addToCartFromItem(item: GarmentItem) {
    if (item.variants && item.variants.length > 0) {
      setVariantPicker({ item })
      setSelectedVariant(null)
      return
    }
    const line: CartLine = {
      id: `${item.id}`,
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      unitPrice: item.price,
      quantity: 1,
      imageUrl: item.imageUrl
    }
    upsertCart(line)
  }

  function upsertCart(line: CartLine) {
    setCart(prev => {
      const idx = prev.findIndex(l => l.id === line.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + line.quantity }
        return copy
      }
      return [...prev, line]
    })
  }

  function confirmVariantAdd() {
    if (!variantPicker || !selectedVariant) return
    const item = variantPicker.item
    const stock = item.variants?.find(v => v.color === selectedVariant.color && v.size === selectedVariant.size)?.qty || 0
    if (stock <= 0) return
    const line: CartLine = {
      id: `${item.id}-${selectedVariant.color}-${selectedVariant.size}`,
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      unitPrice: item.price,
      quantity: 1,
      imageUrl: item.imageUrl,
      variantLabel: `${selectedVariant.color} / ${selectedVariant.size}`
    }
    upsertCart(line)
    setVariantPicker(null)
    setSelectedVariant(null)
  }

  function changeQty(lineId: string, delta: number) {
    setCart(prev => prev.map(l => l.id === lineId ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l))
  }

  function removeLine(lineId: string) {
    setCart(prev => prev.filter(l => l.id !== lineId))
  }

  function clearCart() {
    setCart([])
    setDiscountPct(0)
    setCouponCode('')
  }

  function applyCoupon() {
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    if (code === 'PROMO10') {
      setDiscountPct(10)
    } else if (code === 'DESC100') {
      if (subtotal > 0) {
        const pctFromAmount = Math.min(100, (100 / subtotal) * 100)
        setDiscountPct(Math.round(pctFromAmount * 100) / 100)
      }
    }
  }

  function openCheckout() {
    // Validate stock in real-time before checkout
    for (const l of cart) {
      const item = inventory.find(it => it.id === l.itemId)
      if (!item) continue
      if (item.variants && l.variantLabel) {
        const [color, size] = l.variantLabel.split(' / ')
        const vs = item.variants.find(v => v.color === color && v.size === size)
        if (!vs || vs.qty < l.quantity) {
          alert(`¡Atención! La variante ${l.variantLabel} de ${item.name} ya no tiene stock suficiente.`)
          return
        }
      }
    }
    setShowCheckout(true)
    setPaymentParts(totalToPay > 0 ? [{ method: 'cash', amount: totalToPay }] : [])
  }

  async function openCameraScan() {
    try {
      setIsScanOpen(true)
      await new Promise(r => setTimeout(r, 50))
      // @ts-ignore - Allow dynamic CDN import in browser
      const { default: QrScanner } = await import('https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner.min.js')
      ;(QrScanner as any).WORKER_PATH = 'https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner-worker.min.js'
      if (!videoRef.current) return
      const scanner = new (QrScanner as any)(
        videoRef.current,
        (res: any) => {
          const value = typeof res === 'string' ? res : (res?.data || '').trim()
          if (value) handleScanResult(value)
        },
        {
          preferredCamera: 'environment',
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true
        }
      )
      scannerRef.current = scanner
      await scanner.start()
    } catch (_) {
      setIsScanOpen(false)
    }
  }

  function handleScanResult(value: string) {
    const sku = value.trim()
    if (!sku) return
    const found = inventory.find(it => it.sku.toLowerCase() === sku.toLowerCase())
    if (found) addToCartFromItem(found)
    closeCameraScan()
  }

  function closeCameraScan() {
    try {
      if (scannerRef.current) {
        scannerRef.current.stop()
        if (scannerRef.current.destroy) scannerRef.current.destroy()
        scannerRef.current = null
      }
    } finally {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.srcObject = null
      }
      setIsScanOpen(false)
    }
  }

  function formatNumberWithSeparators(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  function parseFormattedNumber(value: string): number {
    const cleanValue = value.replace(/,/g, '')
    const parsed = parseFloat(cleanValue)
    return isNaN(parsed) ? 0 : Math.max(0, parsed)
  }

  function totalPayments(parts: PaymentPart[]) {
    return parts.reduce((s, p) => s + (p.amount || 0), 0)
  }

  function addPaymentPart() {
    setPaymentParts(prev => [...prev, { method: 'cash', amount: Math.max(0, totalToPay - totalPayments(prev)) }])
  }

  function updatePayment(index: number, patch: Partial<PaymentPart>) {
    setPaymentParts(prev => prev.map((p, i) => i === index ? { ...p, ...patch } : p))
  }

  function handlePaymentAmountChange(index: number, value: string) {
    const amount = parseFormattedNumber(value)
    updatePayment(index, { amount })
  }

  function removePayment(index: number) {
    setPaymentParts(prev => prev.filter((_, i) => i !== index))
  }

  function finalizeSale() {
    // Final stock validation and deduction
    const updated = [...inventory]
    for (const l of cart) {
      const itemIdx = updated.findIndex(it => it.id === l.itemId)
      if (itemIdx < 0) continue
      const item = updated[itemIdx]
      if (item.variants && l.variantLabel) {
        const [color, size] = l.variantLabel.split(' / ')
        const vIdx = item.variants.findIndex(v => v.color === color && v.size === size)
        if (vIdx < 0 || item.variants[vIdx].qty < l.quantity) {
          alert(`¡Atención! La variante ${l.variantLabel} de ${item.name} ya no está disponible.`)
          return
        }
        item.variants[vIdx] = { ...item.variants[vIdx], qty: item.variants[vIdx].qty - l.quantity }
        updated[itemIdx] = { ...item }
      }
    }

    // Validate mandatory customer fields (except email)
    if (!customer.name || !customer.phone || !customer.cedula) {
      alert('Por favor completa nombre, teléfono y cédula del cliente.')
      return
    }

    const paySum = totalPayments(paymentParts)
    if (Math.round(paySum * 100) !== Math.round(totalToPay * 100)) {
      alert('El total de pagos no coincide con el total a pagar.')
      return
    }

    const saleToInsert = {
      subtotal,
      discount: discountTotal,
      total: totalToPay,
      items: cart,
      payments: paymentParts,
      customer: customer,
      seller: 'Vendedor'
    }

    ;(async () => {
      const { data, error } = await supabase
        .from('sales')
        .insert([saleToInsert])
        .select('*')
        .single()
      if (error || !data) {
        alert('No se pudo registrar la venta. Intenta de nuevo.')
        return
      }
      const r = data as unknown as DbSaleRow
      const sale: SaleRecord = {
        id: r.id,
        at: r.created_at,
        subtotal: Number(r.subtotal) || 0,
        discount: Number(r.discount) || 0,
        total: Number(r.total) || 0,
        items: r.items || [],
        payments: r.payments || [],
        customer: r.customer || undefined,
        seller: r.seller || undefined
      }

      setInventory(updated)
      setSales(prev => [sale, ...prev].slice(0, 50))
      setShowCheckout(false)
      printTicket(sale)
      clearCart()
    })()
  }

  function printTicket(sale: SaleRecord) {
    try {
      const w = window.open('', '_blank')
      if (!w) return
      const lines = sale.items.map(l => `${l.name} ${l.variantLabel ? '(' + l.variantLabel + ')' : ''} x${l.quantity} - ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(l.unitPrice * l.quantity)}`).join('<br/>')
      w.document.write(`
        <div style="font-family: Arial; padding:16px">
          <h3 style="margin:0 0 12px 0">Ticket de venta</h3>
          <div>${new Date(sale.at).toLocaleString()}</div>
          <hr/>
          <div>${lines}</div>
          <hr/>
          <div>Subtotal: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.subtotal)}</div>
          <div>Descuento: -${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.discount)}</div>
          <div style="font-weight:700">Total: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.total)}</div>
        </div>
      `)
      w.print()
      w.close()
    } catch {}
  }

  return (
    <div className={`p-4 ${fontClass} text-black min-h-screen`}>
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-black mb-2 tracking-tight">
          Ventas Dwell
        </h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Search and Results */}
        <div className="col-span-12 md:col-span-7">
          <div className="bg-white rounded-lg shadow p-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white rounded px-2">
                <SearchIcon size={18} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, SKU, color, talla..."
                  className="w-full bg-transparent py-2 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border rounded px-2 py-2 bg-white text-black">
                  <option value="">Todas</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button className="flex items-center gap-1 px-2 py-2 border rounded" onClick={openCameraScan}>
                  Escanear QR
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3">
            {filteredItems.length === 0 && (
              <div className="text-black text-sm">Sin resultados</div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map(item => (
                <button key={item.id} className="text-left border rounded-lg overflow-hidden hover:shadow group" onClick={() => addToCartFromItem(item)}>
                  <div className="h-28 bg-gray-100 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="max-h-28" />
                    ) : (
                      <div className="text-black">IMG</div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs text-black">{item.sku}</div>
                    <div className="text-sm font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(item.price)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Cart */}
        <div className="col-span-12 md:col-span-5">
          <div className="bg-white rounded-lg shadow p-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-semibold"><ShoppingCartIcon size={18} /> Carrito</div>
              <button className="text-red-600 flex items-center gap-1" title="Limpiar carrito" onClick={clearCart}><TrashIcon size={16} /> Limpiar</button>
            </div>

            <div className="flex-1 overflow-auto">
              {cart.length === 0 && (
                <div className="text-black text-sm">No hay productos en el carrito</div>
              )}
              <div className="space-y-2">
                {cart.map(line => (
                  <div key={line.id} className="flex items-center gap-2 border rounded p-2">
                    <div className="w-12 h-12 bg-gray-100 flex items-center justify-center">{line.imageUrl ? <img src={line.imageUrl} className="max-h-12"/> : 'IMG'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{line.name}</div>
                      <div className="text-xs text-black">{line.variantLabel || line.sku}</div>
                    </div>
                    <div className="text-sm w-24 text-right">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(line.unitPrice)}</div>
                    <div className="flex items-center gap-1">
                      <button className="border rounded p-1" onClick={() => changeQty(line.id, -1)}><MinusIcon size={14} /></button>
                      <div className="w-8 text-center">{line.quantity}</div>
                      <button className="border rounded p-1" onClick={() => changeQty(line.id, 1)}><PlusIcon size={14} /></button>
                    </div>
                    <div className="w-24 text-right font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(line.unitPrice * line.quantity)}</div>
                    <button className="text-red-600" onClick={() => removeLine(line.id)}><XIcon size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Discounts */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="col-span-1">
                <label className="text-xs text-black">Descuento %</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={String(discountPct)} 
                  onChange={e => {
                    const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '')
                    const num = Number(raw)
                    if (isNaN(num)) setDiscountPct(0)
                    else setDiscountPct(Math.max(0, Math.min(100, num)))
                  }} 
                  placeholder="0"
                  className="w-full border rounded px-2 py-1 bg-white text-black" 
                />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-black">Cupón</label>
                <div className="flex gap-1">
                  <input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="PROMO10" className="flex-1 border rounded px-2 py-1 bg-white text-black"/>
                  <button className="border rounded px-2" onClick={applyCoupon}>Aplicar</button>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="mt-4 border-t pt-3">
              <div className="flex justify-between text-sm text-black"><span>Productos</span><span>{cart.reduce((a, l) => a + l.quantity, 0)}</span></div>
              <div className="flex justify-between text-sm text-black"><span>Subtotal</span><span>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(subtotal)}</span></div>
              <div className="flex justify-between text-sm text-black"><span>Descuentos</span><span>-{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(discountTotal)}</span></div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-base font-semibold">Total</span>
                <span className="text-2xl font-bold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalToPay)}</span>
              </div>
              <button disabled={cart.length === 0} onClick={openCheckout} className={`w-full mt-3 py-2 rounded border border-black text-black flex items-center justify-center gap-2 ${cart.length === 0 ? 'bg-gray-300' : 'bg-gray-200 hover:bg-gray-300'}`}>
                <DollarSignIcon size={18} /> Cobrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sales history panel */}
      <div className="mt-4 bg-white rounded-lg shadow p-3 overflow-x-auto">
        <div className="flex items-center gap-2 font-semibold mb-2"><HistoryIcon size={18} /> Ventas recientes</div>
            <div className="grid grid-cols-6 text-xs font-medium text-black border-b pb-1 min-w-[560px]">
          <div>Hora</div><div>Folio</div><div>Total</div><div>Método</div><div>Cliente</div><div>Acciones</div>
        </div>
        {sales.slice(0, 20).map(s => (
          <div key={s.id} className="grid grid-cols-6 py-1 text-sm items-center border-b last:border-b-0 min-w-[560px]">
            <div>{new Date(s.at).toLocaleTimeString()}</div>
            <div>{s.id}</div>
            <div className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(s.total)}</div>
            <div>{s.payments.map(p => p.method).join(' + ')}</div>
                <div>{s.customer?.name || '—'}</div>
            <div className="flex gap-2">
              <button className="text-gray-700 underline" onClick={() => setDetailSale(s)}>Ver detalle</button>
              {/* Placeholder for annul with authorization window */}
            </div>
          </div>
        ))}
      </div>

      {/* Variant selector modal */}
      {variantPicker && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Seleccionar variante</div>
              <button onClick={() => setVariantPicker(null)}><XIcon size={18} /></button>
            </div>
            <div className="text-sm mb-2">{variantPicker.item.name} • {variantPicker.item.sku}</div>
            {/* Colors */}
            <div className="mb-2">
              <div className="text-xs text-black mb-1">Color</div>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set((variantPicker.item.variants || []).map(v => v.color))).map(color => (
                  <button key={color} onClick={() => setSelectedVariant(v => ({ color, size: v?.size || '' }))} className={`px-2 py-1 border rounded ${selectedVariant?.color === color ? 'bg-black text-white' : ''}`}>{color}</button>
                ))}
              </div>
            </div>
            {/* Sizes */}
            <div className="mb-2">
              <div className="text-xs text-black mb-1">Talla</div>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set((variantPicker.item.variants || []).filter(v => !selectedVariant?.color || v.color === selectedVariant.color).map(v => v.size))).map(size => {
                  const stock = (variantPicker.item.variants || []).find(v => v.size === size && (!selectedVariant?.color || v.color === selectedVariant.color))?.qty || 0
                  const disabled = stock <= 0
                  return (
                    <button key={size} disabled={disabled} onClick={() => setSelectedVariant(v => ({ color: v?.color || (variantPicker.item.variants?.[0]?.color || ''), size }))} className={`px-2 py-1 border rounded ${selectedVariant?.size === size ? 'bg-black text-white' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      {size} ({stock})
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-2 border rounded" onClick={() => setVariantPicker(null)}>Cancelar</button>
              <button className="px-3 py-2 border border-black bg-gray-200 hover:bg-gray-300 text-black rounded" onClick={confirmVariantAdd}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-3xl mx-3 p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <div className="font-semibold flex items-center gap-2 text-black"><DollarSignIcon size={18} /> Finalizar venta</div>
              <button onClick={() => setShowCheckout(false)} className="text-gray-700 hover:text-black"><XIcon size={18} /></button>
            </div>
            <div className="space-y-3">
              {/* Cliente (Fila 1) */}
              <div className="border rounded p-2">
                <div className="text-sm font-medium mb-2 flex items-center gap-2"><UserIcon size={16} /> Cliente</div>
                <div className="flex items-center gap-2 mb-2">
                  <input value={customer.name || ''} onChange={e => setCustomer(prev => ({ ...prev, name: e.target.value }))} placeholder="Nombre" className="flex-1 border rounded px-2 py-1 bg-white text-black" />
                  <input value={customer.phone || ''} onChange={e => setCustomer(prev => ({ ...prev, phone: e.target.value }))} placeholder="Teléfono" className="w-40 border rounded px-2 py-1 bg-white text-black" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input value={customer.email || ''} onChange={e => setCustomer(prev => ({ ...prev, email: e.target.value }))} placeholder="Correo (opcional)" className="flex-1 border rounded px-2 py-1 bg-white text-black" />
                  <input value={customer.cedula || ''} onChange={e => setCustomer(prev => ({ ...prev, cedula: e.target.value }))} placeholder="Cédula" className="w-40 border rounded px-2 py-1 bg-white text-black" />
                </div>
              </div>

              {/* Pago (Fila 2) */}
              <div className="border rounded p-2">
                <div className="text-sm font-medium mb-2 flex items-center gap-2"><DollarSignIcon size={16} /> Pago</div>
                <div className="space-y-2">
                  {paymentParts.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={p.method} onChange={e => updatePayment(i, { method: e.target.value as PaymentMethod })} className="border rounded px-2 py-1 bg-white text-black">
                        <option value="cash">Efectivo</option>
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transferencia</option>
                        <option value="voucher">Vale</option>
                        <option value="store-credit">Crédito interno</option>
                      </select>
                      <input 
                        type="text" 
                        value={formatNumberWithSeparators(p.amount)} 
                        onChange={e => handlePaymentAmountChange(i, e.target.value)} 
                        placeholder="0" 
                        className="flex-1 border rounded px-2 py-1 bg-white text-black" 
                      />
                      <button className="text-red-600" onClick={() => removePayment(i)}><XIcon size={16} /></button>
                    </div>
                  ))}
                  <button className="border rounded px-2 py-1 text-sm" onClick={addPaymentPart}>Agregar pago</button>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-black">
                  <div>Total a pagar: <span className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalToPay)}</span></div>
                  <div>Pagado: <span className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalPayments(paymentParts))}</span></div>
                  <div>Cambio: <span className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.max(0, totalPayments(paymentParts) - totalToPay))}</span></div>
                </div>
              </div>

              {/* Resumen de la compra (Fila 3) */}
              <div className="border rounded p-2 text-sm">
                <div className="text-sm font-medium mb-2">Resumen de la compra</div>
                <div className="grid grid-cols-4 font-medium text-black border-b pb-1 mb-1"><div>Producto</div><div>Variante</div><div>Cant</div><div>Total</div></div>
                <div className="max-h-56 overflow-auto pr-1">
                  {cart.map(l => (
                    <div key={l.id} className="grid grid-cols-4 py-0.5">
                      <div className="truncate">{l.name}</div>
                      <div className="truncate">{l.variantLabel || '-'}</div>
                      <div>x{l.quantity}</div>
                      <div className="text-right">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(l.unitPrice * l.quantity)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-end gap-6">
                  <div>Desc: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(discountTotal)}</div>
                  <div>Total: <span className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalToPay)}</span></div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:justify-end gap-2">
              <button className="px-3 py-2 border rounded" onClick={() => setShowCheckout(false)}>Cancelar</button>
              <button className="px-3 py-2 border border-black bg-gray-200 hover:bg-gray-300 text-black rounded flex items-center gap-2" onClick={finalizeSale}><SaveIcon size={16}/> Confirmar y registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Sale detail modal */}
      {detailSale && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-3xl mx-3 p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <div className="font-semibold text-black">Detalle de venta</div>
              <button onClick={() => setDetailSale(null)} className="text-gray-700 hover:text-black"><XIcon size={18} /></button>
            </div>
            <div className="space-y-3 text-sm text-black text-left">
              <div className="grid grid-cols-2 gap-2 text-left">
                <div><span className="font-medium">Folio:</span> {detailSale.id}</div>
                <div><span className="font-medium">Fecha:</span> {new Date(detailSale.at).toLocaleString()}</div>
                <div><span className="font-medium">Cliente:</span> {detailSale.customer?.name || '—'}</div>
                <div><span className="font-medium">Teléfono:</span> {detailSale.customer?.phone || '—'}</div>
                <div><span className="font-medium">Correo:</span> {detailSale.customer?.email || '—'}</div>
                <div><span className="font-medium">Cédula:</span> {detailSale.customer?.cedula || '—'}</div>
              </div>
              <div>
                <div className="font-medium mb-1">Productos</div>
                <div className="grid grid-cols-5 font-medium border-b pb-1 text-left"><div>Producto</div><div>Variante</div><div>SKU</div><div>Cant</div><div>Total</div></div>
                <div className="max-h-64 overflow-auto text-left">
                  {detailSale.items.map((l, i) => (
                    <div key={i} className="grid grid-cols-5 py-1 border-b last:border-b-0">
                      <div className="truncate">{l.name}</div>
                      <div className="truncate">{l.variantLabel || '—'}</div>
                      <div className="truncate">{l.sku}</div>
                      <div>{l.quantity}</div>
                      <div>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(l.unitPrice * l.quantity)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium mb-1">Pagos</div>
                <div className="grid grid-cols-2 gap-2 text-left">
                  {detailSale.payments.map((p, i) => (
                    <div key={i} className="grid grid-cols-2 border rounded px-2 py-1">
                      <div>{p.method}</div>
                      <div className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(p.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-left">
                <div><span className="text-black">Subtotal:</span> <span className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(detailSale.subtotal)}</span></div>
                <div><span className="text-black">Descuento:</span> <span className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(detailSale.discount)}</span></div>
                <div><span className="text-black">Total:</span> <span className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(detailSale.total)}</span></div>
              </div>
              <div className="flex justify-start">
                <button className="px-3 py-2 border rounded" onClick={() => setDetailSale(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner modal */}
      {isScanOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-md mx-3 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">Escanear QR</h4>
                <p className="text-xs text-gray-600">Apunta la cámara al código del producto (SKU)</p>
              </div>
              <button onClick={closeCameraScan} className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-50">Cerrar</button>
            </div>
            <div className="relative rounded overflow-hidden border border-gray-200">
              <video ref={videoRef} className="w-full h-64 object-cover bg-black" playsInline muted />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-8 border-2 border-white/70 rounded" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClothingPOS


