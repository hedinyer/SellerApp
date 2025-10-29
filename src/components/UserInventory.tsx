import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfig } from '../contexts/ConfigContext'
import {
  SearchIcon,
  FilterIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  AlertTriangleIcon,
  DownloadIcon,
  UploadIcon,
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
  price: number
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

  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterLevel, setFilterLevel] = useState<string>('') // normal|low|out
  const [priceMin, setPriceMin] = useState<string>('')
  const [priceMax, setPriceMax] = useState<string>('')
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [sortBy, setSortBy] = useState<keyof GarmentItem>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [items, setItems] = useState<GarmentItem[]>([
    { id: '1', name: 'Camisa Oxford', sku: 'C-1024', category: 'Camisas', brand: 'UrbanFit', color: 'Blanco', size: 'M', price: 599, cost: 280, status: 'activo', qty: 8, lowStockThreshold: 5 },
    { id: '2', name: 'Jeans Slim Fit', sku: 'J-2201', category: 'Pantalones', brand: 'DenimCo', color: 'Azul', size: '32', price: 899, cost: 420, status: 'activo', qty: 2, lowStockThreshold: 5 },
    { id: '3', name: 'Vestido Floral', sku: 'V-3105', category: 'Vestidos', brand: 'Bloom', color: 'Rojo', size: 'S', price: 1299, cost: 560, status: 'activo', qty: 0, lowStockThreshold: 3 },
    { id: '4', name: 'Sudadera Unisex', sku: 'S-1540', category: 'Sudaderas', brand: 'Cozy', color: 'Negro', size: 'M', price: 899, cost: 380, status: 'activo', qty: 12, lowStockThreshold: 4 },
    { id: '5', name: 'Playera Básica', sku: 'T-0001', category: 'Playeras', brand: 'BasicX', color: 'Blanco', size: 'L', price: 299, cost: 90, status: 'activo', qty: 3, lowStockThreshold: 5 }
  ])

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<GarmentItem>>({ status: 'activo', lowStockThreshold: 5 })
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [qrForId, setQrForId] = useState<string | null>(null)
  const [scanValue, setScanValue] = useState<string>("")
  const [isScanOpen, setIsScanOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scanTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 200)
    return () => clearTimeout(t)
  }, [])

  const filtered = useMemo(() => {
    let data = items.filter(i => {
      const q = query.toLowerCase()
      const matchesQuery = !q || [i.name, i.sku, i.category, i.color, i.size, i.brand || ''].some(v => v.toLowerCase().includes(q))
      const matchesCategory = !filterCategory || i.category === filterCategory
      const matchesStatus = !filterStatus || i.status === filterStatus
      const level = i.qty === 0 ? 'out' : (i.qty <= i.lowStockThreshold ? 'low' : 'normal')
      const matchesLevel = !filterLevel || level === filterLevel
      const withinPriceMin = !priceMin || i.price >= Number(priceMin)
      const withinPriceMax = !priceMax || i.price <= Number(priceMax)
      const matchesOnlyLow = !onlyLowStock || level === 'low' || level === 'out'
      return matchesQuery && matchesCategory && matchesStatus && matchesLevel && withinPriceMin && withinPriceMax && matchesOnlyLow
    })

    data.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      const av = a[sortBy]
      const bv = b[sortBy]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })

    return data
  }, [items, query, filterCategory, filterStatus, filterLevel, priceMin, priceMax, onlyLowStock, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize)

  function toggleSort(key: keyof GarmentItem) {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('asc') }
  }

  function openCreate() {
    setEditingId(null)
    setForm({ status: 'activo', lowStockThreshold: 5 })
    setIsFormOpen(true)
  }

  function openEdit(id: string) {
    const it = items.find(x => x.id === id)
    if (!it) return
    setEditingId(id)
    setForm({ ...it })
    setIsFormOpen(true)
  }

  function handleSave() {
    if (!form.name || !form.sku || !form.category || !form.price || form.price <= 0 || (form.qty ?? -1) < 0) return
    // SKU unique check
    const skuExists = items.some(i => i.sku.toLowerCase() === (form.sku || '').toLowerCase() && i.id !== editingId)
    if (skuExists) return

    if (editingId) {
      setItems(items.map(i => i.id === editingId ? {
        ...(i as GarmentItem),
        ...form,
        name: form.name!,
        sku: form.sku!,
        category: form.category!,
        price: form.price!,
        qty: form.qty ?? 0,
        status: (form.status as InventoryStatus) || 'activo',
        lowStockThreshold: form.lowStockThreshold ?? 5,
        color: form.color || i.color,
        size: form.size || i.size
      } : i))
    } else {
      const newItem: GarmentItem = {
        id: String(Date.now()),
        name: form.name!,
        sku: form.sku!,
        category: form.category!,
        brand: form.brand || '',
        description: form.description || '',
        color: form.color || 'N/A',
        size: form.size || 'N/A',
        price: form.price!,
        cost: form.cost || 0,
        status: (form.status as InventoryStatus) || 'activo',
        qty: form.qty ?? 0,
        lowStockThreshold: form.lowStockThreshold ?? 5,
        imageUrl: form.imageUrl || '',
        variants: form.variants || []
      }
      setItems([newItem, ...items])
    }
    setIsFormOpen(false)
    setEditingId(null)
  }

  function handleDelete(id: string) {
    setDeleteConfirmId(id)
  }

  function confirmDelete() {
    if (!deleteConfirmId) return
    setItems(items.filter(i => i.id !== deleteConfirmId))
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

  function getQrUrlForSku(sku: string, size = 240) {
    const encoded = encodeURIComponent(sku)
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=${size}x${size}&margin=1`
  }

  function openQrModal(id: string) {
    setQrForId(id)
  }

  function closeQrModal() {
    setQrForId(null)
  }

  function printQr(sku: string) {
    const imgUrl = getQrUrlForSku(sku, 320)
    const w = window.open('', '_blank', 'width=360,height=420')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>QR ${sku}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff;">
      <div style="text-align:center;">
        <img src="${imgUrl}" alt="QR ${sku}" style="width:320px;height:320px;"/>
        <div style="margin-top:8px;font-family:Arial,sans-serif;color:#000;">SKU: ${sku}</div>
      </div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); window.close(); }, 200); }<\/script>
    </body></html>`)
    w.document.close()
  }

  function downloadQr(sku: string) {
    const url = getQrUrlForSku(sku, 512)
    const a = document.createElement('a')
    a.href = url
    a.download = `QR_${sku}.png`
    a.click()
  }

  function onScanSubmit() {
    const code = scanValue.trim()
    if (!code) return
    const found = items.find(i => i.sku.toLowerCase() === code.toLowerCase())
    if (found) {
      setItems(items.map(i => i.id === found.id ? { ...i, qty: (i.qty || 0) + 1 } : i))
      setScanValue('')
    } else {
      // no-op if not found; could show feedback in future
    }
  }

  async function openCameraScan() {
    // Open the modal first so the <video> exists before attaching the stream
    setIsScanOpen(true)

    // Wait a tick for the modal to render and ref to be available
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Ensure playback starts after metadata is ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
        }
      }

      const BarcodeDetectorCtor = (window as any).BarcodeDetector
      if (BarcodeDetectorCtor) {
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] })
        // Poll detection every 400ms
        const tick = async () => {
          if (!videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes && codes.length > 0) {
              const value = (codes[0].rawValue || '').trim()
              if (value) {
                handleScanResult(value)
                return
              }
            }
          } catch (_) {
            // Ignore detection errors
          }
          scanTimerRef.current = window.setTimeout(tick, 400)
        }
        scanTimerRef.current = window.setTimeout(tick, 400)
      }
    } catch (_) {
      // If camera access fails, close the modal
      setIsScanOpen(false)
    }
  }

  function handleScanResult(value: string) {
    // treat QR value as SKU
    const found = items.find(i => i.sku.toLowerCase() === value.toLowerCase())
    if (found) {
      setItems(items.map(i => i.id === found.id ? { ...i, qty: (i.qty || 0) + 1 } : i))
    }
    closeCameraScan()
  }

  function closeCameraScan() {
    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current)
      scanTimerRef.current = null
    }
    const stream = (videoRef.current?.srcObject as MediaStream | null)
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    setIsScanOpen(false)
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${getFontSizeClass()}`} style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="p-4 lg:p-6">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-black mb-2 tracking-tight">
            Inventario Dwell
          </h1>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <div className="flex-1">
            <div className="relative">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setPage(1) }}
                placeholder="Buscar por nombre, SKU, categoría, color, talla, marca"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded bg-white text-black"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }} className="px-2 py-1 border rounded bg-white text-black text-sm">
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} className="px-2 py-1 border rounded bg-white text-black text-sm">
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="descatalogado">Descatalogado</option>
              </select>
              <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setPage(1) }} className="px-2 py-1 border rounded bg-white text-black text-sm">
                <option value="">Nivel de inventario</option>
                <option value="normal">Normal</option>
                <option value="low">Bajo stock</option>
                <option value="out">Agotado</option>
              </select>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-600">Precio</span>
                <input value={priceMin} onChange={e => { setPriceMin(e.target.value); setPage(1) }} placeholder="Min" className="w-20 px-2 py-1 border rounded bg-white text-black" />
                <span>-</span>
                <input value={priceMax} onChange={e => { setPriceMax(e.target.value); setPage(1) }} placeholder="Max" className="w-20 px-2 py-1 border rounded bg-white text-black" />
              </div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={onlyLowStock} onChange={e => { setOnlyLowStock(e.target.checked); setPage(1) }} />
                Ver solo con bajo stock
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border border-gray-300 rounded px-2 py-1 bg-white">
              <input
                value={scanValue}
                onChange={e => setScanValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onScanSubmit() }}
                placeholder="Escanear/ingresar SKU y Enter"
                className="px-1 py-1 outline-none text-sm text-black bg-transparent"
              />
              <button onClick={onScanSubmit} className="text-xs px-2 py-1 rounded bg-black text-white">Añadir</button>
            </div>
            <button onClick={openCameraScan} className="px-3 py-2 border border-gray-300 rounded bg-white text-gray-800 text-sm">Escanear QR</button>
            <button onClick={importCSVTemplate} className="px-3 py-2 border border-gray-300 rounded bg-white text-gray-800 text-sm flex items-center gap-1"><DownloadIcon size={16} /> Plantilla CSV</button>
            <button onClick={exportCSV} className="px-3 py-2 border border-gray-300 rounded bg-white text-gray-800 text-sm flex items-center gap-1"><UploadIcon size={16} /> Exportar</button>
            <button onClick={openCreate} className="px-3 py-2 rounded bg-black text-white text-sm flex items-center gap-2"><PlusIcon size={16} /> Agregar Nueva Prenda</button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-600">{filtered.length} resultados • Página {page} de {totalPages}</div>
            <div className="flex items-center gap-2 text-sm">
              <span>Filas:</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="border rounded px-2 py-1 bg-white">
                {[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
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
                        <div className="w-10 h-10 bg-gray-100 rounded" />
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
                      <td className="py-2 px-3 text-black">{formatCurrency(item.price)}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.status === 'activo' ? 'bg-green-50 text-green-700 border border-green-200' : item.status === 'inactivo' ? 'bg-gray-50 text-gray-700 border border-gray-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>{item.status}</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openQrModal(item.id)} className="px-2 py-1 border rounded text-gray-700 hover:bg-gray-50 text-xs">QR</button>
                          <button onClick={() => openEdit(item.id)} className="px-2 py-1 border rounded text-gray-700 hover:bg-gray-50 flex items-center gap-1"><EditIcon size={14} /> Editar</button>
                          <button onClick={() => markAs(item.status === 'activo' ? 'inactivo' : 'activo', item.id)} className="px-2 py-1 border rounded text-gray-700 hover:bg-gray-50 text-xs">{item.status === 'activo' ? 'Desactivar' : 'Activar'}</button>
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
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <div className="text-gray-600">Mostrando {(page-1)*pageSize + 1}-{Math.min(page*pageSize, filtered.length)} de {filtered.length}</div>
            <div className="flex items-center gap-2">
              <button disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))} className="px-2 py-1 border rounded disabled:opacity-50">Anterior</button>
              <span>Página {page} / {totalPages}</span>
              <button disabled={page>=totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))} className="px-2 py-1 border rounded disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        </div>

        {/* Modal Formulario Agregar/Editar */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-2xl mx-3">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-black">{editingId ? 'Editar prenda' : 'Agregar nueva prenda'}</h3>
                  <p className="text-xs text-gray-600">Completa los campos requeridos</p>
                </div>
                <button onClick={() => { setIsFormOpen(false); setEditingId(null) }} className="text-gray-500 hover:text-gray-800"><XIcon size={20} /></button>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <input type="file" accept="image/*" className="w-full text-sm" />
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <button onClick={() => markAs('descatalogado')} className="px-3 py-2 border rounded text-gray-700 hover:bg-gray-50">Marcar descatalogado</button>
                  <button onClick={() => markAs('inactivo')} className="px-3 py-2 border rounded text-gray-700 hover:bg-gray-50">Desactivar</button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setIsFormOpen(false); setEditingId(null) }} className="px-3 py-2 border rounded text-gray-700 hover:bg-gray-50 flex items-center gap-1"><XIcon size={16} /> Cancelar</button>
                  <button onClick={handleSave} className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"><SaveIcon size={16} /> Guardar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación de eliminación */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-md mx-3 p-5">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangleIcon size={20} className="text-red-600" />
                <h4 className="font-semibold text-gray-900">¿Estás seguro?</h4>
              </div>
              <p className="text-sm text-gray-700 mb-4">Esta acción no se puede deshacer y afectará reportes históricos.</p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-2 border rounded text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={confirmDelete} className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700">Eliminar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Escaneo QR por Cámara */}
        {isScanOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-md mx-3 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">Escanear QR</h4>
                  <p className="text-xs text-gray-600">Apunta la cámara al código QR del producto</p>
                </div>
                <button onClick={closeCameraScan} className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-50">Cerrar</button>
              </div>
              <div className="relative rounded overflow-hidden border border-gray-200">
                <video ref={videoRef} className="w-full h-64 object-cover bg-black" playsInline muted autoPlay />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-8 border-2 border-white/70 rounded" />
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">Al detectar el QR, se incrementará el stock en +1 usando el SKU.</p>
            </div>
          </div>
        )}

        {/* Modal QR */}
        {qrForId && (() => {
          const product = items.find(i => i.id === qrForId)
          if (!product) return null
          const qrUrl = getQrUrlForSku(product.sku)
          return (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-sm mx-3 p-5">
                <div className="mb-3">
                  <h4 className="font-semibold text-gray-900">QR del producto</h4>
                  <p className="text-xs text-gray-600">SKU: {product.sku}</p>
                  <p className="text-xs text-gray-600">{product.name}</p>
                </div>
                <div className="flex items-center justify-center mb-4">
                  <img src={qrUrl} alt={`QR ${product.sku}`} className="w-60 h-60" />
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => downloadQr(product.sku)} className="px-3 py-2 border rounded text-gray-700 hover:bg-gray-50">Descargar</button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => printQr(product.sku)} className="px-3 py-2 rounded bg-black text-white hover:opacity-90">Imprimir</button>
                    <button onClick={closeQrModal} className="px-3 py-2 border rounded text-gray-700 hover:bg-gray-50">Cerrar</button>
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


