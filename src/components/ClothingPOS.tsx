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
  SaveIcon,
  EditIcon,
  PartyPopperIcon
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

interface CartModification {
  name: string
  price: number
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
  discount?: number // Descuento individual por prenda
  modifications?: CartModification[] // Modificaciones con precio
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
  address?: string
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

const categories = ['PANTALONETAS', 'CAMISETAS', 'SUDADERAS', 'BUZOS', 'SHORT', 'TOP', 'LYCRA', 'FALDA']

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

  // Función para formatear números igual que PaymentHistory
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

  // Función para obtener el nombre del método de pago
  const getPaymentMethodName = (method: string) => {
    const methodMap: Record<string, string> = {
      'cash': 'Efectivo',
      'card': 'Tarjeta',
      'transfer': 'Transferencia',
      'voucher': 'Vale',
      'store-credit': 'Crédito de tienda'
    }
    return methodMap[method.toLowerCase()] || method
  }
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
  const [editingLine, setEditingLine] = useState<CartLine | null>(null)

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

  // Calcular subtotal incluyendo modificaciones y descuentos individuales (en %)
  const subtotal = useMemo(() => {
    return cart.reduce((sum, l) => {
      const modificationsTotal = (l.modifications || []).reduce((modSum, mod) => modSum + mod.price, 0)
      const priceWithModifications = l.unitPrice + modificationsTotal
      const discountPercent = Math.max(0, Math.min(100, l.discount || 0))
      const discountAmount = (priceWithModifications * discountPercent / 100)
      const finalPricePerUnit = priceWithModifications - discountAmount
      return sum + (finalPricePerUnit * l.quantity)
    }, 0)
  }, [cart])
  // Descuento global removido - los descuentos individuales ya están incluidos en el subtotal
  const discountTotal = 0
  const totalToPay = subtotal

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

  function updateLine(lineId: string, updates: Partial<CartLine>) {
    setCart(prev => prev.map(l => l.id === lineId ? { ...l, ...updates } : l))
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

    // Search in main SKU and also in variant SKUs
    const found = inventory.find(it => {
      // Check main SKU
      if (it.sku.toLowerCase() === sku.toLowerCase()) return true
      // Check variant SKUs
      if (it.variants && it.variants.length > 0) {
        return it.variants.some(v => v.sku && v.sku.toLowerCase() === sku.toLowerCase())
      }
      return false
    })
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
    let variantImageUrl = found.imageUrl // Default to product image

    // If QR contains color and size, try to match variant
    if (qrData && qrData.color && qrData.size && found.variants && found.variants.length > 0) {
      // First try to match by SKU from QR if available
      let variant = found.variants.find(
        v => v.sku && v.sku.toLowerCase() === sku.toLowerCase()
      )
      
      // If not found by SKU, try to match by color and size
      if (!variant) {
        variant = found.variants.find(
          v => {
            const colorMatch = v.color.toLowerCase().trim() === qrData.color!.toLowerCase().trim()
            const sizeMatch = v.size.toLowerCase().trim() === qrData.size!.toLowerCase().trim()
            return colorMatch && sizeMatch
          }
        )
      }
      
      if (variant && variant.qty > 0) {
        color = variant.color
        size = variant.size
        variantLabel = `${variant.color} / ${variant.size}`
        // Use variant image if available, otherwise use product image
        variantImageUrl = variant.imageUrl || found.imageUrl
      }
    } else if (found.variants && found.variants.length > 0) {
      // If QR has SKU, try to find variant by SKU
      if (sku) {
        const variantBySku = found.variants.find(v => v.sku && v.sku.toLowerCase() === sku.toLowerCase())
        if (variantBySku) {
          color = variantBySku.color
          size = variantBySku.size
          variantLabel = `${variantBySku.color} / ${variantBySku.size}`
          // Use variant image if available, otherwise use product image
          variantImageUrl = variantBySku.imageUrl || found.imageUrl
        } else {
          // Use first variant if available
          color = found.variants[0].color
          size = found.variants[0].size
          variantLabel = `${found.variants[0].color} / ${found.variants[0].size}`
          variantImageUrl = found.variants[0].imageUrl || found.imageUrl
        }
      } else {
        // Use first variant if available
        color = found.variants[0].color
        size = found.variants[0].size
        variantLabel = `${found.variants[0].color} / ${found.variants[0].size}`
        variantImageUrl = found.variants[0].imageUrl || found.imageUrl
      }
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
        imageUrl: variantImageUrl, 
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
              // Use variant image if available, otherwise use product image
              const variantImageUrl = variant.imageUrl || found.imageUrl
              const line: CartLine = {
                id: lineId,
                itemId: found.id,
                name: found.name,
                sku: found.sku,
                unitPrice: found.price,
                quantity: toAdd,
                imageUrl: variantImageUrl,
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

      const itemsHtml = sale.items.map(item => `
        <div class="item-row">
            <div class="item-image">
                 ${item.imageUrl ? `<img src="${item.imageUrl}" alt="img" />` : '<div class="no-img">IMG</div>'}
            </div>
            <div class="item-details">
                <div class="item-name">${item.name}</div>
                ${item.variantLabel ? `<div class="item-variant">${item.variantLabel}</div>` : ''}
            </div>
            <div class="item-totals">
                <div class="item-qty">x${item.quantity}</div>
                <div class="item-price">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(item.unitPrice * item.quantity)}</div>
            </div>
        </div>
      `).join('')

      const customerHtml = sale.customer ? `
        <div class="customer-box">
            <div class="customer-name">${sale.customer.name || 'Cliente General'}</div>
            ${sale.customer.phone ? `<div class="customer-row"><span class="label">Tel:</span><span class="value">${sale.customer.phone}</span></div>` : ''}
            ${sale.customer.email ? `<div class="customer-row"><span class="label">Email:</span><span class="value">${sale.customer.email}</span></div>` : ''}
            ${sale.customer.cedula ? `<div class="customer-row"><span class="label">Cédula:</span><span class="value">${sale.customer.cedula}</span></div>` : ''}
            ${sale.customer.address ? `<div class="customer-row"><span class="label">Dirección:</span><span class="value">${sale.customer.address}</span></div>` : ''}
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
              body {
                background-color: white;
                padding: 0;
                display: block;
              }
              .container {
                width: 100%;
                max-width: 380px;
                margin: 0 auto;
                border: 1px solid #e5e7eb;
                border-radius: 24px;
                padding: 20px;
                box-shadow: none;
              }
              /* Adjust cutouts for print background */
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
                <span>${new Date(sale.at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}</span>
                <span class="dot"></span>
                <span>${new Date(sale.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
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
                   <span style="font-weight: 500;">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.subtotal)}</span>
               </div>
               ${sale.discount > 0 ? `
               <div class="total-row">
                   <span style="color: #6b7280;">Descuento</span>
                   <span style="font-weight: 500; color: #dc2626;">-${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.discount)}</span>
               </div>
               ` : ''}
               <div class="total-row final">
                   <span>Total</span>
                   <span>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(sale.total)}</span>
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
                {cart.map(line => {
                  const modificationsTotal = (line.modifications || []).reduce((sum, mod) => sum + mod.price, 0)
                  const priceWithModifications = line.unitPrice + modificationsTotal
                  const discountPercent = Math.max(0, Math.min(100, line.discount || 0))
                  const discountAmount = (priceWithModifications * discountPercent / 100)
                  const finalPricePerUnit = priceWithModifications - discountAmount
                  const lineTotal = finalPricePerUnit * line.quantity
                  return (
                    <div key={line.id} className="border rounded p-1.5 sm:p-2">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 flex items-center justify-center flex-shrink-0 rounded overflow-hidden">
                          {line.imageUrl ? <img src={line.imageUrl} className="w-full h-full object-cover"/> : <span className="text-[8px] sm:text-xs">IMG</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium text-xs sm:text-sm">{line.name}</div>
                          <div className="text-[10px] sm:text-xs text-black truncate">{line.variantLabel || line.sku}</div>
                          {(line.discount && line.discount > 0) || (line.modifications && line.modifications.length > 0) ? (
                            <div className="mt-0.5 space-y-0.5">
                              {line.discount && line.discount > 0 && (
                                <div className="text-[9px] text-red-600">Descuento: {discountPercent % 1 === 0 ? discountPercent : discountPercent.toFixed(2)}% (-{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(discountAmount)})</div>
                              )}
                              {line.modifications && line.modifications.length > 0 && (
                                <div className="text-[9px] text-blue-600">
                                  Modificaciones: {line.modifications.map(m => `${m.name} (+${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(m.price)})`).join(', ')}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-[10px] sm:text-xs w-16 sm:w-20 text-right flex-shrink-0">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(line.unitPrice)}</div>
                        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                          <button className="border rounded p-0.5 sm:p-1" onClick={() => changeQty(line.id, -1)}><MinusIcon size={12} className="sm:w-3.5 sm:h-3.5" /></button>
                          <div className="w-6 sm:w-8 text-center text-xs sm:text-sm">{line.quantity}</div>
                          <button className="border rounded p-0.5 sm:p-1" onClick={() => changeQty(line.id, 1)}><PlusIcon size={12} className="sm:w-3.5 sm:h-3.5" /></button>
                        </div>
                        <div className="text-[10px] sm:text-xs w-16 sm:w-20 text-right font-semibold flex-shrink-0">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(lineTotal)}</div>
                        <button className="text-blue-600 flex-shrink-0" onClick={() => setEditingLine(line)} title="Editar descuento y modificaciones"><EditIcon size={14} className="sm:w-4 sm:h-4" /></button>
                        <button className="text-red-600 flex-shrink-0" onClick={() => removeLine(line.id)}><XIcon size={14} className="sm:w-4 sm:h-4" /></button>
                      </div>
                    </div>
                  )
                })}
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
              <div className="flex justify-between items-center mt-1.5 sm:mt-2">
                <span className="text-sm sm:text-base font-semibold">Total</span>
                <span className="text-lg sm:text-xl md:text-2xl font-bold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(subtotal)}</span>
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

      {/* Edit line modal */}
      {editingLine && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm sm:text-base">Editar prenda</div>
              <button onClick={() => setEditingLine(null)}><XIcon size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
            </div>
            <div className="text-xs sm:text-sm mb-3 truncate">{editingLine.name} • {editingLine.variantLabel || editingLine.sku}</div>
            
            {/* Descuento individual */}
            <div className="mb-4">
              <label className="block text-xs text-black mb-1.5">Descuento por prenda (%)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={editingLine.discount !== undefined && editingLine.discount !== null ? String(editingLine.discount) : ''} 
                  onChange={e => {
                    let raw = e.target.value.replace(/,/g, '.')
                    // Permitir solo números y un punto decimal
                    raw = raw.replace(/[^0-9.]/g, '')
                    // Evitar múltiples puntos
                    const parts = raw.split('.')
                    if (parts.length > 2) {
                      raw = parts[0] + '.' + parts.slice(1).join('')
                    }
                    // Si está vacío, permitir que se borre
                    if (raw === '' || raw === '.') {
                      setEditingLine(prev => prev ? { ...prev, discount: undefined } : null)
                      return
                    }
                    const num = Number(raw)
                    if (!isNaN(num) && num >= 0 && num <= 100) {
                      setEditingLine(prev => prev ? { ...prev, discount: num } : null)
                    }
                  }} 
                  placeholder="0"
                  className="flex-1 border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" 
                />
                <span className="text-xs text-gray-600">%</span>
              </div>
              {editingLine.discount && editingLine.discount > 0 && (
                <div className="text-[10px] text-red-600 mt-1">
                  {(() => {
                    const modificationsTotal = (editingLine.modifications || []).reduce((sum, mod) => sum + mod.price, 0)
                    const priceWithModifications = editingLine.unitPrice + modificationsTotal
                    const discountAmount = (priceWithModifications * editingLine.discount / 100)
                    return `Descuento por unidad: -${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(discountAmount)} | Total: -${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(discountAmount * editingLine.quantity)}`
                  })()}
                </div>
              )}
            </div>

            {/* Modificaciones */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-black">Modificaciones</label>
                <button 
                  onClick={() => {
                    setEditingLine(prev => prev ? { 
                      ...prev, 
                      modifications: [...(prev.modifications || []), { name: '', price: 0 }] 
                    } : null)
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <PlusIcon size={12} /> Agregar
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {editingLine.modifications && editingLine.modifications.length > 0 ? (
                  editingLine.modifications.map((mod, idx) => (
                    <div key={idx} className="flex gap-2 items-start border rounded p-2">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={mod.name} 
                          onChange={e => {
                            const newMods = [...(editingLine.modifications || [])]
                            newMods[idx] = { ...mod, name: e.target.value }
                            setEditingLine(prev => prev ? { ...prev, modifications: newMods } : null)
                          }} 
                          placeholder="Nombre de la modificación"
                          className="w-full border rounded px-2 py-1 text-xs bg-white text-black mb-1" 
                        />
                        <input 
                          type="text" 
                          inputMode="decimal"
                          value={mod.price || ''} 
                          onChange={e => {
                            const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '')
                            const num = raw === '' ? 0 : Number(raw)
                            if (!isNaN(num) && num >= 0) {
                              const newMods = [...(editingLine.modifications || [])]
                              newMods[idx] = { ...mod, price: num }
                              setEditingLine(prev => prev ? { ...prev, modifications: newMods } : null)
                            }
                          }} 
                          placeholder="Precio"
                          className="w-full border rounded px-2 py-1 text-xs bg-white text-black text-right" 
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const newMods = editingLine.modifications?.filter((_, i) => i !== idx) || []
                          setEditingLine(prev => prev ? { ...prev, modifications: newMods.length > 0 ? newMods : undefined } : null)
                        }}
                        className="text-red-600 flex-shrink-0 mt-1"
                      >
                        <XIcon size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 text-center py-2">No hay modificaciones</div>
                )}
              </div>
              {editingLine.modifications && editingLine.modifications.length > 0 && (
                <div className="text-[10px] text-blue-600 mt-2">
                  Total modificaciones: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
                    (editingLine.modifications || []).reduce((sum, mod) => sum + mod.price, 0) * editingLine.quantity
                  )}
                </div>
              )}
            </div>

            {/* Resumen */}
            <div className="mb-4 p-2 bg-gray-50 rounded border">
              <div className="text-xs text-gray-600 mb-1">Resumen</div>
              <div className="text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span>Precio unitario:</span>
                  <span>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(editingLine.unitPrice)}</span>
                </div>
                {editingLine.modifications && editingLine.modifications.length > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Modificaciones:</span>
                    <span>+{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
                      (editingLine.modifications || []).reduce((sum, mod) => sum + mod.price, 0)
                    )}</span>
                  </div>
                )}
                {editingLine.discount && editingLine.discount > 0 && (() => {
                  const modificationsTotal = (editingLine.modifications || []).reduce((sum, mod) => sum + mod.price, 0)
                  const priceWithModifications = editingLine.unitPrice + modificationsTotal
                  const discountAmount = (priceWithModifications * editingLine.discount / 100)
                  const discountDisplay = editingLine.discount % 1 === 0 ? editingLine.discount : editingLine.discount.toFixed(2)
                  return (
                    <div className="flex justify-between text-red-600">
                      <span>Descuento ({discountDisplay}%):</span>
                      <span>-{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(discountAmount)}</span>
                    </div>
                  )
                })()}
                <div className="flex justify-between font-semibold pt-1 border-t border-gray-300">
                  <span>Total por unidad:</span>
                  <span>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
                    (() => {
                      const modificationsTotal = (editingLine.modifications || []).reduce((sum, mod) => sum + mod.price, 0)
                      const priceWithModifications = editingLine.unitPrice + modificationsTotal
                      const discountPercent = Math.max(0, Math.min(100, editingLine.discount || 0))
                      const discountAmount = (priceWithModifications * discountPercent / 100)
                      return priceWithModifications - discountAmount
                    })()
                  )}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm">
                  <span>Total ({editingLine.quantity} unidades):</span>
                  <span>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
                    (() => {
                      const modificationsTotal = (editingLine.modifications || []).reduce((sum, mod) => sum + mod.price, 0)
                      const priceWithModifications = editingLine.unitPrice + modificationsTotal
                      const discountPercent = Math.max(0, Math.min(100, editingLine.discount || 0))
                      const discountAmount = (priceWithModifications * discountPercent / 100)
                      const finalPricePerUnit = priceWithModifications - discountAmount
                      return finalPricePerUnit * editingLine.quantity
                    })()
                  )}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button className="w-full sm:w-auto px-3 py-2 border rounded text-xs sm:text-sm" onClick={() => setEditingLine(null)}>Cancelar</button>
              <button 
                className="w-full sm:w-auto px-3 py-2 border border-black bg-gray-200 hover:bg-gray-300 text-black rounded text-xs sm:text-sm" 
                onClick={() => {
                  if (editingLine) {
                    updateLine(editingLine.id, {
                      discount: editingLine.discount && editingLine.discount > 0 ? editingLine.discount : undefined,
                      modifications: editingLine.modifications && editingLine.modifications.length > 0 
                        ? editingLine.modifications.filter(m => m.name.trim() !== '') 
                        : undefined
                    })
                    setEditingLine(null)
                  }
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex-1">
                <h2 className="text-lg font-bold text-black tracking-tight">Finalizar Venta</h2>
                <p className="text-xs text-gray-500 mt-0.5">Complete la información del cliente y el pago</p>
              </div>
              <button 
                onClick={() => setShowCheckout(false)} 
                className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <XIcon size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {/* Información del Cliente */}
              <div>
                <h3 className="text-sm font-bold text-black mb-4 tracking-tight uppercase">
                  Información del Cliente
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Nombre *</label>
                    <input 
                      value={customer.name || ''} 
                      onChange={e => setCustomer(prev => ({ ...prev, name: e.target.value }))} 
                      placeholder="Nombre completo del cliente" 
                      className="w-full border border-gray-200 rounded px-3 py-2 bg-white text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors" 
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Teléfono</label>
                      <input 
                        value={customer.phone || ''} 
                        onChange={e => setCustomer(prev => ({ ...prev, phone: e.target.value }))} 
                        placeholder="Número de teléfono" 
                        className="w-full border border-gray-200 rounded px-3 py-2 bg-white text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Correo</label>
                      <input 
                        value={customer.email || ''} 
                        onChange={e => setCustomer(prev => ({ ...prev, email: e.target.value }))} 
                        placeholder="correo@ejemplo.com" 
                        className="w-full border border-gray-200 rounded px-3 py-2 bg-white text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Cédula</label>
                    <input 
                      value={customer.cedula || ''} 
                      onChange={e => setCustomer(prev => ({ ...prev, cedula: e.target.value }))} 
                      placeholder="Número de cédula" 
                      className="w-full border border-gray-200 rounded px-3 py-2 bg-white text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Dirección</label>
                    <input 
                      value={customer.address || ''} 
                      onChange={e => setCustomer(prev => ({ ...prev, address: e.target.value }))} 
                      placeholder="Dirección completa" 
                      className="w-full border border-gray-200 rounded px-3 py-2 bg-white text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors" 
                    />
                  </div>
                </div>
              </div>

              {/* Métodos de Pago */}
              <div>
                <h3 className="text-sm font-bold text-black mb-4 tracking-tight uppercase">
                  Métodos de Pago
                </h3>
                <div className="space-y-3">
                  {paymentParts.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select 
                        value={p.method} 
                        onChange={e => updatePayment(i, { method: e.target.value as PaymentMethod })} 
                        className="flex-shrink-0 border border-gray-200 rounded px-3 py-2 bg-white text-sm text-black focus:outline-none focus:border-black transition-colors font-medium"
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
                        className="flex-1 border border-gray-200 rounded px-3 py-2 bg-white text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors text-right font-semibold" 
                      />
                      {paymentParts.length > 1 && (
                        <button 
                          onClick={() => removePayment(i)} 
                          className="w-9 h-9 rounded hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-500 hover:text-gray-700"
                        >
                          <XIcon size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    onClick={addPaymentPart} 
                    className="w-full border border-gray-200 border-dashed rounded px-3 py-2 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    + Agregar otro método de pago
                  </button>
                </div>
                
                {/* Resumen de pagos */}
                <div className="pt-4 mt-4 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total a pagar</span>
                    <span className="text-sm font-bold text-black">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalToPay)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total pagado</span>
                    <span className={`text-sm font-bold ${totalPayments(paymentParts) >= totalToPay ? 'text-green-600' : 'text-orange-600'}`}>
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalPayments(paymentParts))}
                    </span>
                  </div>
                  {totalPayments(paymentParts) > totalToPay && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-600">Cambio a entregar</span>
                      <span className="text-sm font-bold text-green-600">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.max(0, totalPayments(paymentParts) - totalToPay))}
                      </span>
                    </div>
                  )}
                  {totalPayments(paymentParts) < totalToPay && totalPayments(paymentParts) > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-600">Dinero faltante</span>
                      <span className="text-sm font-bold text-orange-600">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.max(0, totalToPay - totalPayments(paymentParts)))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-2 bg-gray-50">
              <button 
                onClick={() => setShowCheckout(false)} 
                className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-black hover:bg-white transition-colors bg-white"
              >
                Cancelar
              </button>
              <button 
                disabled={isProcessingSale || totalPayments(paymentParts) < totalToPay || !customer.name}
                onClick={finalizeSale} 
                className={`px-4 py-2 rounded text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  isProcessingSale || totalPayments(paymentParts) < totalToPay || !customer.name
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-black hover:bg-gray-800 text-white'
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
        <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden">
          {/* Blur overlay */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-0 transition-all duration-300" onClick={() => setDetailSale(null)}></div>
          
          {/* Contenedor centrado */}
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
                      <span className="text-sm font-bold text-gray-900 font-mono">{detailSale.id}</span>
                  </div>

                  {/* Date & Time */}
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">DATE & TIME</span>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <span>{new Date(detailSale.at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          <span>{new Date(detailSale.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                  </div>
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
                      <div className="text-sm font-bold text-gray-900 mb-2">{detailSale.customer?.name || 'Cliente General'}</div>
                      <div className="space-y-1.5">
                          {detailSale.customer?.phone && (
                              <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Tel:</span>
                                  <span className="text-xs text-gray-600 break-words">{detailSale.customer.phone}</span>
                              </div>
                          )}
                          {detailSale.customer?.email && (
                              <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Email:</span>
                                  <span className="text-xs text-gray-600 break-all">{detailSale.customer.email}</span>
                              </div>
                          )}
                          {detailSale.customer?.cedula && (
                              <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Cédula:</span>
                                  <span className="text-xs text-gray-600 break-words">{detailSale.customer.cedula}</span>
                              </div>
                          )}
                          {detailSale.customer?.address && (
                              <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Dirección:</span>
                                  <span className="text-xs text-gray-600 break-words">{detailSale.customer.address}</span>
                              </div>
                          )}
                          {!detailSale.customer?.phone && !detailSale.customer?.email && !detailSale.customer?.cedula && !detailSale.customer?.address && (
                              <span className="text-xs text-gray-400">Sin datos adicionales</span>
                          )}
                      </div>
                  </div>

                   {/* Products Summary */}
                  <div className="border-t border-gray-100 pt-4">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2 block">Products</span>
                      <div className="space-y-2">
                           {detailSale.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                  {/* Product Image */}
                                  <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden">
                                      {item.imageUrl ? (
                                          <img 
                                              src={item.imageUrl} 
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
                                          {item.variantLabel && (
                                              <div className="text-[10px] text-gray-500">{item.variantLabel}</div>
                                          )}
                                      </div>
                                      <span className="text-xs font-mono text-gray-400 whitespace-nowrap">x{item.quantity}</span>
                                  </div>
                              </div>
                           ))}
                      </div>
                  </div>
              </div>
              
              {/* Barcode */}
              <div className="pb-8 px-8 flex flex-col items-center">
                  <div className="h-12 w-full flex justify-center items-stretch gap-[3px] opacity-80 overflow-hidden">
                     {Array.from({ length: 45 }).map((_, i) => (
                       <div key={i} className="bg-black flex-shrink-0" style={{ width: Math.random() > 0.6 ? '3px' : '1px' }}></div>
                     ))}
                  </div>
                   <div className="flex justify-between w-full text-[10px] font-mono text-gray-400 mt-1 px-4 tracking-widest">
                      <span>{detailSale.id.slice(0, 4)}</span>
                      <span>{detailSale.id.slice(-4)}</span>
                   </div>
              </div>
              </div>

              {/* Close Button absolute or bottom */}
              <button 
                  onClick={() => setDetailSale(null)}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
              >
                  <XIcon size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice PDF modal - Ticket Style */}
      {invoiceSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-0 transition-all duration-300" onClick={() => setInvoiceSale(null)}></div>
          
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
                              className="h-16 object-contain"
                          />
                      </div>
                  )}
                  
                  {/* Ticket ID */}
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">TICKET ID</span>
                      <span className="text-sm font-bold text-gray-900 font-mono">{invoiceSale.id}</span>
                  </div>

                  {/* Date & Time */}
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">DATE & TIME</span>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <span>{new Date(invoiceSale.at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          <span>{new Date(invoiceSale.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                  </div>

                  {/* Seller info */}
                  {invoiceSale.seller && (
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Vendedor</span>
                        <span className="text-sm font-medium text-gray-900">{invoiceSale.seller}</span>
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
                      <div className="text-sm font-bold text-gray-900 mb-2">{invoiceSale.customer?.name || 'Cliente General'}</div>
                      <div className="space-y-1.5">
                          {invoiceSale.customer?.phone && (
                              <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Tel:</span>
                                  <span className="text-xs text-gray-600 break-words">{invoiceSale.customer.phone}</span>
                              </div>
                          )}
                          {invoiceSale.customer?.email && (
                              <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Email:</span>
                                  <span className="text-xs text-gray-600 break-all">{invoiceSale.customer.email}</span>
                              </div>
                          )}
                          {invoiceSale.customer?.cedula && (
                              <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Cédula:</span>
                                  <span className="text-xs text-gray-600 break-words">{invoiceSale.customer.cedula}</span>
                              </div>
                          )}
                          {invoiceSale.customer?.address && (
                              <div className="flex items-start gap-2">
                                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Dirección:</span>
                                  <span className="text-xs text-gray-600 break-words">{invoiceSale.customer.address}</span>
                              </div>
                          )}
                          {!invoiceSale.customer?.phone && !invoiceSale.customer?.email && !invoiceSale.customer?.cedula && !invoiceSale.customer?.address && (
                              <span className="text-xs text-gray-400">Sin datos adicionales</span>
                          )}
                      </div>
                  </div>

                   {/* Products Summary */}
                  <div className="border-t border-gray-100 pt-4">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2 block">Products</span>
                      <div className="space-y-2">
                           {invoiceSale.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                  {/* Product Image */}
                                  <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden">
                                      {item.imageUrl ? (
                                          <img 
                                              src={item.imageUrl} 
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
                                          {item.variantLabel && (
                                              <div className="text-[10px] text-gray-500">{item.variantLabel}</div>
                                          )}
                                      </div>
                                      <div className="text-right">
                                         <div className="text-xs font-mono text-gray-900 whitespace-nowrap">x{item.quantity}</div>
                                         <div className="text-[10px] text-gray-500">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(item.unitPrice * item.quantity)}</div>
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
                          <span className="font-medium text-gray-900">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(invoiceSale.subtotal)}</span>
                      </div>
                      {invoiceSale.discount > 0 && (
                          <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Descuento</span>
                              <span className="font-medium text-red-600">-{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(invoiceSale.discount)}</span>
                          </div>
                      )}
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                          <span className="text-gray-900">Total</span>
                          <span className="text-gray-900">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(invoiceSale.total)}</span>
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
                      <span>{invoiceSale.id.slice(0, 4)}</span>
                      <span>{invoiceSale.id.slice(-4)}</span>
                   </div>
              </div>

              {/* Company Footer */}
              <div className="px-8 pb-4 pt-4 border-t border-dashed border-gray-200 text-center">
                  <h3 className="text-xs font-bold text-gray-900 mb-2" style={{ letterSpacing: '0.5px' }}>DWELL ROPA DEPORTIVA</h3>
                  <p className="text-[9px] text-gray-600 leading-relaxed mb-2 max-w-xs mx-auto">
                      Somos una empresa Santandereana especializada en ropa deportiva premium y de alto rendimiento, fabricada con las mejores textiles del mercado y con la mejor calidad garantizada.
                  </p>
                  <div className="mb-3 text-[8px] text-gray-500">
                      <a href="https://dwellcol.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline">dwellcol.com</a>
                  </div>
                  <div className="text-[9px] text-gray-400 space-y-1">
                      <p>Gracias por su compra</p>
                      <p>Este documento es válido como comprobante de pago</p>
                      <p className="text-[8px] text-gray-500 mt-2">Cambios solo por talla, no devolución de dinero. Garantía de dos meses por prenda</p>
                  </div>
              </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                  <button 
                      onClick={() => setInvoiceSale(null)}
                      className="flex-1 py-2.5 text-gray-600 font-medium text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                      Cerrar
                  </button>
                  <button 
                      onClick={() => printInvoice(invoiceSale)}
                      className="flex-1 py-2.5 text-white font-bold text-xs rounded-xl bg-black hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-black/20"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                      Imprimir Ticket
                  </button>
              </div>

              {/* Close Button absolute top right */}
              <button 
                  onClick={() => setInvoiceSale(null)}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
              >
                  <XIcon size={20} />
              </button>
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


