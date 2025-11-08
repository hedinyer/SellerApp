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
  id?: string // ID original del garment para esta variante
  sku?: string // SKU original del garment para esta variante
  imageUrl?: string // Imagen del producto para este color
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
  const [allGarments, setAllGarments] = useState<GarmentRecord[]>([]) // Store all original garments for stock updates
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
  const [isProcessingSale, setIsProcessingSale] = useState(false)

  const [showCheckout, setShowCheckout] = useState(false)
  const [customer, setCustomer] = useState<CustomerRef>({})
  const [paymentParts, setPaymentParts] = useState<PaymentPart[]>([])
  const [detailSale, setDetailSale] = useState<SaleRecord | null>(null)
  const [invoiceSale, setInvoiceSale] = useState<SaleRecord | null>(null)
  const [isScanOpen, setIsScanOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerRef = useRef<any>(null)
  const [scanned, setScanned] = useState<{ sku: string, name: string, imageUrl?: string, count: number, color: string, size: string, category: string, id: string, variantLabel?: string }[]>([])
  const lastScannedRef = useRef<{ sku: string, timestamp: number } | null>(null)
  const [lastScanOk, setLastScanOk] = useState<{ sku: string, name: string } | null>(null)
  const [scanCountdown, setScanCountdown] = useState<number>(0)
  const [logoBase64, setLogoBase64] = useState<string>('')
  const [sellers, setSellers] = useState<{ id: string, name: string }[]>([])
  const [selectedSellerId, setSelectedSellerId] = useState<string>('')

  const fontClass = getFontSizeClass()

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

  // Load active sellers from employees (department: Ventas)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, department, status')
        .eq('department', 'Ventas')
        .order('name', { ascending: true })
      if (!mounted) return
      if (!error && data) {
        const list = (data as any[])
          .filter(r => (r.status === 'activo' || !r.status))
          .map(r => ({ id: String(r.id), name: String(r.name || 'Sin nombre') }))
        setSellers(list)
        if (list.length && !selectedSellerId) setSelectedSellerId(list[0].id)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Countdown timer for scanner feedback
  useEffect(() => {
    if (scanCountdown <= 0) return
    const id = setTimeout(() => setScanCountdown(s => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(id)
  }, [scanCountdown])

  // Auto-apply coupon when a valid code is entered
  useEffect(() => {
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    
    // Only auto-apply known coupon codes
    if (code === 'PROMO10') {
      setDiscountPct(10)
    } else if (code === 'DESC100') {
      const currentSubtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
      if (currentSubtotal > 0) {
        const pctFromAmount = Math.min(100, (100 / currentSubtotal) * 100)
        setDiscountPct(Math.round(pctFromAmount * 100) / 100)
      }
    }
  }, [couponCode, cart])

  // Load garments from database and group variants by name
  useEffect(() => {
    async function loadFromDb() {
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .order('created_at', { ascending: false })
      if (error || !data) return

      // Store all original garments
      const allGarmentsData = data as unknown as GarmentRecord[]
      setAllGarments(allGarmentsData)
      
      // Group garments by name
      const groupedMap = new Map<string, GarmentItem>()
      
      allGarmentsData.forEach(g => {
        const name = g.name
        const price = Number(g.price) || 0
        const status = (g.status === 'inactivo' ? 'inactivo' : 'activo')
        
        if (groupedMap.has(name)) {
          // Add variant to existing product
          const existing = groupedMap.get(name)!
          existing.variants = existing.variants || []
          existing.variants.push({ 
            color: g.color, 
            size: g.size, 
            qty: g.qty,
            id: g.id,
            sku: g.sku,
            imageUrl: g.image_url || undefined
          })
          // Use first available image if current doesn't have one
          if (!existing.imageUrl && g.image_url) {
            existing.imageUrl = g.image_url
          }
        } else {
          // Create new grouped product
          groupedMap.set(name, {
            id: g.id, // Use first ID as representative
            name: name,
            sku: g.sku, // Use first SKU as representative
            category: g.category,
            price: price,
            status: status,
            imageUrl: g.image_url || undefined,
            variants: [{ 
              color: g.color, 
              size: g.size, 
              qty: g.qty,
              id: g.id,
              sku: g.sku,
              imageUrl: g.image_url || undefined
            }]
          })
        }
      })
      
      const items: GarmentItem[] = Array.from(groupedMap.values())
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
    // Always show variant picker if there are variants (which there should be after grouping by name)
    if (item.variants && item.variants.length > 0) {
      setVariantPicker({ item })
      setSelectedVariant(null)
      return
    }
    // Fallback for items without variants (shouldn't happen after grouping)
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
    // Obtener stock disponible para esta línea (variante)
    const getAvailableFor = (ln: CartLine): number => {
      // Try to find by variant ID first (for grouped items)
      if (ln.variantLabel) {
        const [color, size] = ln.variantLabel.split(' / ')
        // Search in all grouped items for the matching variant
        for (const item of inventory) {
          const variant = item.variants?.find(v => 
            v.color === color && 
            v.size === size && 
            (v.id === ln.itemId || item.id === ln.itemId)
          )
          if (variant) {
            return Math.max(0, Number(variant.qty || 0))
          }
        }
      }
      // Fallback: find by item ID
      const item = inventory.find(it => it.id === ln.itemId)
      if (!item) return Infinity
      if (item.variants && item.variants.length > 0) {
        return Math.max(0, Number(item.variants[0].qty || 0))
      }
      return Infinity
    }

    setCart(prev => {
      const idx = prev.findIndex(l => l.id === line.id)
      const available = getAvailableFor(line)
      if (idx >= 0) {
        const copy = [...prev]
        const current = copy[idx]
        const targetQty = Math.min(available, current.quantity + line.quantity)
        copy[idx] = { ...current, quantity: Math.max(1, targetQty) }
        return copy
      }
      const initialQty = Math.min(available, line.quantity)
      return [...prev, { ...line, quantity: Math.max(1, initialQty) }]
    })
  }

  function confirmVariantAdd() {
    if (!variantPicker || !selectedVariant) return
    const item = variantPicker.item
    const variant = item.variants?.find(v => v.color === selectedVariant.color && v.size === selectedVariant.size)
    if (!variant || variant.qty <= 0) return
    
    // Use the specific variant ID if available, otherwise use the item ID
    const variantId = variant.id || item.id
    const variantSku = variant.sku || item.sku
    // Use the variant's image if available, otherwise fallback to item image
    const variantImageUrl = variant.imageUrl || item.imageUrl
    
    const line: CartLine = {
      id: `${variantId}-${selectedVariant.color}-${selectedVariant.size}`,
      itemId: variantId, // Use the specific variant ID
      name: item.name,
      sku: variantSku, // Use the specific variant SKU
      unitPrice: item.price,
      quantity: 1,
      imageUrl: variantImageUrl, // Use the variant's image
      variantLabel: `${selectedVariant.color} / ${selectedVariant.size}`
    }
    upsertCart(line)
    setVariantPicker(null)
    setSelectedVariant(null)
  }

  function changeQty(lineId: string, delta: number) {
    setCart(prev => prev.map(l => {
      if (l.id !== lineId) return l
      // Calcular stock disponible para esta línea
      let available = Infinity
      if (l.variantLabel) {
        const [color, size] = l.variantLabel.split(' / ')
        // Search in all grouped items for the matching variant
        for (const item of inventory) {
          const variant = item.variants?.find(v => 
            v.color === color && 
            v.size === size && 
            (v.id === l.itemId || item.id === l.itemId)
          )
          if (variant) {
            available = Math.max(0, Number(variant.qty || 0))
            break
          }
        }
      } else {
        const item = inventory.find(it => it.id === l.itemId)
        if (item && item.variants && item.variants.length > 0) {
          available = Math.max(0, Number(item.variants[0].qty || 0))
        }
      }
      const next = l.quantity + delta
      const capped = Math.min(available, Math.max(1, next))
      return { ...l, quantity: capped }
    }))
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
      if (l.variantLabel) {
        const [color, size] = l.variantLabel.split(' / ')
        // Search in all grouped items for the matching variant
        let found = false
        for (const item of inventory) {
          const variant = item.variants?.find(v => 
            v.color === color && 
            v.size === size && 
            (v.id === l.itemId || item.id === l.itemId)
          )
          if (variant) {
            if (variant.qty < l.quantity) {
              alert(`¡Atención! La variante ${l.variantLabel} de ${item.name} ya no tiene stock suficiente.`)
              return
            }
            found = true
            break
          }
        }
        if (!found) {
          alert(`¡Atención! No se encontró la variante ${l.variantLabel} de ${l.name}.`)
          return
        }
      } else {
        const item = inventory.find(it => it.id === l.itemId)
        if (!item) {
          alert(`¡Atención! No se encontró el producto ${l.name}.`)
          return
        }
      }
    }
    setShowCheckout(true)
    setPaymentParts(totalToPay > 0 ? [{ method: 'cash', amount: totalToPay }] : [])
  }

  async function openCameraScan() {
    try {
      // Reset scanned list and feedback
      setScanned([])
      lastScannedRef.current = null
      setLastScanOk(null)
      setScanCountdown(0)
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
    const trimmedValue = value.trim()
    if (!trimmedValue) return

    // Try to parse JSON from QR code
    let qrData: { sku?: string; category?: string; color?: string; size?: string } | null = null
    let sku = trimmedValue

    try {
      const parsed = JSON.parse(trimmedValue)
      if (parsed && typeof parsed === 'object' && typeof parsed.sku === 'string') {
        qrData = parsed
        sku = parsed.sku
      }
    } catch {
      // If not JSON, treat as raw SKU
      sku = trimmedValue
    }

    if (!sku) return

    const found = inventory.find(it => it.sku.toLowerCase() === sku.toLowerCase())
    if (!found) return

    // Debounce: ignore if same product scanned within 3 seconds
    const now = Date.now()
    const last = lastScannedRef.current
    if (last && last.sku.toLowerCase() === found.sku.toLowerCase() && (now - last.timestamp) < 3000) {
      return
    }

    // Update last scanned
    lastScannedRef.current = { sku: found.sku, timestamp: now }

    // Determine variant info
    let variantLabel: string | undefined = undefined
    let color = found.variants?.[0]?.color || ''
    let size = found.variants?.[0]?.size || ''

    // If QR contains color and size, try to match variant
    if (qrData && qrData.color && qrData.size && found.variants && found.variants.length > 0) {
      const variant = found.variants.find(
        v => v.color.toLowerCase() === qrData.color!.toLowerCase() && 
             v.size.toLowerCase() === qrData.size!.toLowerCase()
      )
      
      if (variant && variant.qty > 0) {
        color = variant.color
        size = variant.size
        variantLabel = `${variant.color} / ${variant.size}`
      }
    } else if (found.variants && found.variants.length > 0) {
      // Use first variant if available
      color = found.variants[0].color
      size = found.variants[0].size
      variantLabel = `${found.variants[0].color} / ${found.variants[0].size}`
    }

    // Create unique ID for scanned item (includes variant if available)
    const scannedId = variantLabel ? `${found.id}-${color}-${size}` : found.id

    // Update scanned list (increment count if exists, or add new)
    setScanned(prev => {
      const idx = prev.findIndex(p => {
        const pId = p.variantLabel ? `${p.id}-${p.color}-${p.size}` : p.id
        return pId === scannedId
      })
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], count: copy[idx].count + 1 }
        return copy
      }
      return [...prev, { 
        sku: found.sku, 
        name: found.name, 
        imageUrl: found.imageUrl, 
        count: 1,
        color: color,
        size: size,
        category: found.category,
        id: found.id,
        variantLabel: variantLabel
      }]
    })

    // Show feedback and start countdown
    setLastScanOk({ sku: found.sku, name: found.name })
    setScanCountdown(3)
  }

  function addScannedToCart() {
    if (scanned.length === 0) return
    
    for (const item of scanned) {
      const found = inventory.find(it => it.id === item.id)
      if (!found) continue

      // Check if product has variants
      if (found.variants && found.variants.length > 0) {
        // If scanned item has variant info, use it
        if (item.variantLabel && item.color && item.size) {
          const variant = found.variants.find(
            v => v.color.toLowerCase() === item.color.toLowerCase() && 
                 v.size.toLowerCase() === item.size.toLowerCase()
          )
          
          if (variant && variant.qty > 0) {
            const lineId = `${found.id}-${variant.color}-${variant.size}`
            // Calcular cuánto se puede agregar respetando el stock y lo que ya hay en el carrito
            const alreadyInCart = cart.find(l => l.id === lineId)?.quantity || 0
            const remaining = Math.max(0, Number(variant.qty || 0) - alreadyInCart)
            const toAdd = Math.min(remaining, item.count)
            if (toAdd > 0) {
              const line: CartLine = {
                id: lineId,
                itemId: found.id,
                name: found.name,
                sku: found.sku,
                unitPrice: found.price,
                quantity: toAdd,
                imageUrl: found.imageUrl,
                variantLabel: `${variant.color} / ${variant.size}`
              }
              upsertCart(line)
            }
          }
        } else {
          // If no variant info, show variant picker for first occurrence
          // For now, skip items without variant info
          continue
        }
      } else {
        // Product without variants, add directly
        const line: CartLine = {
          id: found.id,
          itemId: found.id,
          name: found.name,
          sku: found.sku,
          unitPrice: found.price,
          quantity: item.count,
          imageUrl: found.imageUrl
        }
        upsertCart(line)
      }
    }

    // Clear scanned list and close scanner
    setScanned([])
    setLastScanOk(null)
    setScanCountdown(0)
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
      setLastScanOk(null)
      setScanCountdown(0)
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
    // Prevent double-click
    if (isProcessingSale) return
    
    setIsProcessingSale(true)
    
    // Final stock validation and deduction
    const updated = [...inventory]
    const updatesToDb: { id: string; qty: number }[] = []
    
    for (const l of cart) {
      if (l.variantLabel) {
        const [color, size] = l.variantLabel.split(' / ')
        // Search in all grouped items for the matching variant
        let found = false
        for (let itemIdx = 0; itemIdx < updated.length; itemIdx++) {
          const item = updated[itemIdx]
          const variant = item.variants?.find(v => 
            v.color === color && 
            v.size === size && 
            (v.id === l.itemId || item.id === l.itemId)
          )
          if (variant) {
            if (variant.qty < l.quantity) {
              alert(`¡Atención! La variante ${l.variantLabel} de ${item.name} ya no está disponible.`)
              setIsProcessingSale(false)
              return
            }
            // Update variant stock
            variant.qty = variant.qty - l.quantity
            // Store update for database
            if (variant.id) {
              updatesToDb.push({ id: variant.id, qty: variant.qty })
            }
            updated[itemIdx] = { ...item }
            found = true
            break
          }
        }
        if (!found) {
          alert(`¡Atención! No se encontró la variante ${l.variantLabel} de ${l.name}.`)
          setIsProcessingSale(false)
          return
        }
      } else {
        const itemIdx = updated.findIndex(it => it.id === l.itemId)
        if (itemIdx < 0) {
          alert(`¡Atención! No se encontró el producto ${l.name}.`)
          setIsProcessingSale(false)
          return
        }
        const item = updated[itemIdx]
        if (item.variants && item.variants.length > 0) {
          const variant = item.variants[0]
          if (variant.qty < l.quantity) {
            alert(`¡Atención! El producto ${item.name} ya no tiene stock suficiente.`)
            setIsProcessingSale(false)
            return
          }
          variant.qty = variant.qty - l.quantity
          if (variant.id) {
            updatesToDb.push({ id: variant.id, qty: variant.qty })
          }
          updated[itemIdx] = { ...item }
        }
      }
    }

    // Validate mandatory customer fields (only name is required)
    if (!customer.name) {
      alert('Por favor completa el nombre del cliente.')
      setIsProcessingSale(false)
      return
    }

    const paySum = totalPayments(paymentParts)
    if (Math.round(paySum * 100) !== Math.round(totalToPay * 100)) {
      alert('El total de pagos no coincide con el total a pagar.')
      setIsProcessingSale(false)
      return
    }

    const sellerName = (sellers.find(s => s.id === selectedSellerId)?.name) || ''
    const saleToInsert = {
      subtotal,
      discount: discountTotal,
      total: totalToPay,
      items: cart,
      payments: paymentParts,
      customer: customer,
      seller: sellerName || null
    }

    ;(async () => {
      const { data, error } = await supabase
        .from('sales')
        .insert([saleToInsert])
        .select('*')
        .single()
      if (error || !data) {
        alert('No se pudo registrar la venta. Intenta de nuevo.')
        setIsProcessingSale(false)
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

      // Update stock in database using variant IDs
      for (const update of updatesToDb) {
        await supabase
          .from('garments')
          .update({ qty: update.qty, updated_at: new Date().toISOString() })
          .eq('id', update.id)
      }
      
      // Reducir stock en base de datos por cada línea vendida (legacy code - puede eliminarse si ya funciona con updatesToDb)
      try {
        for (const l of cart) {
          const sku = l.sku
          let color: string | undefined
          let size: string | undefined
          if (l.variantLabel) {
            const parts = l.variantLabel.split(' / ')
            color = parts[0]
            size = parts[1]
          }

          // 1) Buscar la prenda específica para leer qty actual
          let selectQuery = supabase
            .from('garments')
            .select('id, qty')
            .eq('sku', sku)
            .limit(1)

          if (color) selectQuery = selectQuery.eq('color', color)
          if (size) selectQuery = selectQuery.eq('size', size)

          const { data: garmentRow, error: selErr } = await selectQuery.single()
          if (!selErr && garmentRow) {
            const newQty = Math.max(0, Number(garmentRow.qty || 0) - Number(l.quantity || 0))
            await supabase
              .from('garments')
              .update({ qty: newQty })
              .eq('id', garmentRow.id)
          } else {
            // Fallback: intentar por id directo si existe
            if (l.itemId) {
              const { data: byId } = await supabase
                .from('garments')
                .select('id, qty')
                .eq('id', l.itemId)
                .single()
              if (byId) {
                const newQty = Math.max(0, Number(byId.qty || 0) - Number(l.quantity || 0))
                await supabase
                  .from('garments')
                  .update({ qty: newQty })
                  .eq('id', byId.id)
              }
            }
          }
        }
      } catch (_) {
        // Silenciar errores de stock para no bloquear la venta, pero ya se actualizó localmente
      }

      setInventory(updated)
      setSales(prev => [sale, ...prev].slice(0, 50))
      setShowCheckout(false)
      clearCart()
      setIsProcessingSale(false) // Re-enable button after successful sale
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

  function printInvoice(sale: SaleRecord) {
    try {
      const w = window.open('', '_blank')
      if (!w) return
      
      const itemsHtml = sale.items.map(l => `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 6px 0; font-size: 10px; color: #111827;">
            <div style="font-weight: 500; margin-bottom: 1px;">${l.name}</div>
            ${l.variantLabel ? `<div style="font-size: 9px; color: #6b7280; margin-bottom: 1px;">${l.variantLabel}</div>` : ''}
            <div style="font-size: 8px; color: #9ca3af;">SKU: ${l.sku}</div>
          </td>
          <td style="padding: 6px 4px; text-align: center; font-size: 10px; color: #111827; font-weight: 500;">
            x${l.quantity}
          </td>
          <td style="padding: 6px 0; text-align: right; font-size: 10px; color: #111827; font-weight: 600;">
            ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(l.unitPrice * l.quantity)}
          </td>
        </tr>
      `).join('')
      
      const paymentsHtml = sale.payments.map((p, i) => {
        const methodNames: Record<string, string> = {
          'cash': 'Efectivo',
          'card': 'Tarjeta',
          'transfer': 'Transferencia',
          'voucher': 'Vale',
          'store-credit': 'Crédito interno'
        }
        return `
          <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px;">
            <span style="color: #6b7280; text-transform: capitalize;">${methodNames[p.method] || p.method}:</span>
            <span style="font-weight: 600; color: #111827;">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(p.amount)}</span>
          </div>
        `
      }).join('')
      
      const customerInfo = sale.customer ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 9px; color: #6b7280; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.3px;">Información del Cliente</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 10px; color: #111827;">
            <div>
              <span style="color: #6b7280; font-weight: 500;">Nombre:</span>
              <span style="font-weight: 500; margin-left: 4px;">${sale.customer.name || '—'}</span>
            </div>
            ${sale.customer.phone ? `
            <div>
              <span style="color: #6b7280; font-weight: 500;">Teléfono:</span>
              <span style="font-weight: 500; margin-left: 4px;">${sale.customer.phone}</span>
            </div>
            ` : '<div></div>'}
            ${sale.customer.cedula ? `
            <div>
              <span style="color: #6b7280; font-weight: 500;">Cédula:</span>
              <span style="font-weight: 500; margin-left: 4px;">${sale.customer.cedula}</span>
            </div>
            ` : ''}
            ${sale.customer.email ? `
            <div>
              <span style="color: #6b7280; font-weight: 500;">Email:</span>
              <span style="font-weight: 500; margin-left: 4px;">${sale.customer.email}</span>
            </div>
            ` : ''}
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
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #ffffff;
              color: #111827;
              line-height: 1.4;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            .header {
              display: flex;
              align-items: center;
              margin-bottom: 16px;
              padding-bottom: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            .logo {
              width: 50px;
              height: 50px;
              object-fit: contain;
              margin-right: 12px;
            }
            .header-text {
              flex: 1;
            }
            .header-title {
              font-size: 18px;
              font-weight: 700;
              color: #111827;
              margin-bottom: 2px;
              letter-spacing: -0.3px;
            }
            .header-subtitle {
              font-size: 10px;
              color: #6b7280;
              font-weight: 500;
            }
            .info-section {
              margin-bottom: 12px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 10px;
            }
            .info-label {
              color: #6b7280;
              font-weight: 500;
            }
            .info-value {
              color: #111827;
              font-weight: 600;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 12px 0;
            }
            .items-table thead {
              background: #f9fafb;
              border-bottom: 1px solid #e5e7eb;
            }
            .items-table th {
              padding: 6px 0;
              text-align: left;
              font-size: 9px;
              font-weight: 600;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .items-table th:last-child {
              text-align: right;
            }
            .items-table th:nth-child(2) {
              text-align: center;
            }
            .items-table td {
              padding: 6px 0;
              font-size: 10px;
            }
            .totals {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid #e5e7eb;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 11px;
            }
            .total-row.final {
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid #e5e7eb;
              font-size: 14px;
              font-weight: 700;
              color: #111827;
            }
            .total-label {
              color: #6b7280;
              font-weight: 500;
            }
            .total-value {
              color: #111827;
              font-weight: 600;
            }
            .total-row.final .total-label,
            .total-row.final .total-value {
              color: #111827;
              font-weight: 700;
            }
            .payments-section {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid #e5e7eb;
            }
            .payments-title {
              font-size: 10px;
              color: #6b7280;
              font-weight: 600;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .footer {
              margin-top: 16px;
              padding-top: 12px;
              border-top: 1px dashed #d1d5db;
              text-align: center;
              font-size: 9px;
              color: #9ca3af;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .container {
                padding: 16px;
                max-width: 100%;
              }
              @page {
                margin: 0.8cm;
              }
            }
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
              <div class="info-row">
                <span class="info-label">Fecha y Hora:</span>
                <span class="info-value">${new Date(sale.at).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</span>
              </div>
              ${sale.seller ? `
              <div class="info-row">
                <span class="info-label">Vendedor:</span>
                <span class="info-value">${sale.seller}</span>
              </div>
              ` : ''}
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
                <span class="total-label">Subtotal:</span>
                <span class="total-value">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.subtotal)}</span>
              </div>
              ${sale.discount > 0 ? `
              <div class="total-row">
                <span class="total-label">Descuento:</span>
                <span class="total-value" style="color: #dc2626;">-${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.discount)}</span>
              </div>
              ` : ''}
              <div class="total-row final">
                <span class="total-label">Total a Pagar:</span>
                <span class="total-value">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.total)}</span>
              </div>
            </div>
            
            ${sale.payments.length > 0 ? `
            <div class="payments-section">
              <div class="payments-title">Métodos de Pago</div>
              ${paymentsHtml}
            </div>
            ` : ''}
            
            ${customerInfo}
            
            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
              <div style="text-align: center; margin-bottom: 8px;">
                <h3 style="font-size: 12px; font-weight: 700; color: #111827; margin-bottom: 4px; letter-spacing: 0.5px;">DWELL ROPA DEPORTIVA</h3>
                <p style="font-size: 9px; color: #4b5563; line-height: 1.4; margin-bottom: 6px;">
                  Somos una empresa Santandereana especializada en ropa deportiva premium y de alto rendimiento, fabricada con las mejores textiles del mercado y con la mejor calidad garantizada.
                </p>
                <div style="margin-top: 6px; font-size: 8px; color: #9ca3af;">
                  <a href="https://dwell.com.co/" style="color: #6b7280; text-decoration: none;">www.dwell.com.co</a>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div style="font-size: 9px;">Gracias por su compra</div>
              <div style="margin-top: 2px; font-size: 8px;">Este documento es válido como comprobante de pago</div>
              <div style="margin-top: 2px; font-size: 8px; color: #6b7280;">
                Cambios solo por talla, no devolución de dinero. Garantía de dos meses por prenda.
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            }
          </script>
        </body>
        </html>
      `)
      w.document.close()
    } catch {}
  }

  return (
    <div className={`p-3 sm:p-4 ${fontClass} text-black min-h-screen`}>
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-black mb-1 sm:mb-2 tracking-tight">
          Ventas Dwell
        </h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
        {/* Left: Search and Results */}
        <div className="col-span-12 md:col-span-7">
          <div className="bg-white rounded-lg shadow p-2 sm:p-3 mb-2 sm:mb-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white rounded px-2 border border-gray-200">
                <SearchIcon size={16} className="sm:w-[18px] sm:h-[18px] flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, SKU..."
                  className="w-full bg-transparent py-2 text-sm sm:text-base outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="flex-1 sm:flex-none border rounded px-2 py-1.5 sm:py-2 bg-white text-black text-xs sm:text-sm">
                  <option value="">Todas</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 border rounded text-xs sm:text-sm whitespace-nowrap" onClick={openCameraScan}>
                  Escanear QR
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-2 sm:p-3">
            {filteredItems.length === 0 && (
              <div className="text-black text-xs sm:text-sm text-center py-4">Sin resultados</div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {filteredItems.map(item => (
                <button key={item.id} className="text-left border rounded-lg overflow-hidden hover:shadow group" onClick={() => addToCartFromItem(item)}>
                  <div className="h-20 sm:h-24 md:h-28 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-black text-xs sm:text-sm">IMG</div>
                    )}
                  </div>
                  <div className="p-1.5 sm:p-2">
                    <div className="font-medium truncate text-xs sm:text-sm">{item.name}</div>
                    <div className="text-[10px] sm:text-xs text-black truncate">{item.sku}</div>
                    <div className="text-xs sm:text-sm font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(item.price)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Cart */}
        <div className="col-span-12 md:col-span-5">
          <div className="bg-white rounded-lg shadow p-2 sm:p-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 sm:gap-2 font-semibold text-sm sm:text-base"><ShoppingCartIcon size={16} className="sm:w-[18px] sm:h-[18px]" /> Carrito</div>
              <button className="text-red-600 flex items-center gap-1 text-xs sm:text-sm" title="Limpiar carrito" onClick={clearCart}><TrashIcon size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Limpiar</span></button>
            </div>

            <div className="flex-1 overflow-auto">
              {cart.length === 0 && (
                <div className="text-black text-xs sm:text-sm text-center py-4">No hay productos en el carrito</div>
              )}
              <div className="space-y-1.5 sm:space-y-2">
                {cart.map(line => (
                  <div key={line.id} className="flex items-center gap-1.5 sm:gap-2 border rounded p-1.5 sm:p-2">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 flex items-center justify-center flex-shrink-0 rounded overflow-hidden">
                      {line.imageUrl ? <img src={line.imageUrl} className="w-full h-full object-cover"/> : <span className="text-[8px] sm:text-xs">IMG</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-xs sm:text-sm">{line.name}</div>
                      <div className="text-[10px] sm:text-xs text-black truncate">{line.variantLabel || line.sku}</div>
                    </div>
                    <div className="text-[10px] sm:text-xs w-16 sm:w-20 text-right flex-shrink-0">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(line.unitPrice)}</div>
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <button className="border rounded p-0.5 sm:p-1" onClick={() => changeQty(line.id, -1)}><MinusIcon size={12} className="sm:w-3.5 sm:h-3.5" /></button>
                      <div className="w-6 sm:w-8 text-center text-xs sm:text-sm">{line.quantity}</div>
                      <button className="border rounded p-0.5 sm:p-1" onClick={() => changeQty(line.id, 1)}><PlusIcon size={12} className="sm:w-3.5 sm:h-3.5" /></button>
                    </div>
                    <div className="text-[10px] sm:text-xs w-16 sm:w-20 text-right font-semibold flex-shrink-0">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(line.unitPrice * line.quantity)}</div>
                    <button className="text-red-600 flex-shrink-0" onClick={() => removeLine(line.id)}><XIcon size={14} className="sm:w-4 sm:h-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Discounts */}
            <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2">
              <div>
                <label className="text-[10px] sm:text-xs text-black">Descuento %</label>
                <div className="flex gap-1">
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
                    className="flex-1 border rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm bg-white text-black" 
                    onKeyPress={e => {
                      if (e.key === 'Enter') {
                        // Descuento se aplica automáticamente al cambiar el valor
                      }
                    }}
                  />
                  <button 
                    className="border rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm bg-white text-black hover:bg-gray-50 whitespace-nowrap" 
                    onClick={() => {
                      // El descuento ya se aplica automáticamente, pero podemos resetearlo
                      if (discountPct > 0) {
                        setDiscountPct(0)
                      }
                    }}
                  >
                    {discountPct > 0 ? 'Limpiar' : 'Aplicar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Seller selection */}
            <div className="mt-2 sm:mt-3">
              <label className="text-[10px] sm:text-xs text-black">Vendedor</label>
              <select
                value={selectedSellerId}
                onChange={e => setSelectedSellerId(e.target.value)}
                className="w-full border rounded px-2 py-1.5 bg-white text-black text-xs sm:text-sm"
              >
                {sellers.length === 0 && <option value="">—</option>}
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Totals */}
            <div className="mt-2 sm:mt-4 border-t pt-2 sm:pt-3">
              <div className="flex justify-between text-xs sm:text-sm text-black"><span>Productos</span><span>{cart.reduce((a, l) => a + l.quantity, 0)}</span></div>
              <div className="flex justify-between text-xs sm:text-sm text-black"><span>Subtotal</span><span>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(subtotal)}</span></div>
              <div className="flex justify-between text-xs sm:text-sm text-black"><span>Descuentos</span><span>-{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(discountTotal)}</span></div>
              <div className="flex justify-between items-center mt-1.5 sm:mt-2">
                <span className="text-sm sm:text-base font-semibold">Total</span>
                <span className="text-lg sm:text-xl md:text-2xl font-bold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalToPay)}</span>
              </div>
              <button disabled={cart.length === 0} onClick={openCheckout} className={`w-full mt-2 sm:mt-3 py-2 rounded border border-black text-black flex items-center justify-center gap-2 text-xs sm:text-sm ${cart.length === 0 ? 'bg-gray-300' : 'bg-gray-200 hover:bg-gray-300'}`}>
                <DollarSignIcon size={16} className="sm:w-[18px] sm:h-[18px]" /> Cobrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sales history panel */}
      <div className="mt-3 sm:mt-4 bg-white rounded-lg shadow p-2 sm:p-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 sm:gap-2 font-semibold mb-2 text-sm sm:text-base"><HistoryIcon size={16} className="sm:w-[18px] sm:h-[18px]" /> Ventas recientes</div>
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <div className="grid grid-cols-6 text-xs font-medium text-black border-b pb-1 min-w-[560px]">
            <div>Hora</div><div>Folio</div><div>Total</div><div>Método</div><div>Cliente</div><div>Acciones</div>
          </div>
          {sales.slice(0, 20).map(s => (
            <div key={s.id} className="grid grid-cols-6 py-1 text-sm items-center border-b last:border-b-0 min-w-[560px]">
              <div>{new Date(s.at).toLocaleTimeString()}</div>
              <div className="truncate">{s.id}</div>
              <div className="font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(s.total)}</div>
              <div className="truncate">{s.payments.map(p => p.method).join(' + ')}</div>
              <div className="truncate">{s.customer?.name || '—'}</div>
              <div className="flex gap-2">
                <button className="text-gray-700 underline text-xs" onClick={() => setDetailSale(s)}>Ver detalle</button>
                <button className="text-blue-600 underline text-xs" onClick={() => setInvoiceSale(s)}>Ver PDF</button>
              </div>
            </div>
          ))}
        </div>
        {/* Mobile Card View */}
        <div className="md:hidden space-y-2">
          {sales.slice(0, 20).map(s => (
            <div key={s.id} className="border border-gray-200 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{new Date(s.at).toLocaleTimeString()}</p>
                  <p className="text-[10px] text-gray-600">Folio: {s.id.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-black">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(s.total)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div>
                  <span className="text-gray-600">Método: </span>
                  <span className="text-gray-800">{s.payments.map(p => p.method).join(' + ')}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cliente: </span>
                  <span className="text-gray-800 truncate block">{s.customer?.name || '—'}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <button className="flex-1 px-2 py-1 text-gray-700 underline text-xs" onClick={() => setDetailSale(s)}>Ver detalle</button>
                <button className="flex-1 px-2 py-1 text-blue-600 underline text-xs" onClick={() => setInvoiceSale(s)}>Ver PDF</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Variant selector modal */}
      {variantPicker && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-sm sm:text-base">Seleccionar variante</div>
              <button onClick={() => setVariantPicker(null)}><XIcon size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
            </div>
            <div className="text-xs sm:text-sm mb-2 truncate">{variantPicker.item.name} • {variantPicker.item.sku}</div>
            {/* Colors */}
            <div className="mb-2">
              <div className="text-xs text-black mb-1">Color</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from(new Set((variantPicker.item.variants || []).map(v => v.color))).map(color => {
                  // Get the first variant image for this color
                  const colorVariant = (variantPicker.item.variants || []).find(v => v.color === color)
                  const colorImageUrl = colorVariant?.imageUrl || variantPicker.item.imageUrl
                  const isSelected = selectedVariant?.color === color
                  return (
                    <button 
                      key={color} 
                      onClick={() => setSelectedVariant(v => ({ color, size: v?.size || '' }))} 
                      className={`border rounded overflow-hidden ${isSelected ? 'ring-2 ring-black ring-offset-1' : ''} hover:shadow-md transition-all`}
                    >
                      {colorImageUrl ? (
                        <div className="relative">
                          <img 
                            src={colorImageUrl} 
                            alt={color} 
                            className="w-full h-20 sm:h-24 object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <div className="bg-black text-white px-2 py-1 rounded text-xs font-medium">✓</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-20 sm:h-24 bg-gray-100 flex items-center justify-center">
                          <span className="text-xs text-gray-500">Sin imagen</span>
                        </div>
                      )}
                      <div className={`p-1.5 text-center text-xs font-medium ${isSelected ? 'bg-black text-white' : 'bg-white text-black'}`}>
                        {color}
                      </div>
                    </button>
                  )
                })}
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
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-3">
              <button className="w-full sm:w-auto px-3 py-2 border rounded text-xs sm:text-sm" onClick={() => setVariantPicker(null)}>Cancelar</button>
              <button className="w-full sm:w-auto px-3 py-2 border border-black bg-gray-200 hover:bg-gray-300 text-black rounded text-xs sm:text-sm" onClick={confirmVariantAdd}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex-1"></div>
              <div className="flex-1 text-center">
                <h2 className="text-lg font-semibold text-gray-900">Finalizar Venta</h2>
                <p className="text-xs text-gray-500">Complete la información del cliente y el pago</p>
              </div>
              <div className="flex-1 flex justify-end">
                <button 
                  onClick={() => setShowCheckout(false)} 
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <XIcon size={18} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Información del Cliente */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Información del Cliente
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Nombre *</label>
                    <input 
                      value={customer.name || ''} 
                      onChange={e => setCustomer(prev => ({ ...prev, name: e.target.value }))} 
                      placeholder="Nombre completo del cliente" 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Teléfono (opcional)</label>
                    <input 
                      value={customer.phone || ''} 
                      onChange={e => setCustomer(prev => ({ ...prev, phone: e.target.value }))} 
                      placeholder="Número de teléfono" 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Correo (opcional)</label>
                    <input 
                      value={customer.email || ''} 
                      onChange={e => setCustomer(prev => ({ ...prev, email: e.target.value }))} 
                      placeholder="correo@ejemplo.com" 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Cédula (opcional)</label>
                    <input 
                      value={customer.cedula || ''} 
                      onChange={e => setCustomer(prev => ({ ...prev, cedula: e.target.value }))} 
                      placeholder="Número de cédula" 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                    />
                  </div>
                </div>
              </div>

              {/* Métodos de Pago */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Métodos de Pago
                </h3>
                <div className="space-y-3 mb-4">
                  {paymentParts.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <select 
                        value={p.method} 
                        onChange={e => updatePayment(i, { method: e.target.value as PaymentMethod })} 
                        className="flex-shrink-0 border border-gray-300 rounded-lg px-4 py-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm font-medium"
                      >
                        <option value="cash">💵 Efectivo</option>
                        <option value="card">💳 Tarjeta</option>
                        <option value="transfer">📱 Transferencia</option>
                        <option value="voucher">🎫 Vale</option>
                        <option value="store-credit">📝 Crédito interno</option>
                      </select>
                      <input 
                        type="text" 
                        value={formatNumberWithSeparators(p.amount)} 
                        onChange={e => handlePaymentAmountChange(i, e.target.value)} 
                        placeholder="0" 
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-right font-semibold" 
                      />
                      {paymentParts.length > 1 && (
                        <button 
                          onClick={() => removePayment(i)} 
                          className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors text-red-500 hover:text-red-600"
                        >
                          <XIcon size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    onClick={addPaymentPart} 
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                  >
                    + Agregar otro método de pago
                  </button>
                </div>
                
                {/* Resumen de pagos */}
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Total a pagar:</span>
                    <span className="font-semibold text-gray-900">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalToPay)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Total pagado:</span>
                    <span className={`font-semibold ${totalPayments(paymentParts) >= totalToPay ? 'text-green-600' : 'text-orange-600'}`}>
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalPayments(paymentParts))}
                    </span>
                  </div>
                  {totalPayments(paymentParts) > totalToPay && (
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Cambio a entregar:</span>
                      <span className="font-bold text-green-600">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.max(0, totalPayments(paymentParts) - totalToPay))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setShowCheckout(false)} 
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={isProcessingSale || totalPayments(paymentParts) < totalToPay || !customer.name}
                onClick={finalizeSale} 
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  isProcessingSale || totalPayments(paymentParts) < totalToPay
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : !customer.name
                    ? 'bg-blue-400 hover:bg-blue-500 text-white shadow-lg hover:shadow-xl'
                    : 'bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                <SaveIcon size={16} /> 
                {isProcessingSale ? 'Procesando...' : 'Confirmar y Registrar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale detail modal */}
      {detailSale && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-gray-100 p-3 sm:p-4 sticky top-0 bg-white z-10">
              <div className="font-semibold text-sm sm:text-base text-black">Detalle de venta</div>
              <button onClick={() => setDetailSale(null)} className="text-gray-700 hover:text-black"><XIcon size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
            </div>
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 text-xs sm:text-sm text-black text-left">
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
              <div className="flex justify-start pt-2 border-t border-gray-100">
                <button className="w-full sm:w-auto px-3 py-2 border rounded text-xs sm:text-sm" onClick={() => setDetailSale(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice PDF modal */}
      {invoiceSale && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 px-4 pt-3">
              <div className="font-semibold text-black text-sm">Factura de venta</div>
              <button onClick={() => setInvoiceSale(null)} className="text-gray-700 hover:text-black"><XIcon size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-3" style={{ fontFamily: 'Helvetica Neue, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' }}>
              <style>{`
                @font-face {
                  font-family: 'Helvetica Neue';
                  src: url('/fonts/HelveticaNeueMedium.otf') format('opentype');
                  font-weight: 500;
                  font-style: normal;
                  font-display: swap;
                }
              `}</style>
              {/* Header with Logo */}
              <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
                {logoBase64 && <img src={logoBase64} alt="Dwell Logo" className="w-12 h-12 object-contain mr-3" />}
                <div className="flex-1">
                  <div className="text-lg font-bold text-gray-900 mb-0.5" style={{ letterSpacing: '-0.3px' }}>Ticket de Venta</div>
                  <div className="text-xs text-gray-600 font-medium">Factura #{invoiceSale.id}</div>
                </div>
              </div>

              {/* Info Section */}
              <div className="mb-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 font-medium">Fecha y Hora:</span>
                  <span className="text-gray-900 font-semibold">{new Date(invoiceSale.at).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</span>
                </div>
                {invoiceSale.seller && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 font-medium">Vendedor:</span>
                    <span className="text-gray-900 font-semibold">{invoiceSale.seller}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse mb-3">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-1.5 text-left text-[9px] font-semibold text-gray-600 uppercase tracking-wide">Producto</th>
                    <th className="py-1.5 text-center text-[9px] font-semibold text-gray-600 uppercase tracking-wide">Cantidad</th>
                    <th className="py-1.5 text-right text-[9px] font-semibold text-gray-600 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceSale.items.map((l, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5">
                        <div className="font-medium text-gray-900 text-xs mb-0.5">{l.name}</div>
                        {l.variantLabel && (
                          <div className="text-[9px] text-gray-600 mb-0.5">{l.variantLabel}</div>
                        )}
                        <div className="text-[8px] text-gray-400">SKU: {l.sku}</div>
                      </td>
                      <td className="py-1.5 text-center font-medium text-gray-900 text-xs">
                        x{l.quantity}
                      </td>
                      <td className="py-1.5 text-right font-semibold text-gray-900 text-xs">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(l.unitPrice * l.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="mb-3 pt-2 border-t border-gray-200">
                <div className="flex justify-between py-1 text-xs">
                  <span className="text-gray-600 font-medium">Subtotal:</span>
                  <span className="text-gray-900 font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(invoiceSale.subtotal)}</span>
                </div>
                {invoiceSale.discount > 0 && (
                  <div className="flex justify-between py-1 text-xs">
                    <span className="text-gray-600 font-medium">Descuento:</span>
                    <span className="text-red-600 font-semibold">-{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(invoiceSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 mt-1 pt-2 border-t border-gray-200">
                  <span className="text-sm font-bold text-gray-900">Total a Pagar:</span>
                  <span className="text-base font-bold text-gray-900">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(invoiceSale.total)}</span>
                </div>
              </div>

              {/* Payments */}
              {invoiceSale.payments.length > 0 && (
                <div className="mb-3 pt-2 border-t border-gray-200">
                  <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Métodos de Pago</div>
                  <div className="space-y-1">
                    {invoiceSale.payments.map((p, i) => {
                      const methodNames: Record<string, string> = {
                        'cash': 'Efectivo',
                        'card': 'Tarjeta',
                        'transfer': 'Transferencia',
                        'voucher': 'Vale',
                        'store-credit': 'Crédito interno'
                      }
                      return (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-600 capitalize">{methodNames[p.method] || p.method}:</span>
                          <span className="font-semibold text-gray-900">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(p.amount)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Customer Info */}
              {invoiceSale.customer && (
                <div className="mb-3 pt-2 border-t border-gray-200">
                  <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Información del Cliente</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-900">
                    <div>
                      <span className="text-gray-600 font-medium">Nombre:</span>
                      <span className="ml-1 font-medium">{invoiceSale.customer.name || '—'}</span>
                    </div>
                    {invoiceSale.customer.phone && (
                      <div>
                        <span className="text-gray-600 font-medium">Teléfono:</span>
                        <span className="ml-1 font-medium">{invoiceSale.customer.phone}</span>
                      </div>
                    )}
                    {invoiceSale.customer.cedula && (
                      <div>
                        <span className="text-gray-600 font-medium">Cédula:</span>
                        <span className="ml-1 font-medium">{invoiceSale.customer.cedula}</span>
                      </div>
                    )}
                    {invoiceSale.customer.email && (
                      <div>
                        <span className="text-gray-600 font-medium">Email:</span>
                        <span className="ml-1 font-medium">{invoiceSale.customer.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Company Info */}
              <div className="mb-3 pt-2 border-t border-gray-200">
                <div className="text-center">
                  <h3 className="text-xs font-bold text-gray-900 mb-1" style={{ letterSpacing: '0.5px' }}>DWELL ROPA DEPORTIVA</h3>
                  <p className="text-[9px] text-gray-600 leading-relaxed mb-2">
                    Somos una empresa Santandereana especializada en ropa deportiva premium y de alto rendimiento, fabricada con las mejores textiles del mercado y con la mejor calidad garantizada.
                  </p>
                  <div className="text-[8px] text-gray-500">
                    <a href="https://dwell.com.co/" className="text-gray-600 hover:underline">www.dwell.com.co</a>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-dashed border-gray-300 text-center text-[9px] text-gray-400">
                <div>Gracias por su compra</div>
                <div className="mt-0.5">Este documento es válido como comprobante de pago</div>
                <div className="mt-0.5 text-[8px] text-gray-500">
                  Cambios solo por talla, no devolución de dinero. Garantía de dos meses por prenda.
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100">
              <button className="px-3 py-1.5 border rounded text-gray-700 hover:bg-gray-50 text-xs" onClick={() => setInvoiceSale(null)}>Cerrar</button>
              <button className="px-3 py-1.5 border border-black bg-gray-200 hover:bg-gray-300 text-black rounded text-xs" onClick={() => printInvoice(invoiceSale)}>Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner modal */}
      {isScanOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-3 sm:p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm sm:text-base text-gray-900">Escanear QR</h4>
                  <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Apunta la cámara al código QR del producto. Se acumula el conteo por producto.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => setScanned([])} className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 border rounded text-gray-700 hover:bg-gray-50 text-xs sm:text-sm">Limpiar</button>
                  <button onClick={closeCameraScan} className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 border rounded text-gray-700 hover:bg-gray-50 text-xs sm:text-sm">Cerrar</button>
                </div>
              </div>
            </div>
            <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="relative rounded overflow-hidden border border-gray-200">
                <video ref={videoRef} className="w-full h-48 sm:h-72 object-cover bg-black" playsInline muted />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-8 border-2 border-white/70 rounded" />
                </div>
                {lastScanOk && scanCountdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/80 backdrop-blur-sm rounded-full w-32 h-32 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl font-bold text-white mb-1">{scanCountdown}</div>
                        <div className="text-xs text-white/80">Escaneo exitoso</div>
                      </div>
                    </div>
                  </div>
                )}
                {lastScanOk && scanCountdown === 0 && (
                  <div className="absolute left-2 bottom-2 bg-black/70 text-white text-xs rounded px-2 py-1 flex items-center gap-2">
                    <span>✅</span>
                    <span>{`Escaneo correcto (${lastScanOk.sku}). Listo para escanear`}</span>
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded p-2 max-h-72 overflow-auto flex flex-col" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent'
              }}>
                <style>{`
                  .apple-scrollbar::-webkit-scrollbar {
                    width: 6px;
                  }
                  .apple-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .apple-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(0, 0, 0, 0.2);
                    border-radius: 3px;
                  }
                  .apple-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(0, 0, 0, 0.3);
                  }
                `}</style>
                <div className="text-sm font-medium text-gray-800 mb-1">Escaneados</div>
                {scanned.length === 0 && (
                  <div className="text-xs text-gray-500">Aún no hay productos escaneados.</div>
                )}
                <div className="divide-y flex-1 overflow-auto apple-scrollbar">
                  {scanned.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 py-2">
                      <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden border border-gray-200 flex-shrink-0">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm text-gray-900 font-medium">{p.name}</div>
                        <div className="truncate text-xs text-gray-600">SKU: {p.sku}</div>
                        {p.variantLabel && (
                          <div className="text-xs text-gray-500 mt-1">Variante: {p.variantLabel}</div>
                        )}
                      </div>
                      <div className="text-right w-12 font-semibold text-gray-900 flex-shrink-0">x{p.count}</div>
                    </div>
                  ))}
                </div>
                {scanned.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 sticky bottom-0 bg-white">
                    <button 
                      onClick={addScannedToCart} 
                      className="w-full px-3 sm:px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      <ShoppingCartIcon size={14} className="sm:w-4 sm:h-4" />
                      Agregar al carrito ({scanned.reduce((sum, p) => sum + p.count, 0)} unidades)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClothingPOS


