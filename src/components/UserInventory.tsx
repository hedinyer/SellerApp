import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, uploadProductImage, type GarmentRecord } from '../lib/supabaseClient'
import { useConfig } from '../contexts/ConfigContext'
import {
  SearchIcon,
  FilterIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  AlertTriangleIcon,
  XIcon,
  SaveIcon
} from './icons'

type InventoryStatus = 'activo' | 'inactivo' | 'descatalogado'

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
  brand?: string
  color: string
  size: string
  price: number | string
  cost?: number
  status: InventoryStatus
  qty: number
  lowStockThreshold: number
  imageUrl?: string
  description?: string
  variants?: VariantStock[]
}

const categories = ['Camisas', 'Pantalones', 'Vestidos', 'Sudaderas', 'Playeras', 'Chamarras', 'Faldas', 'Accesorios']

export function UserInventory() {
  const { formatCurrency, getFontSizeClass } = useConfig()
  const numberFormatter = useMemo(() => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }), [])
  const formatPrice = (value: number) => (Number.isFinite(value) ? numberFormatter.format(value) : value)

  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterLevel, setFilterLevel] = useState<string>('') // normal|low|out
  
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [sortBy, setSortBy] = useState<keyof GarmentItem>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [items, setItems] = useState<GarmentItem[]>([])

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<GarmentItem>>({ status: 'activo', lowStockThreshold: 5 })
  const [formImageFile, setFormImageFile] = useState<File | null>(null)
  const [formImagePreviewUrl, setFormImagePreviewUrl] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [qrForId, setQrForId] = useState<string | null>(null)
  const [isScanOpen, setIsScanOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerRef = useRef<any>(null)
  const [scanned, setScanned] = useState<{ sku: string, name: string, imageUrl?: string, count: number, color: string, size: string, category: string, id: string }[]>([])
  const lastScannedRef = useRef<{ sku: string, timestamp: number } | null>(null)
  const [lastScanOk, setLastScanOk] = useState<{ sku: string, name: string } | null>(null)
  const [scanCountdown, setScanCountdown] = useState<number>(0)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) {
        const mapped: GarmentItem[] = data.map((g: GarmentRecord) => ({
          id: g.id,
          name: g.name,
          sku: g.sku,
          category: g.category,
          brand: g.brand || '',
          color: g.color,
          size: g.size,
          price: (g as any).price,
          cost: g.cost ? Number(g.cost) : 0,
          status: g.status as InventoryStatus,
          qty: g.qty,
          lowStockThreshold: g.low_stock_threshold,
          imageUrl: g.image_url || undefined,
          description: g.description || ''
        }))
        setItems(mapped)
      }
      setIsLoading(false)
    }
    load()
  }, [])

  // Realtime listener to reflect qty updates immediately
  useEffect(() => {
    const channel = supabase
      .channel('realtime:garments-qty')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'garments' }, (payload: any) => {
        const updated = payload?.new
        if (!updated?.id) return
        setItems(prev => prev.map(i => i.id === updated.id ? { ...i, qty: updated.qty } : i))
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch (_) { /* no-op */ }
    }
  }, [])

  useEffect(() => {
    if (formImageFile) {
      const url = URL.createObjectURL(formImageFile)
      setFormImagePreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setFormImagePreviewUrl(null)
    }
  }, [formImageFile])

  // Countdown timer for scanner feedback
  useEffect(() => {
    if (scanCountdown <= 0) return
    const id = setTimeout(() => setScanCountdown(s => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(id)
  }, [scanCountdown])

  const filtered = useMemo(() => {
    let data = items.filter(i => {
      const q = query.toLowerCase()
      const matchesQuery = !q || [i.name, i.sku, i.category, i.color, i.size, i.brand || ''].some(v => v.toLowerCase().includes(q))
      const matchesCategory = !filterCategory || i.category === filterCategory
      const matchesStatus = !filterStatus || i.status === filterStatus
      const level = i.qty === 0 ? 'out' : (i.qty <= i.lowStockThreshold ? 'low' : 'normal')
      const matchesLevel = !filterLevel || level === filterLevel
      const matchesOnlyLow = !onlyLowStock || level === 'low' || level === 'out'
      return matchesQuery && matchesCategory && matchesStatus && matchesLevel && matchesOnlyLow
    })

    data.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      const av = a[sortBy]
      const bv = b[sortBy]
      if (sortBy === 'price') {
        const avn = Number(a.price)
        const bvn = Number(b.price)
        return (avn - bvn) * dir
      }
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })

    return data
  }, [items, query, filterCategory, filterStatus, filterLevel, onlyLowStock, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize)

  function toggleSort(key: keyof GarmentItem) {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('asc') }
  }

  function openCreate() {
    setEditingId(null)
    setForm({ status: 'activo', lowStockThreshold: 5 })
    setFormImageFile(null)
    setFormImagePreviewUrl(null)
    setIsFormOpen(true)
  }

  function openEdit(id: string) {
    const it = items.find(x => x.id === id)
    if (!it) return
    setEditingId(id)
    setForm({ ...it })
    setFormImageFile(null)
    setFormImagePreviewUrl(null)
    setIsFormOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.sku || !form.category || !form.price || Number(form.price) <= 0 || (form.qty ?? -1) < 0) return
    const skuExists = items.some(i => i.sku.toLowerCase() === (form.sku || '').toLowerCase() && i.id !== editingId)
    if (skuExists) return

    setIsLoading(true)
    try {
      let imageUrl = form.imageUrl || undefined
      if (formImageFile && form.sku) {
        const url = await uploadProductImage(formImageFile, form.sku)
        if (url) imageUrl = url
      }

      if (editingId) {
        const payload = {
          name: form.name!,
          sku: form.sku!,
          category: form.category!,
          brand: form.brand || null,
          color: form.color || 'N/A',
          size: form.size || 'N/A',
          price: form.price!,
          cost: form.cost ?? null,
          status: (form.status as InventoryStatus) || 'activo',
          qty: form.qty ?? 0,
          low_stock_threshold: form.lowStockThreshold ?? 5,
          image_url: imageUrl || null,
          description: form.description || null,
          updated_at: new Date().toISOString()
        }
        const { error } = await supabase.from('garments').update(payload).eq('id', editingId)
        if (!error) {
          setItems(items.map(i => i.id === editingId ? {
            ...(i as GarmentItem),
            name: payload.name,
            sku: payload.sku,
            category: payload.category,
            brand: payload.brand || undefined,
            color: payload.color,
            size: payload.size,
            price: payload.price,
            cost: payload.cost || undefined,
            status: payload.status,
            qty: payload.qty,
            lowStockThreshold: payload.low_stock_threshold,
            imageUrl: imageUrl,
            description: payload.description || undefined
          } : i))
        }
      } else {
        const payload = {
          name: form.name!,
          sku: form.sku!,
          category: form.category!,
          brand: form.brand || null,
          color: form.color || 'N/A',
          size: form.size || 'N/A',
          price: form.price!,
          cost: form.cost ?? null,
          status: (form.status as InventoryStatus) || 'activo',
          qty: form.qty ?? 0,
          low_stock_threshold: form.lowStockThreshold ?? 5,
          image_url: imageUrl || null,
          description: form.description || null
        }
        const { data, error } = await supabase.from('garments').insert(payload).select().single()
        if (!error && data) {
          const g = data as GarmentRecord
          const newItem: GarmentItem = {
            id: g.id,
            name: g.name,
            sku: g.sku,
            category: g.category,
            brand: g.brand || undefined,
            color: g.color,
            size: g.size,
            price: (g as any).price,
            cost: g.cost ? Number(g.cost) : 0,
            status: g.status as InventoryStatus,
            qty: g.qty,
            lowStockThreshold: g.low_stock_threshold,
            imageUrl: g.image_url || undefined,
            description: g.description || undefined
          }
          setItems([newItem, ...items])
        }
      }
    } finally {
      setIsLoading(false)
      setIsFormOpen(false)
      setEditingId(null)
      setFormImageFile(null)
    }
  }

  function handleDelete(id: string) {
    setDeleteConfirmId(id)
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return
    const { error } = await supabase.from('garments').delete().eq('id', deleteConfirmId)
    if (!error) setItems(items.filter(i => i.id !== deleteConfirmId))
    setDeleteConfirmId(null)
  }

  function markAs(status: InventoryStatus, id?: string) {
    const targetId = id || editingId
    if (!targetId) return
    setItems(items.map(i => i.id === targetId ? { ...i, status } : i))
  }

  function exportCSV() {
    const headers = ['SKU','Nombre','Categoría','Marca','Color','Talla','Precio','Stock','Estado']
    const rows = items.map(i => [i.sku,i.name,i.category,i.brand||'',i.color,i.size,String(i.price),String(i.qty),i.status])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inventario.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importCSVTemplate() {
    const headers = ['sku','name','category','brand','color','size','price','qty','status']
    const sample = ['T-0002','Playera Básica Negra','Playeras','BasicX','Negro','M','299','10','activo']
    const csv = [headers, sample].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_inventario.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function getQrUrlForData(data: unknown, size = 240) {
    const json = JSON.stringify(data)
    const encoded = encodeURIComponent(json)
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=${size}x${size}&margin=1`
  }

  function openQrModal(id: string) {
    setQrForId(id)
  }

  function closeQrModal() {
    setQrForId(null)
  }

  function printQr(product: GarmentItem) {
    const payload = { sku: product.sku, category: product.category, color: product.color, size: product.size }
    const imgUrl = getQrUrlForData(payload, 320)
    const w = window.open('', '_blank', 'width=360,height=420')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>QR ${product.sku}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff;">
      <div style="text-align:center;">
        <img src="${imgUrl}" alt="QR ${product.sku}" style="width:320px;height:320px;"/>
        <div style="margin-top:8px;font-family:Arial,sans-serif;color:#000;">SKU: ${product.sku}</div>
      </div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); window.close(); }, 200); }<\/script>
    </body></html>`)
    w.document.close()
  }

  function downloadQr(product: GarmentItem) {
    const payload = { sku: product.sku, category: product.category, color: product.color, size: product.size }
    const url = getQrUrlForData(payload, 512)
    const a = document.createElement('a')
    a.href = url
    a.download = `QR_${product.sku}.png`
    a.click()
  }

  // removed manual scan submit UI

  async function openCameraScan() {
    try {
      // Open modal first so the <video> is mounted
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
    // Expect JSON payload with sku, fallback to raw SKU
    let sku = value
    try {
      const obj = JSON.parse(value)
      if (obj && typeof obj === 'object' && typeof obj.sku === 'string') sku = obj.sku
    } catch {}
    const found = items.find(i => i.sku.toLowerCase() === sku.toLowerCase())
    if (found) {
      const now = Date.now()
      const last = lastScannedRef.current
      // Debounce: ignore if same product scanned within 3 seconds
      if (last && last.sku.toLowerCase() === found.sku.toLowerCase() && (now - last.timestamp) < 3000) {
        return
      }
      // Update last scanned
      lastScannedRef.current = { sku: found.sku, timestamp: now }
      // Update scanned list (increment count if exists, or add new)
      setScanned(prev => {
        const idx = prev.findIndex(p => p.sku.toLowerCase() === found.sku.toLowerCase())
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
          color: found.color,
          size: found.size,
          category: found.category,
          id: found.id
        }]
      })
      // Show feedback and start countdown
      setLastScanOk({ sku: found.sku, name: found.name })
      setScanCountdown(3)
    }
  }

  async function addScannedToInventory() {
    if (scanned.length === 0) return
    setIsLoading(true)
    try {
      const updates = await Promise.all(
        scanned.map(async (item) => {
          const found = items.find(i => i.id === item.id)
          if (!found) return null
          const nextQty = (found.qty || 0) + item.count
          const { data, error } = await supabase
            .from('garments')
            .update({ qty: nextQty, updated_at: new Date().toISOString() })
            .eq('id', found.id)
            .select('id, qty')
            .single()
          if (!error) {
            return { id: found.id, qty: data?.qty ?? nextQty }
          } else {
            return { id: found.id, qty: nextQty }
          }
        })
      )
      setItems(prev => {
        const updated = [...prev]
        updates.forEach(update => {
          if (update) {
            const idx = updated.findIndex(i => i.id === update.id)
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], qty: update.qty }
            }
          }
        })
        return updated
      })
      setScanned([])
      setLastScanOk(null)
      setScanCountdown(0)
    } finally {
      setIsLoading(false)
    }
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

  return (
    <div className={`min-h-screen bg-gray-50 apple-scrollbar ${getFontSizeClass()}`} style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="p-3 sm:p-4 lg:p-6">
        <style>{`
          .apple-scrollbar::-webkit-scrollbar,
          .apple-scrollbar *::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .apple-scrollbar::-webkit-scrollbar-track,
          .apple-scrollbar *::-webkit-scrollbar-track {
            background: transparent;
          }
          .apple-scrollbar::-webkit-scrollbar-thumb,
          .apple-scrollbar *::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
          }
          .apple-scrollbar::-webkit-scrollbar-thumb:hover,
          .apple-scrollbar *::-webkit-scrollbar-thumb:hover {
            background-color: rgba(0, 0, 0, 0.3);
          }
        `}</style>
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-black mb-1 sm:mb-2 tracking-tight">
            Inventario Dwell
          </h1>
        </div>
        <div className="flex flex-col gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="flex-1">
            <div className="relative">
              <SearchIcon size={16} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setPage(1) }}
                placeholder="Buscar por nombre, SKU, categoría..."
                className="w-full pl-8 sm:pl-9 pr-3 py-2 text-sm sm:text-base border border-gray-300 rounded bg-white text-black"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
              <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }} className="flex-1 min-w-[140px] px-2 py-1.5 sm:py-2 border rounded bg-white text-black text-xs sm:text-sm">
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} className="flex-1 min-w-[140px] px-2 py-1.5 sm:py-2 border rounded bg-white text-black text-xs sm:text-sm">
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="descatalogado">Descatalogado</option>
              </select>
              <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setPage(1) }} className="flex-1 min-w-[140px] px-2 py-1.5 sm:py-2 border rounded bg-white text-black text-xs sm:text-sm">
                <option value="">Nivel de inventario</option>
                <option value="normal">Normal</option>
                <option value="low">Bajo stock</option>
                <option value="out">Agotado</option>
              </select>
              <button onClick={openCameraScan} className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded bg-white text-gray-800 text-xs sm:text-sm whitespace-nowrap">Escanear QR</button>
              <button onClick={openCreate} className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-2 rounded bg-black text-white text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-2"><PlusIcon size={14} className="sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Agregar Nueva Prenda</span><span className="xs:hidden">Agregar</span></button>
              
            </div>
          </div>
          
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="p-2 sm:p-3 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="text-xs sm:text-sm text-gray-600">{filtered.length} resultados • Página {page} de {totalPages}</div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="hidden sm:inline">Filas:</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="border rounded px-2 py-1 bg-white text-xs sm:text-sm">
                {[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto apple-scrollbar">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 px-3">🖼️</th>
                  <th className="py-2 px-3 cursor-pointer" onClick={() => toggleSort('name')}>Nombre</th>
                  <th className="py-2 px-3">SKU</th>
                  <th className="py-2 px-3">Categoría</th>
                  <th className="py-2 px-3">Color</th>
                  <th className="py-2 px-3">Talla</th>
                  <th className="py-2 px-3 cursor-pointer" onClick={() => toggleSort('qty')}>Stock</th>
                  <th className="py-2 px-3 cursor-pointer" onClick={() => toggleSort('price')}>Precio</th>
                  <th className="py-2 px-3">Estado</th>
                  <th className="py-2 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map(item => {
                  const level = item.qty === 0 ? 'out' : (item.qty <= item.lowStockThreshold ? 'low' : 'normal')
                  return (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="py-2 px-3">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded object-cover border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200" />
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-900 font-medium flex items-center gap-2">
                        {level !== 'normal' && <span title={level === 'low' ? 'Bajo stock' : 'Agotado'}>{level === 'low' ? '⚠️' : '❌'}</span>}
                        {item.name}
                      </td>
                      <td className="py-2 px-3 text-gray-600">{item.sku}</td>
                      <td className="py-2 px-3 text-gray-600">{item.category}</td>
                      <td className="py-2 px-3 text-gray-600">{item.color}</td>
                      <td className="py-2 px-3 text-gray-600">{item.size}</td>
                      <td className="py-2 px-3 font-semibold text-black">{item.qty}</td>
                      <td className="py-2 px-3 text-black">{formatPrice(Number(item.price))}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.status === 'activo' ? 'bg-green-50 text-green-700 border border-green-200' : item.status === 'inactivo' ? 'bg-gray-50 text-gray-700 border border-gray-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>{item.status}</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openQrModal(item.id)} className="px-2 py-1 border rounded text-gray-700 hover:bg-gray-50 text-xs">QR</button>
                          <button onClick={() => openEdit(item.id)} className="px-2 py-1 border rounded text-gray-700 hover:bg-gray-50 flex items-center gap-1"><EditIcon size={14} /> Editar</button>
                          <button onClick={() => handleDelete(item.id)} className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 flex items-center gap-1"><TrashIcon size={14} /> Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {pageData.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-gray-500" colSpan={10}>Sin resultados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden p-3 space-y-3">
            {pageData.length > 0 ? (
              pageData.map(item => {
                const level = item.qty === 0 ? 'out' : (item.qty <= item.lowStockThreshold ? 'low' : 'normal')
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      {/* Imagen */}
                      <div className="flex-shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded object-cover border border-gray-200" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200" />
                        )}
                      </div>
                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-1">
                          {level !== 'normal' && <span title={level === 'low' ? 'Bajo stock' : 'Agotado'} className="text-lg flex-shrink-0">{level === 'low' ? '⚠️' : '❌'}</span>}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-600 mt-0.5">SKU: {item.sku}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <div>
                            <span className="text-gray-600">Categoría: </span>
                            <span className="text-gray-800">{item.category}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Color: </span>
                            <span className="text-gray-800">{item.color}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Talla: </span>
                            <span className="text-gray-800">{item.size}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Stock: </span>
                            <span className={`font-semibold ${level === 'low' ? 'text-orange-600' : level === 'out' ? 'text-red-600' : 'text-black'}`}>{item.qty}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-xs text-gray-600">Precio: </span>
                        <span className="text-sm font-semibold text-black">{formatPrice(Number(item.price))}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.status === 'activo' ? 'bg-green-50 text-green-700 border border-green-200' : item.status === 'inactivo' ? 'bg-gray-50 text-gray-700 border border-gray-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                      <button onClick={() => openQrModal(item.id)} className="flex-1 px-2 py-1.5 border rounded text-gray-700 hover:bg-gray-50 text-xs">QR</button>
                      <button onClick={() => openEdit(item.id)} className="flex-1 px-2 py-1.5 border rounded text-gray-700 hover:bg-gray-50 text-xs flex items-center justify-center gap-1">
                        <EditIcon size={12} /> Editar
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="flex-1 px-2 py-1.5 border rounded text-red-600 hover:bg-red-50 text-xs flex items-center justify-center gap-1">
                        <TrashIcon size={12} /> Eliminar
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">Sin resultados</div>
            )}
          </div>
          <div className="p-2 sm:p-3 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="text-gray-600">Mostrando {(page-1)*pageSize + 1}-{Math.min(page*pageSize, filtered.length)} de {filtered.length}</div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <button disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))} className="px-3 py-1.5 border rounded disabled:opacity-50 text-xs sm:text-sm">Anterior</button>
              <span className="text-xs sm:text-sm">Página {page} / {totalPages}</span>
              <button disabled={page>=totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))} className="px-3 py-1.5 border rounded disabled:opacity-50 text-xs sm:text-sm">Siguiente</button>
            </div>
          </div>
        </div>

        {/* Modal Formulario Agregar/Editar */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-black">{editingId ? 'Editar prenda' : 'Agregar nueva prenda'}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-600">Completa los campos requeridos</p>
                </div>
                <button onClick={() => { setIsFormOpen(false); setEditingId(null) }} className="text-gray-500 hover:text-gray-800"><XIcon size={18} className="sm:w-5 sm:h-5" /></button>
              </div>
              <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                  <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">SKU *</label>
                  <input value={form.sku || ''} onChange={e => setForm({ ...form, sku: e.target.value })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Categoría *</label>
                  <select value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border rounded bg-white text-black">
                    <option value="">Selecciona</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Marca</label>
                  <input value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                  <input value={form.color || ''} onChange={e => setForm({ ...form, color: e.target.value })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Talla</label>
                  <input value={form.size || ''} onChange={e => setForm({ ...form, size: e.target.value })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Precio de venta *</label>
                  <input type="number" min="0" step="0.01" value={form.price ?? ''} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Precio de costo (solo admin)</label>
                  <input type="number" min="0" step="0.01" value={form.cost ?? ''} onChange={e => setForm({ ...form, cost: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stock *</label>
                  <input type="number" min="0" value={form.qty ?? ''} onChange={e => setForm({ ...form, qty: parseInt(e.target.value || '0') })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Umbral bajo stock</label>
                  <input type="number" min="0" value={form.lowStockThreshold ?? 5} onChange={e => setForm({ ...form, lowStockThreshold: parseInt(e.target.value || '0') })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded bg-white text-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                  <select value={(form.status as InventoryStatus) || 'activo'} onChange={e => setForm({ ...form, status: e.target.value as InventoryStatus })} className="w-full px-3 py-2 border rounded bg-white text-black">
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="descatalogado">Descatalogado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Imagen principal</label>
                  <input type="file" accept="image/*" className="w-full text-sm" onChange={e => setFormImageFile(e.target.files?.[0] || null)} />
                  <div className="mt-2">
                    {formImagePreviewUrl ? (
                      <img src={formImagePreviewUrl} alt="Vista previa" className="w-28 h-28 object-cover rounded border border-gray-200" />
                    ) : (form.imageUrl ? (
                      <img src={form.imageUrl} alt="Actual" className="w-28 h-28 object-cover rounded border border-gray-200" />
                    ) : (
                      <div className="w-28 h-28 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-500">Sin imagen</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-3 sm:p-4 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sticky bottom-0 bg-white">
                <div className="flex items-center gap-2 text-xs sm:text-sm" />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => { setIsFormOpen(false); setEditingId(null) }} className="flex-1 sm:flex-none px-3 py-2 border rounded text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1 text-xs sm:text-sm"><XIcon size={14} className="sm:w-4 sm:h-4" /> Cancelar</button>
                  <button onClick={handleSave} className="flex-1 sm:flex-none px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2 text-xs sm:text-sm"><SaveIcon size={14} className="sm:w-4 sm:h-4" /> Guardar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación de eliminación */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-md p-4 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <AlertTriangleIcon size={18} className="sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
                <h4 className="font-semibold text-sm sm:text-base text-gray-900">¿Estás seguro?</h4>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 mb-4">Esta acción no se puede deshacer y afectará reportes históricos.</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto px-3 py-2 border rounded text-gray-700 hover:bg-gray-50 text-xs sm:text-sm">Cancelar</button>
                <button onClick={confirmDelete} className="w-full sm:w-auto px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 text-xs sm:text-sm">Eliminar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Escaneo QR por Cámara */}
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
                <div className="border border-gray-200 rounded p-2 max-h-72 overflow-auto flex flex-col apple-scrollbar" style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent'
                }}>
                  <style>{`
                    .apple-scrollbar::-webkit-scrollbar,
                    .apple-scrollbar *::-webkit-scrollbar {
                      width: 6px;
                    }
                    .apple-scrollbar::-webkit-scrollbar-track,
                    .apple-scrollbar *::-webkit-scrollbar-track {
                      background: transparent;
                    }
                    .apple-scrollbar::-webkit-scrollbar-thumb,
                    .apple-scrollbar *::-webkit-scrollbar-thumb {
                      background-color: rgba(0, 0, 0, 0.2);
                      border-radius: 3px;
                    }
                    .apple-scrollbar::-webkit-scrollbar-thumb:hover,
                    .apple-scrollbar *::-webkit-scrollbar-thumb:hover {
                      background-color: rgba(0, 0, 0, 0.3);
                    }
                  `}</style>
                  <div className="text-sm font-medium text-gray-800 mb-1">Escaneados</div>
                  {scanned.length === 0 && (
                    <div className="text-xs text-gray-500">Aún no hay productos escaneados.</div>
                  )}
                  <div className="divide-y flex-1 overflow-auto" style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent'
                  }}>
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
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-xs text-gray-500">Categoría: <span className="text-gray-700">{p.category}</span></span>
                            <span className="text-xs text-gray-500">Color: <span className="text-gray-700">{p.color}</span></span>
                            <span className="text-xs text-gray-500">Talla: <span className="text-gray-700">{p.size}</span></span>
                          </div>
                        </div>
                        <div className="text-right w-12 font-semibold text-gray-900 flex-shrink-0">x{p.count}</div>
                      </div>
                    ))}
                  </div>
                  {scanned.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 sticky bottom-0 bg-white">
                      <button 
                        onClick={addScannedToInventory} 
                        disabled={isLoading}
                        className="w-full px-3 sm:px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs sm:text-sm"
                      >
                        <PlusIcon size={14} className="sm:w-4 sm:h-4" />
                        {isLoading ? 'Agregando...' : `Agregar al inventario (${scanned.reduce((sum, p) => sum + p.count, 0)} unidades)`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal QR */}
        {qrForId && (() => {
          const product = items.find(i => i.id === qrForId)
          if (!product) return null
          const payload = { sku: product.sku, category: product.category, color: product.color, size: product.size }
          const qrUrl = getQrUrlForData(payload)
          return (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-sm p-4 sm:p-5">
                <div className="mb-3">
                  <h4 className="font-semibold text-sm sm:text-base text-gray-900">QR del producto</h4>
                  <p className="text-xs text-gray-600">SKU: {product.sku}</p>
                  <p className="text-xs text-gray-600 truncate">{product.name}</p>
                </div>
        <div className="flex items-center justify-center mb-4">
          <img src={qrUrl} alt={`QR ${product.sku}`} className="w-48 h-48 sm:w-60 sm:h-60" />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <button onClick={() => downloadQr(product)} className="w-full sm:w-auto px-3 py-2 border rounded text-gray-700 hover:bg-gray-50 text-xs sm:text-sm">Descargar</button>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={() => printQr(product)} className="flex-1 sm:flex-none px-3 py-2 rounded bg-black text-white hover:opacity-90 text-xs sm:text-sm">Imprimir</button>
                    <button onClick={closeQrModal} className="flex-1 sm:flex-none px-3 py-2 border rounded text-gray-700 hover:bg-gray-50 text-xs sm:text-sm">Cerrar</button>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}



