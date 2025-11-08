import React, { useEffect, useMemo, useState } from 'react'
import { useConfig } from '../contexts/ConfigContext'
import { supabase, type GarmentRecord } from '../lib/supabaseClient'

type Modification = {
  id: string
  name: string
  description?: string
  unitPrice: number
  quantity: number
  subtotal: number
}

type QuoteItem = {
  id: string
  description: string
  retailPrice: number // valor prenda al detal
  unitDiscount: number // valor unitario descuento
  quantity: number
  total: number
  modifications: Modification[]
  imageUrl?: string
}

type SavedQuote = {
  id: string
  numero_cotizacion: string | null
  datos_cliente: any
  envio: any
  resumen_pedido: any
  subtotal: number
  costo_envio: number
  total: number
  notas_cliente: string | null
  estado: string
  created_at: string
  updated_at: string
}

export function Quotes() {
  const { formatCurrency } = useConfig()

  const [customerNotes, setCustomerNotes] = useState('')
  const [customerType, setCustomerType] = useState<'natural' | 'empresa'>('natural')
  const [customerName, setCustomerName] = useState('')
  const [customerIdNumber, setCustomerIdNumber] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyNit, setCompanyNit] = useState('')
  const [companyContact, setCompanyContact] = useState('')
  // Shipping
  const [shippingDestination, setShippingDestination] = useState('')
  const [shippingCost, setShippingCost] = useState<number>(0)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [logoBase64, setLogoBase64] = useState<string>('')
  // Saved quotes
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([])
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(true)
  const [selectedQuote, setSelectedQuote] = useState<SavedQuote | null>(null)
  const [modalPosition, setModalPosition] = useState({ top: 0 })
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  // Función para actualizar el estado de una cotización
  async function updateQuoteStatus(quoteId: string, newStatus: string) {
    setUpdatingStatus(quoteId)
    try {
      const { error } = await supabase
        .from('cotizaciones')
        .update({ estado: newStatus })
        .eq('id', quoteId)
      
      if (error) {
        console.error('Error al actualizar estado:', error)
        alert('Error al actualizar el estado de la cotización')
        setUpdatingStatus(null)
        return
      }

      // Actualizar el estado local
      setSavedQuotes(prev => prev.map(quote => 
        quote.id === quoteId ? { ...quote, estado: newStatus } : quote
      ))

      // Si la cotización seleccionada es la que se actualizó, actualizarla también
      if (selectedQuote && selectedQuote.id === quoteId) {
        setSelectedQuote({ ...selectedQuote, estado: newStatus })
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error)
      alert('Error al actualizar el estado de la cotización')
    } finally {
      setUpdatingStatus(null)
    }
  }

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

  // Inventory picker state
  interface VariantStock {
    color: string
    size: string
    qty: number
    id: string
    sku: string
    imageUrl?: string
  }

  interface InventoryItem {
    id: string
    name: string
    sku: string
    price: number
    imageUrl?: string
    variants: VariantStock[]
  }

  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [invQuery, setInvQuery] = useState('')
  const [showInventoryPicker, setShowInventoryPicker] = useState(false)

  // Lock background scroll when modal is open so the backdrop covers entire page
  useEffect(() => {
    if (showInventoryPicker || selectedQuote) {
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      // Calcular posición del modal basada en el scroll actual
      const scrollY = window.scrollY
      const viewportHeight = window.innerHeight
      const centerY = scrollY + viewportHeight / 2
      setModalPosition({ top: Math.max(32, centerY) })
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }
  }, [showInventoryPicker, selectedQuote])

  // Cargar cotizaciones guardadas
  useEffect(() => {
    async function loadQuotes() {
      setIsLoadingQuotes(true)
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Error al cargar cotizaciones:', error)
        setIsLoadingQuotes(false)
        return
      }
      if (data) {
        setSavedQuotes(data as SavedQuote[])
      }
      setIsLoadingQuotes(false)
    }
    loadQuotes()
  }, [])

  useEffect(() => {
    async function loadFromDb() {
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .order('created_at', { ascending: false })
      if (error || !data) return
      
      // Group garments by name
      const groupedMap = new Map<string, InventoryItem>()
      
      const allGarmentsData = data as unknown as GarmentRecord[]
      allGarmentsData.forEach(g => {
        const name = g.name
        const price = Number(g.price) || 0
        
        if (groupedMap.has(name)) {
          // Add variant to existing product
          const existing = groupedMap.get(name)!
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
            price: price,
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
      
      const items: InventoryItem[] = Array.from(groupedMap.values())
      setInventory(items)
    }
    loadFromDb()
  }, [])

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + calcItemTotal(it), 0)
  }, [items])

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal + (Number(shippingCost) || 0))
  }, [subtotal, shippingCost])

  function calcItemTotal(item: QuoteItem): number {
    const base = Math.max(0, (item.retailPrice - item.unitDiscount)) * item.quantity
    const mods = item.modifications.reduce((s, m) => s + (m.unitPrice * m.quantity), 0)
    return Math.max(0, base + mods)
  }

  function formatNumberPlain(value: number): string {
    if (!isFinite(value)) return '0'
    return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  function updateItem(id: string, patch: Partial<QuoteItem>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  function addItem() {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      description: '',
      retailPrice: 0,
      unitDiscount: 0,
      quantity: 1,
      total: 0,
      modifications: [],
      imageUrl: ''
    }])
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  function addModification(itemId: string) {
    setItems(prev => prev.map(it => it.id === itemId ? {
      ...it,
      modifications: [...it.modifications, {
        id: crypto.randomUUID(),
        name: 'Logo',
        description: 'Aplicación de logo',
        unitPrice: 0,
        quantity: 1,
        subtotal: 0
      }]
    } : it))
  }

  function updateModification(itemId: string, modId: string, patch: Partial<Modification>) {
    setItems(prev => prev.map(it => it.id === itemId ? {
      ...it,
      modifications: it.modifications.map(m => m.id === modId ? { ...m, ...patch } : m)
    } : it))
  }

  function removeModification(itemId: string, modId: string) {
    setItems(prev => prev.map(it => it.id === itemId ? {
      ...it,
      modifications: it.modifications.filter(m => m.id !== modId)
    } : it))
  }

  async function handleGenerateQuote() {
    try {
      // Preparar datos del cliente en formato JSONB
      const datosCliente = customerType === 'natural' 
        ? {
            tipo: 'natural',
            nombre: customerName || null,
            identificacion: customerIdNumber || null,
            email: customerEmail || null,
            telefono: customerPhone || null
          }
        : {
            tipo: 'empresa',
            empresa: {
              nombre: companyName || null,
              nit: companyNit || null,
              contacto: companyContact || null
            },
            email: customerEmail || null,
            telefono: customerPhone || null
          }

      // Preparar datos de envío en formato JSONB
      const envio = shippingDestination || shippingCost > 0
        ? {
            destino: shippingDestination || null,
            costo: shippingCost || 0
          }
        : null

      // Preparar resumen del pedido en formato JSONB
      const resumenPedido = {
        items: items.map(item => ({
          id: item.id,
          descripcion: item.description,
          precio_unitario: item.retailPrice,
          descuento_unitario: item.unitDiscount,
          cantidad: item.quantity,
          total: calcItemTotal(item),
          modificaciones: item.modifications.map(mod => ({
            id: mod.id,
            nombre: mod.name,
            descripcion: mod.description || null,
            precio_unitario: mod.unitPrice,
            cantidad: mod.quantity,
            subtotal: mod.subtotal
          })),
          imagen_url: item.imageUrl || null
        })),
        subtotal: subtotal,
        total: grandTotal
      }

      // Generar número de cotización (formato: COT-YYYYMMDD-HHMMSS)
      const quoteDate = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const numeroCotizacion = `COT-${quoteDate.getFullYear()}${pad(quoteDate.getMonth() + 1)}${pad(quoteDate.getDate())}-${pad(quoteDate.getHours())}${pad(quoteDate.getMinutes())}${pad(quoteDate.getSeconds())}`

      // Guardar en Supabase
      const { data, error } = await supabase
        .from('cotizaciones')
        .insert({
          numero_cotizacion: numeroCotizacion,
          datos_cliente: datosCliente,
          envio: envio,
          resumen_pedido: resumenPedido,
          subtotal: subtotal,
          costo_envio: shippingCost || 0,
          total: grandTotal,
          notas_cliente: customerNotes || null,
          estado: 'pendiente'
        })
        .select()
        .single()

      if (error) {
        console.error('Error al guardar cotización:', error)
        alert('Error al guardar la cotización. Por favor, intenta de nuevo.')
        return
      }

      // Recargar la lista de cotizaciones
      const { data: newQuotes, error: reloadError } = await supabase
        .from('cotizaciones')
        .select('*')
        .order('created_at', { ascending: false })
      if (!reloadError && newQuotes) {
        setSavedQuotes(newQuotes as SavedQuote[])
      }

      // Continuar con la generación del PDF
      const formattedDate = `${quoteDate.getFullYear()}-${pad(quoteDate.getMonth() + 1)}-${pad(quoteDate.getDate())} ${pad(quoteDate.getHours())}:${pad(quoteDate.getMinutes())}`

      const escapeHtml = (s: string) => (s || '').replace(/</g, '&lt;')

    const customerSectionHtml = (() => {
      if (customerType === 'natural') {
        const lines = [
          customerName && `<div><strong>Nombre:</strong> ${escapeHtml(customerName)}</div>`,
          customerIdNumber && `<div><strong>Documento:</strong> ${escapeHtml(customerIdNumber)}</div>`,
          customerEmail && `<div><strong>Email:</strong> ${escapeHtml(customerEmail)}</div>`,
          customerPhone && `<div><strong>Teléfono:</strong> ${escapeHtml(customerPhone)}</div>`
        ].filter(Boolean).join('')
        return lines ? `<div class="section"><div class="section-title">Datos del cliente</div><div style="font-size:14px;color:#111">${lines}</div></div>` : ''
      }
      const lines = [
        companyName && `<div><strong>Empresa:</strong> ${escapeHtml(companyName)}</div>`,
        companyNit && `<div><strong>NIT:</strong> ${escapeHtml(companyNit)}</div>`,
        companyContact && `<div><strong>Contacto:</strong> ${escapeHtml(companyContact)}</div>`,
        customerEmail && `<div><strong>Email:</strong> ${escapeHtml(customerEmail)}</div>`,
        customerPhone && `<div><strong>Teléfono:</strong> ${escapeHtml(customerPhone)}</div>`
      ].filter(Boolean).join('')
      return lines ? `<div class="section"><div class="section-title">Datos de la empresa</div><div style="font-size:14px;color:#111">${lines}</div></div>` : ''
    })()

    const rowsHtml = items.map((it, index) => {
      const baseUnit = Math.max(0, it.retailPrice - it.unitDiscount)
      const itemBaseTotal = baseUnit * it.quantity
      const modsHtml = (it.modifications || []).map(mod => {
        const modSubtotal = Math.max(0, (mod.unitPrice || 0) * (mod.quantity || 0))
        return `<tr>
                  <td style="padding:6px 8px; border-top:1px solid #eee; font-size:12px; color:#555">— ${mod.name || ''}${mod.description ? `: ${mod.description}` : ''}</td>
                  <td style="padding:6px 8px; border-top:1px solid #eee; text-align:right; font-size:12px; color:#555">${formatNumberPlain(mod.unitPrice || 0)}</td>
                  <td style="padding:6px 8px; border-top:1px solid #eee; text-align:center; font-size:12px; color:#555">${mod.quantity || 0}</td>
                  <td style="padding:6px 8px; border-top:1px solid #eee; text-align:right; font-size:12px; color:#555">${formatNumberPlain(modSubtotal)}</td>
                </tr>`
      }).join('')
      const imageCell = it.imageUrl ? `<div style="width:48px;height:48px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;background:#f3f4f6;margin-right:8px;display:inline-block;vertical-align:middle;"><img src="${it.imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>` : `<div style="width:48px;height:48px;border-radius:8px;border:1px dashed #d1d5db;background:#f9fafb;color:#9ca3af;font-size:10px;display:inline-flex;align-items:center;justify-content:center;margin-right:8px;vertical-align:middle;">IMG</div>`
      return `<tr>
                <td style="padding:10px 8px; border-top:1px solid #e5e7eb; font-weight:600;">
                  ${imageCell}<span style="vertical-align:middle;">${index + 1}. ${it.description || 'Prenda'}</span>
                </td>
                <td style="padding:10px 8px; border-top:1px solid #e5e7eb; text-align:right">${formatNumberPlain(baseUnit)}</td>
                <td style="padding:10px 8px; border-top:1px solid #e5e7eb; text-align:center">${it.quantity}</td>
                <td style="padding:10px 8px; border-top:1px solid #e5e7eb; text-align:right; font-weight:700">${formatNumberPlain(itemBaseTotal)}</td>
              </tr>` + (modsHtml ? modsHtml : '')
    }).join('')

    const shippingSectionHtml = (() => {
      const lines = [
        shippingDestination && `<div><strong>Destino:</strong> ${escapeHtml(shippingDestination)}</div>`,
        isFinite(shippingCost) && (shippingCost > 0) && `<div><strong>Costo de envío:</strong> ${formatNumberPlain(shippingCost)}</div>`
      ].filter(Boolean).join('')
      return lines ? `<div class="section"><div class="section-title">Envío</div><div style="font-size:14px;color:#111">${lines}</div></div>` : ''
    })()

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cotización</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji'; margin: 0; color: #111827; }
      .container { max-width: 800px; margin: 24px auto; padding: 0 16px; }
      .card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; }
      .header { padding: 20px 24px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
      .title { font-size: 20px; font-weight: 800; }
      .meta { font-size: 12px; color: #6b7280; }
      .section { padding: 16px 24px; }
      .section-title { font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; }
      table { width: 100%; border-collapse: collapse; }
      .totals { display: flex; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid #f3f4f6; }
      .total-box { min-width: 260px; }
      .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
      .total-row strong { font-weight: 800; }
      .print-actions { text-align: right; padding: 12px 24px; border-top: 1px solid #f3f4f6; }
      .btn { display: inline-block; padding: 8px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #111827; color: white; text-decoration: none; font-size: 12px; }
      @media print {
        .print-actions { display: none; }
        body { background: white; }
        .card { box-shadow: none; border: 0; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <div style="display:flex;align-items:center;gap:12px;">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="height:28px;width:auto;border-radius:6px;" />` : ''}
            <div>
              <div class="title">Cotización</div>
              <div class="meta">N°: ${numeroCotizacion} | Fecha: ${formattedDate}</div>
            </div>
          </div>
        </div>
        ${customerSectionHtml}
        ${shippingSectionHtml}
        ${customerNotes ? `<div class="section"><div class="section-title">Detalle del cliente</div><div style="white-space: pre-wrap; font-size: 14px; color:#111">${customerNotes.replace(/</g,'&lt;')}</div></div>` : ''}
        <div class="section">
          <div class="section-title">Detalle de prendas</div>
          <table>
            <thead>
              <tr>
                <th style="text-align:left; padding:8px; font-size:12px; color:#6b7280">Descripción</th>
                <th style="text-align:right; padding:8px; font-size:12px; color:#6b7280">Valor unit.</th>
                <th style="text-align:center; padding:8px; font-size:12px; color:#6b7280">Cant</th>
                <th style="text-align:right; padding:8px; font-size:12px; color:#6b7280">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="4" style="padding:12px; text-align:center; color:#6b7280;">Sin prendas</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="totals">
          <div class="total-box">
            <div class="total-row"><span>Subtotal</span><span><strong>${formatNumberPlain(subtotal)}</strong></span></div>
            ${shippingCost > 0 ? `<div class="total-row"><span>Envío</span><span><strong>${formatNumberPlain(shippingCost)}</strong></span></div>` : ''}
            <div class="total-row"><span><strong>Total</strong></span><span><strong>${formatNumberPlain(subtotal + (shippingCost > 0 ? shippingCost : 0))}</strong></span></div>
          </div>
        </div>
        <div class="print-actions">
          <button class="btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
        </div>
      </div>
    </div>
  </body>
</html>`

      const w = window.open('', '_blank')
      if (!w) return
      w.document.open()
      w.document.write(html)
      w.document.close()
      // Focus so user sees the preview immediately
      w.focus()
    } catch (error) {
      console.error('Error al generar cotización:', error)
      alert('Error al generar la cotización. Por favor, intenta de nuevo.')
    }
  }

  return (
    <div className="p-3 sm:p-4 text-black">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Cotizaciones</h1>
        <p className="text-xs sm:text-sm text-gray-600">Crea cotizaciones para ropa deportiva personalizada (prendas, descuentos y modificaciones como logos, estampados, bordados, etc.).</p>
      </div>

      {/* Datos del cliente */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 mb-3 sm:mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs sm:text-sm font-medium">Datos del cliente</div>
          <div className="inline-flex rounded-md p-0.5 bg-gray-100 border border-gray-200">
            <button
              className={`px-2.5 py-1 text-[11px] sm:text-xs rounded ${customerType === 'natural' ? 'bg-white border border-gray-200' : 'text-gray-600'}`}
              onClick={() => setCustomerType('natural')}
              type="button"
            >Persona natural</button>
            <button
              className={`px-2.5 py-1 text-[11px] sm:text-xs rounded ${customerType === 'empresa' ? 'bg-white border border-gray-200' : 'text-gray-600'}`}
              onClick={() => setCustomerType('empresa')}
              type="button"
            >Empresa</button>
          </div>
        </div>

        {customerType === 'natural' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block">Nombre completo</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="Nombre y apellidos" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block">Documento</label>
              <input value={customerIdNumber} onChange={e => setCustomerIdNumber(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="CC o documento" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block">Email</label>
              <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block">Teléfono</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="+57 300 000 0000" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block">Razón social</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="Nombre de la empresa" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block">NIT</label>
              <input value={companyNit} onChange={e => setCompanyNit(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="NIT" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block">Contacto</label>
              <input value={companyContact} onChange={e => setCompanyContact(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="Nombre del contacto" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block">Email</label>
              <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="correo@empresa.com" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block">Teléfono</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="+57 300 000 0000" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 mb-3 sm:mb-4">
        <div className="text-xs sm:text-sm font-medium mb-2">Detalle de lo que quiere el cliente</div>
        <textarea
          value={customerNotes}
          onChange={e => setCustomerNotes(e.target.value)}
          className="w-full border rounded px-2 py-2 text-xs sm:text-sm text-black bg-white min-h-[80px]"
          placeholder="Describe color, tallas, técnicas (logo, serigrafía, bordado), ubicaciones, etc."
        />
        <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button className="flex-1 sm:flex-none border rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap" onClick={() => setShowInventoryPicker(true)}>Agregar desde inventario</button>
          <button className="flex-1 sm:flex-none border rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap" onClick={addItem}>Agregar prenda manual</button>
        </div>
      </div>

      {/* Envío */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 mb-3 sm:mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs sm:text-sm font-medium">Envío</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <label className="text-[10px] text-gray-600 mb-1 block">Destino</label>
            <input value={shippingDestination} onChange={e => setShippingDestination(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black" placeholder="Ciudad, dirección o punto de entrega" />
          </div>
          <div>
            <label className="text-[10px] text-gray-600 mb-1 block">Costo de envío</label>
            <input
              inputMode="decimal"
              value={String(shippingCost)}
              onChange={e => setShippingCost(Number((e.target.value||'').replace(/[^0-9.]/g,'')||0))}
              className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-right"
              placeholder="0"
            />
          </div>
        </div>
        {shippingCost > 0 && (
          <div className="mt-2 text-right text-xs sm:text-sm text-gray-700">Se sumará <span className="font-semibold">{formatNumberPlain(shippingCost)}</span> al total.</div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Card Header */}
        <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">Resumen del pedido</h2>
            <p className="text-xs text-gray-500">Detalle de ítems y modificaciones</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-[11px] sm:text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
            Total: {formatNumberPlain(grandTotal)}
          </span>
        </div>

        <div className="p-2 sm:p-3">
        {/* Desktop Header */}
        <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700 border-b pb-2">
          <div className="col-span-4">Descripción</div>
          <div className="col-span-2 text-right">Valor detal</div>
          <div className="col-span-2 text-right">Desc. unitario</div>
          <div className="col-span-1 text-center">Cant</div>
          <div className="col-span-3 text-right">Total</div>
        </div>

        {items.map(item => (
          <div key={item.id} className="border-b py-2 sm:py-3 last:border-b-0">
            {/* Desktop Grid View */}
            <div className="hidden md:grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <div className="flex items-start gap-2">
                  {item.imageUrl ? (
                    <div className="w-12 h-12 rounded border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt={item.description || 'Producto'} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded border border-dashed border-gray-300 overflow-hidden flex-shrink-0 bg-gray-50 text-[10px] text-gray-400 flex items-center justify-center">IMG</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <input
                      value={item.description}
                      onChange={e => updateItem(item.id, { description: e.target.value })}
                      placeholder="Prenda (ej. Camiseta deportiva)"
                      className="w-full border rounded px-2 py-1 text-xs sm:text-sm bg-white text-black"
                    />
                    <input
                      value={item.imageUrl || ''}
                      onChange={e => updateItem(item.id, { imageUrl: e.target.value })}
                      placeholder="URL imagen (opcional)"
                      className="mt-1 w-full border rounded px-2 py-1 bg-white text-black text-[10px] sm:text-xs"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => {
                          updateItem(item.id, { imageUrl: String(reader.result || '') })
                        }
                        reader.readAsDataURL(file)
                      }}
                      className="mt-1 w-full border rounded px-2 py-1 bg-white text-black text-[10px] sm:text-xs"
                    />
                  </div>
                </div>
              </div>
              <div className="col-span-2 text-right">
                <input
                  inputMode="decimal"
                  value={String(item.retailPrice)}
                  onChange={e => updateItem(item.id, { retailPrice: Number((e.target.value||'').replace(/[^0-9.]/g,'')||0) })}
                  className="w-full border rounded px-2 py-1 text-xs bg-white text-right"
                  placeholder="0"
                />
              </div>
              <div className="col-span-2 text-right">
                <input
                  inputMode="decimal"
                  value={String(item.unitDiscount)}
                  onChange={e => updateItem(item.id, { unitDiscount: Number((e.target.value||'').replace(/[^0-9.]/g,'')||0) })}
                  className="w-full border rounded px-2 py-1 text-xs bg-white text-right"
                  placeholder="0"
                />
              </div>
              <div className="col-span-1 text-center">
                <input
                  inputMode="numeric"
                  value={String(item.quantity)}
                  onChange={e => updateItem(item.id, { quantity: Math.max(1, Number((e.target.value||'').replace(/[^0-9]/g,'')||1)) })}
                  className="w-full border rounded px-2 py-1 text-xs bg-white text-center"
                />
              </div>
              <div className="col-span-3 text-right font-semibold text-xs sm:text-sm">
                {formatNumberPlain(Math.max(0, (item.retailPrice - item.unitDiscount)) * item.quantity)}
              </div>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              <div className="flex items-start gap-2">
                {item.imageUrl ? (
                  <div className="w-16 h-16 rounded border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-100">
                    <img src={item.imageUrl} alt={item.description || 'Producto'} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded border border-dashed border-gray-300 overflow-hidden flex-shrink-0 bg-gray-50 text-[10px] text-gray-400 flex items-center justify-center">IMG</div>
                )}
                <div className="flex-1 min-w-0">
                  <input
                    value={item.description}
                    onChange={e => updateItem(item.id, { description: e.target.value })}
                    placeholder="Prenda (ej. Camiseta deportiva)"
                    className="w-full border rounded px-2 py-1.5 text-xs sm:text-sm bg-white text-black"
                  />
                  <input
                    value={item.imageUrl || ''}
                    onChange={e => updateItem(item.id, { imageUrl: e.target.value })}
                    placeholder="URL imagen (opcional)"
                    className="mt-1 w-full border rounded px-2 py-1 bg-white text-black text-[10px]"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => {
                        updateItem(item.id, { imageUrl: String(reader.result || '') })
                      }
                      reader.readAsDataURL(file)
                    }}
                    className="mt-1 w-full border rounded px-2 py-1 bg-white text-black text-[10px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-600 mb-1 block">Valor detal</label>
                  <input
                    inputMode="decimal"
                    value={String(item.retailPrice)}
                    onChange={e => updateItem(item.id, { retailPrice: Number((e.target.value||'').replace(/[^0-9.]/g,'')||0) })}
                    className="w-full border rounded px-2 py-1.5 text-xs bg-white text-right"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 mb-1 block">Desc. unitario</label>
                  <input
                    inputMode="decimal"
                    value={String(item.unitDiscount)}
                    onChange={e => updateItem(item.id, { unitDiscount: Number((e.target.value||'').replace(/[^0-9.]/g,'')||0) })}
                    className="w-full border rounded px-2 py-1.5 text-xs bg-white text-right"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 mb-1 block">Cantidad</label>
                  <input
                    inputMode="numeric"
                    value={String(item.quantity)}
                    onChange={e => updateItem(item.id, { quantity: Math.max(1, Number((e.target.value||'').replace(/[^0-9]/g,'')||1)) })}
                    className="w-full border rounded px-2 py-1.5 text-xs bg-white text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 mb-1 block">Total</label>
                  <div className="w-full border rounded px-2 py-1.5 text-xs bg-gray-50 text-right font-semibold">
                    {formatNumberPlain(Math.max(0, (item.retailPrice - item.unitDiscount)) * item.quantity)}
                  </div>
                </div>
              </div>
            </div>

            {/* Modificaciones */}
            <div className="mt-3 sm:mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] sm:text-xs font-semibold text-gray-900">Modificaciones</h3>
                <button className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-[11px] sm:text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50" onClick={() => addModification(item.id)}>Agregar modificación</button>
              </div>

              {item.modifications.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-[11px] sm:text-xs font-medium text-gray-900">Sin modificaciones aún</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">Agrega una modificación para verla aquí.</p>
                </div>
              )}

              {item.modifications.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  {/* Desktop Header */}
                  <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] text-gray-600 bg-gray-50 border-b px-2 py-1.5">
                    <div className="col-span-4">Modificación</div>
                    <div className="col-span-4">Detalle</div>
                    <div className="col-span-2 text-right">Valor unitario</div>
                    <div className="col-span-1 text-center">Cant</div>
                    <div className="col-span-1 text-right">Subtotal</div>
                  </div>
                  <div className="divide-y divide-gray-100">
                  {item.modifications.map(mod => {
                const subtotal = Math.max(0, (mod.unitPrice || 0) * (mod.quantity || 0))
                return (
                  <div key={mod.id} className="py-2 sm:py-1">
                    {/* Desktop Grid View */}
                    <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <input
                          value={mod.name}
                          onChange={e => updateModification(item.id, mod.id, { name: e.target.value })}
                          placeholder="Logo / Serigrafía / Bordado / Numeración"
                          className="w-full border rounded px-2 py-1 text-xs bg-white text-black"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          value={mod.description || ''}
                          onChange={e => updateModification(item.id, mod.id, { description: e.target.value })}
                          placeholder="Ubicación, tamaño, color"
                          className="w-full border rounded px-2 py-1 text-xs bg-white text-black"
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <input
                          inputMode="decimal"
                          value={String(mod.unitPrice)}
                          onChange={e => updateModification(item.id, mod.id, { unitPrice: Number((e.target.value||'').replace(/[^0-9.]/g,'')||0) })}
                          className="w-full border rounded px-2 py-1 text-xs bg-white text-right"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <input
                          inputMode="numeric"
                          value={String(mod.quantity)}
                          onChange={e => updateModification(item.id, mod.id, { quantity: Math.max(1, Number((e.target.value||'').replace(/[^0-9]/g,'')||1)) })}
                          className="w-full border rounded px-2 py-1 text-xs bg-white text-center"
                        />
                      </div>
                      <div className="col-span-1 text-right font-medium text-xs">
                        {formatNumberPlain(subtotal)}
                      </div>
                    </div>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-2">
                      <div>
                        <label className="text-[10px] text-gray-600 mb-1 block">Modificación</label>
                        <input
                          value={mod.name}
                          onChange={e => updateModification(item.id, mod.id, { name: e.target.value })}
                          placeholder="Logo / Serigrafía / Bordado / Numeración"
                          className="w-full border rounded px-2 py-1.5 text-xs bg-white text-black"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-600 mb-1 block">Detalle</label>
                        <input
                          value={mod.description || ''}
                          onChange={e => updateModification(item.id, mod.id, { description: e.target.value })}
                          placeholder="Ubicación, tamaño, color"
                          className="w-full border rounded px-2 py-1.5 text-xs bg-white text-black"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-600 mb-1 block">Valor unit.</label>
                          <input
                            inputMode="decimal"
                            value={String(mod.unitPrice)}
                            onChange={e => updateModification(item.id, mod.id, { unitPrice: Number((e.target.value||'').replace(/[^0-9.]/g,'')||0) })}
                            className="w-full border rounded px-2 py-1.5 text-xs bg-white text-right"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 mb-1 block">Cant</label>
                          <input
                            inputMode="numeric"
                            value={String(mod.quantity)}
                            onChange={e => updateModification(item.id, mod.id, { quantity: Math.max(1, Number((e.target.value||'').replace(/[^0-9]/g,'')||1)) })}
                            className="w-full border rounded px-2 py-1.5 text-xs bg-white text-center"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 mb-1 block">Subtotal</label>
                          <div className="w-full border rounded px-2 py-1.5 text-xs bg-gray-50 text-right font-medium">
                            {formatNumberPlain(subtotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right px-1">
                      <button className="text-[10px] sm:text-xs text-red-600" onClick={() => removeModification(item.id, mod.id)}>Eliminar</button>
                    </div>
                  </div>
                )
                  })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2 sm:mt-3 text-right">
              <button className="text-[10px] sm:text-xs text-red-600" onClick={() => removeItem(item.id)}>Eliminar prenda</button>
            </div>
          </div>
        ))}

        {/* Resumen del pedido */}
        {items.length > 0 && (
          <div className="mt-4 sm:mt-6 border-t border-gray-200 pt-3 sm:pt-4">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">Resumen del pedido</h3>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-2 font-semibold text-gray-700">Descripción</th>
                    <th className="text-right p-2 font-semibold text-gray-700">Valor detal</th>
                    <th className="text-right p-2 font-semibold text-gray-700">Desc. unitario</th>
                    <th className="text-center p-2 font-semibold text-gray-700">Cant</th>
                    <th className="text-right p-2 font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const itemBaseTotal = Math.max(0, (item.retailPrice - item.unitDiscount)) * item.quantity
                    const modificationsTotal = item.modifications.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0)
                    const itemTotal = itemBaseTotal + modificationsTotal
                    return (
                      <React.Fragment key={item.id}>
                        <tr className="border-b border-gray-100">
                          <td className="p-2 text-gray-900">{item.description || 'Sin descripción'}</td>
                          <td className="p-2 text-right text-gray-700">{formatNumberPlain(item.retailPrice)}</td>
                          <td className="p-2 text-right text-gray-700">{formatNumberPlain(item.unitDiscount)}</td>
                          <td className="p-2 text-center text-gray-700">{item.quantity}</td>
                          <td className="p-2 text-right font-semibold text-gray-900">{formatNumberPlain(itemBaseTotal)}</td>
                        </tr>
                        {item.modifications.length > 0 && item.modifications.map(mod => {
                          const modSubtotal = mod.unitPrice * mod.quantity
                          return (
                            <tr key={mod.id} className="bg-gray-50 border-b border-gray-100">
                              <td className="p-2 pl-6 text-gray-600 text-[11px]">
                                <span className="font-medium">{mod.name}</span>
                                {mod.description && <span className="text-gray-500 ml-1">- {mod.description}</span>}
                              </td>
                              <td className="p-2 text-right text-gray-600">-</td>
                              <td className="p-2 text-right text-gray-600">{formatNumberPlain(mod.unitPrice)}</td>
                              <td className="p-2 text-center text-gray-600">{mod.quantity}</td>
                              <td className="p-2 text-right text-gray-600">{formatNumberPlain(modSubtotal)}</td>
                            </tr>
                          )
                        })}
                        {item.modifications.length > 0 && (
                          <tr className="bg-gray-100">
                            <td colSpan={4} className="p-2 text-right font-medium text-gray-700">Subtotal item:</td>
                            <td className="p-2 text-right font-semibold text-gray-900">{formatNumberPlain(itemTotal)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td colSpan={4} className="p-2 text-right font-semibold text-gray-900">Total cotización:</td>
                    <td className="p-2 text-right font-bold text-lg text-gray-900">{formatNumberPlain(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {items.map(item => {
                const itemBaseTotal = Math.max(0, (item.retailPrice - item.unitDiscount)) * item.quantity
                const modificationsTotal = item.modifications.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0)
                const itemTotal = itemBaseTotal + modificationsTotal
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="font-semibold text-xs text-gray-900 mb-2">{item.description || 'Sin descripción'}</div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Valor detal:</span>
                        <span className="text-gray-900 font-medium">{formatNumberPlain(item.retailPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Desc. unitario:</span>
                        <span className="text-gray-900 font-medium">{formatNumberPlain(item.unitDiscount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cant:</span>
                        <span className="text-gray-900 font-medium">{item.quantity}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
                        <span className="text-gray-700 font-semibold">Total:</span>
                        <span className="text-gray-900 font-bold">{formatNumberPlain(itemBaseTotal)}</span>
                      </div>
                    </div>
                    {item.modifications.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-[10px] font-semibold text-gray-700 mb-2">Modificaciones:</div>
                        <div className="space-y-2">
                          {item.modifications.map(mod => {
                            const modSubtotal = mod.unitPrice * mod.quantity
                            return (
                              <div key={mod.id} className="bg-gray-50 rounded p-2 text-[10px]">
                                <div className="font-medium text-gray-900">{mod.name}</div>
                                {mod.description && <div className="text-gray-600 mt-0.5">{mod.description}</div>}
                                <div className="flex justify-between mt-1.5 pt-1.5 border-t border-gray-200">
                                  <span className="text-gray-600">Valor unit: {formatNumberPlain(mod.unitPrice)} × {mod.quantity}</span>
                                  <span className="text-gray-900 font-semibold">{formatNumberPlain(modSubtotal)}</span>
                                </div>
                              </div>
                            )
                          })}
                          <div className="flex justify-between pt-1.5 border-t border-gray-300 font-semibold text-xs">
                            <span className="text-gray-700">Subtotal item:</span>
                            <span className="text-gray-900">{formatNumberPlain(itemTotal)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">Total cotización:</span>
                  <span className="text-lg font-bold text-gray-900">{formatNumberPlain(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0">
          <button
            className="w-full sm:w-auto border rounded px-3 py-2 bg-black text-white text-xs sm:text-sm"
            onClick={handleGenerateQuote}
          >Generar cotización</button>
          <div className="text-right text-sm sm:text-base lg:text-lg font-extrabold">Total cotización: {formatNumberPlain(grandTotal)}</div>
        </div>
        </div>
      </div>

      {/* Inventory Picker Modal */}
      {showInventoryPicker && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"></div>
          <div 
            className="fixed left-0 right-0 z-50 flex justify-center p-2 sm:p-4 pointer-events-none"
            style={{ 
              top: `${modalPosition.top}px`,
              transform: 'translateY(-50%)'
            }}
          >
            <div className="w-full max-w-3xl max-h-[90vh] pointer-events-auto">
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between pb-2 sm:pb-3 mb-2 sm:mb-3 border-b border-gray-100 p-3 sm:p-4 sm:p-5">
                  <div className="font-semibold text-sm sm:text-base text-black">Seleccionar prenda del inventario</div>
                  <button onClick={() => setShowInventoryPicker(false)} className="text-gray-700 hover:text-black text-lg sm:text-xl">✕</button>
                </div>
                <div className="px-3 sm:px-4 lg:px-5 mb-3">
                  <input
                    value={invQuery}
                    onChange={e => setInvQuery(e.target.value)}
                    placeholder="Buscar por nombre o SKU"
                    className="w-full border rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white text-black"
                  />
                </div>
                <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-5 divide-y">
                  {inventory
                    .filter(it => (invQuery || '').trim() === '' || [it.name, it.sku, ...it.variants.map(v => v.sku)].some(x => (x || '').toLowerCase().includes(invQuery.toLowerCase())))
                    .map(it => (
                    <div key={it.id} className="py-3 sm:py-4 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded overflow-hidden border border-gray-200 flex items-center justify-center flex-shrink-0">
                          {it.imageUrl ? <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" /> : <div className="text-[10px] sm:text-xs text-gray-400">IMG</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs sm:text-sm text-gray-900 truncate">{it.name}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500 truncate">SKU: {it.sku}</div>
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-gray-900 flex-shrink-0">{formatNumberPlain(it.price)}</div>
                      </div>
                      
                      {/* Tallas disponibles agrupadas por color */}
                      <div className="ml-0 sm:ml-14">
                        <div className="text-[10px] sm:text-xs text-gray-600 mb-2 font-medium">Tallas disponibles:</div>
                        {(() => {
                          // Agrupar variantes por color
                          const groupedByColor = new Map<string, typeof it.variants>()
                          it.variants.forEach(variant => {
                            const color = variant.color || 'Sin color'
                            if (!groupedByColor.has(color)) {
                              groupedByColor.set(color, [])
                            }
                            groupedByColor.get(color)!.push(variant)
                          })
                          
                          return Array.from(groupedByColor.entries()).map(([color, variants]) => (
                            <div key={color} className="mb-3 last:mb-0">
                              <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1.5">Color: {color}</div>
                              <div className="flex flex-wrap gap-2">
                                {variants.map((variant, idx) => (
                                  <div key={variant.id || idx} className="flex items-center gap-1 sm:gap-2 border rounded px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                      <div className="text-[10px] sm:text-xs">
                                        <span className="font-medium text-gray-700">Talla: {variant.size}</span>
                                        <span className="text-gray-500 ml-1">| Stock: {variant.qty}</span>
                                      </div>
                                      <button
                                        className="border rounded px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs whitespace-nowrap bg-white hover:bg-gray-50 text-gray-700 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={variant.qty <= 0}
                                        onClick={() => {
                                          setItems(prev => [...prev, {
                                            id: crypto.randomUUID(),
                                            description: `${it.name} - Talla: ${variant.size}${variant.color ? `, Color: ${variant.color}` : ''}`,
                                            retailPrice: it.price,
                                            unitDiscount: 0,
                                            quantity: 1,
                                            total: 0,
                                            modifications: [],
                                            imageUrl: variant.imageUrl || it.imageUrl || ''
                                          }])
                                          setShowInventoryPicker(false)
                                        }}
                                      >
                                        {variant.qty > 0 ? 'Agregar' : 'Sin stock'}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  ))}
                  {inventory.length === 0 && (
                    <div className="text-center text-xs sm:text-sm text-gray-500 py-6">No hay prendas en inventario.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tabla de cotizaciones guardadas */}
      <div className="mt-6 sm:mt-8 bg-white rounded-lg border border-gray-200">
        <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Cotizaciones guardadas</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Historial de todas las cotizaciones generadas</p>
        </div>

        {isLoadingQuotes ? (
          <div className="p-6 text-center text-sm text-gray-500">Cargando cotizaciones...</div>
        ) : savedQuotes.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-gray-500">No hay cotizaciones guardadas aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">N° Cotización</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Cliente</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700">Total</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Fecha</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {savedQuotes.map((quote) => {
                  const clienteNombre = quote.datos_cliente?.tipo === 'natural'
                    ? quote.datos_cliente?.nombre || '—'
                    : quote.datos_cliente?.empresa?.nombre || '—'
                  const fecha = new Date(quote.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                  const estadoColors: Record<string, string> = {
                    'pendiente': 'bg-yellow-100 text-yellow-800',
                    'aprobada': 'bg-green-100 text-green-800',
                    'rechazada': 'bg-red-100 text-red-800',
                    'convertida': 'bg-blue-100 text-blue-800'
                  }
                  return (
                    <tr key={quote.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 font-medium">
                        {quote.numero_cotizacion || '—'}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700">
                        {clienteNombre}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">
                        {formatNumberPlain(quote.total)}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                        <select
                          value={quote.estado}
                          onChange={(e) => updateQuoteStatus(quote.id, e.target.value)}
                          disabled={updatingStatus === quote.id}
                          className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] sm:text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 appearance-none ${
                            estadoColors[quote.estado] || 'bg-gray-100 text-gray-800'
                          } ${updatingStatus === quote.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                          style={{
                            backgroundImage: updatingStatus !== quote.id ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='currentColor' stroke-width='2' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")` : 'none',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.5rem center',
                            paddingRight: updatingStatus !== quote.id ? '1.75rem' : '0.5rem'
                          }}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="aprobada">Aprobada</option>
                          <option value="rechazada">Rechazada</option>
                          <option value="convertida">Convertida</option>
                        </select>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
                        {fecha}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                        <button
                          onClick={() => setSelectedQuote(quote)}
                          className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          Ver detalles
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de detalles de cotización */}
      {selectedQuote && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setSelectedQuote(null)}></div>
          <div 
            className="fixed left-0 right-0 z-50 flex justify-center p-2 sm:p-4 pointer-events-none overflow-y-auto"
            style={{ 
              top: `${modalPosition.top}px`,
              transform: 'translateY(-50%)'
            }}
          >
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto pointer-events-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Detalle de cotización</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    {selectedQuote.numero_cotizacion || 'Sin número'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Información general */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-600">Fecha de creación</label>
                    <p className="text-sm sm:text-base text-gray-900 mt-1">
                      {new Date(selectedQuote.created_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-600">Estado</label>
                    <p className="text-sm sm:text-base text-gray-900 mt-1 capitalize">{selectedQuote.estado}</p>
                  </div>
                </div>

                {/* Datos del cliente */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Datos del cliente</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {selectedQuote.datos_cliente?.tipo === 'natural' ? (
                      <>
                        <div>
                          <label className="text-xs sm:text-sm font-medium text-gray-600">Tipo</label>
                          <p className="text-sm sm:text-base text-gray-900 mt-1">Persona natural</p>
                        </div>
                        {selectedQuote.datos_cliente?.nombre && (
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-600">Nombre</label>
                            <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.datos_cliente.nombre}</p>
                          </div>
                        )}
                        {selectedQuote.datos_cliente?.identificacion && (
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-600">Documento</label>
                            <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.datos_cliente.identificacion}</p>
                          </div>
                        )}
                        {selectedQuote.datos_cliente?.email && (
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-600">Email</label>
                            <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.datos_cliente.email}</p>
                          </div>
                        )}
                        {selectedQuote.datos_cliente?.telefono && (
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-600">Teléfono</label>
                            <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.datos_cliente.telefono}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs sm:text-sm font-medium text-gray-600">Tipo</label>
                          <p className="text-sm sm:text-base text-gray-900 mt-1">Empresa</p>
                        </div>
                        {selectedQuote.datos_cliente?.empresa?.nombre && (
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-600">Razón social</label>
                            <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.datos_cliente.empresa.nombre}</p>
                          </div>
                        )}
                        {selectedQuote.datos_cliente?.empresa?.nit && (
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-600">NIT</label>
                            <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.datos_cliente.empresa.nit}</p>
                          </div>
                        )}
                        {selectedQuote.datos_cliente?.empresa?.contacto && (
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-600">Contacto</label>
                            <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.datos_cliente.empresa.contacto}</p>
                          </div>
                        )}
                        {selectedQuote.datos_cliente?.email && (
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-600">Email</label>
                            <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.datos_cliente.email}</p>
                          </div>
                        )}
                        {selectedQuote.datos_cliente?.telefono && (
                          <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-600">Teléfono</label>
                            <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.datos_cliente.telefono}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Envío */}
                {selectedQuote.envio && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Envío</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {selectedQuote.envio.destino && (
                        <div>
                          <label className="text-xs sm:text-sm font-medium text-gray-600">Destino</label>
                          <p className="text-sm sm:text-base text-gray-900 mt-1">{selectedQuote.envio.destino}</p>
                        </div>
                      )}
                      {selectedQuote.envio.costo > 0 && (
                        <div>
                          <label className="text-xs sm:text-sm font-medium text-gray-600">Costo de envío</label>
                          <p className="text-sm sm:text-base text-gray-900 mt-1">{formatNumberPlain(selectedQuote.envio.costo)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notas del cliente */}
                {selectedQuote.notas_cliente && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Detalle del cliente</h4>
                    <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap">{selectedQuote.notas_cliente}</p>
                  </div>
                )}

                {/* Resumen del pedido */}
                {selectedQuote.resumen_pedido && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Resumen del pedido</h4>
                    <div className="space-y-4">
                      {selectedQuote.resumen_pedido.items?.map((item: any, index: number) => (
                        <div key={item.id || index} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h5 className="text-sm sm:text-base font-semibold text-gray-900">
                                {index + 1}. {item.descripcion || 'Prenda sin descripción'}
                              </h5>
                              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm text-gray-600">
                                <div>
                                  <span className="font-medium">Precio unit:</span> {formatNumberPlain(item.precio_unitario || 0)}
                                </div>
                                <div>
                                  <span className="font-medium">Desc. unit:</span> {formatNumberPlain(item.descuento_unitario || 0)}
                                </div>
                                <div>
                                  <span className="font-medium">Cantidad:</span> {item.cantidad || 0}
                                </div>
                                <div>
                                  <span className="font-medium">Total:</span> {formatNumberPlain(item.total || 0)}
                                </div>
                              </div>
                            </div>
                            {item.imagen_url && (
                              <img src={item.imagen_url} alt={item.descripcion} className="w-16 h-16 sm:w-20 sm:h-20 rounded border border-gray-200 object-cover ml-3" />
                            )}
                          </div>
                          {item.modificaciones && item.modificaciones.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <h6 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Modificaciones:</h6>
                              <div className="space-y-1">
                                {item.modificaciones.map((mod: any, modIndex: number) => (
                                  <div key={mod.id || modIndex} className="text-xs sm:text-sm text-gray-600 bg-white rounded px-2 py-1">
                                    <span className="font-medium">{mod.nombre}</span>
                                    {mod.descripcion && <span className="text-gray-500"> - {mod.descripcion}</span>}
                                    <span className="ml-2">
                                      ({formatNumberPlain(mod.precio_unitario || 0)} × {mod.cantidad || 0} = {formatNumberPlain(mod.subtotal || 0)})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <div className="flex justify-end">
                        <div className="w-full sm:w-auto min-w-[200px] space-y-2">
                          <div className="flex justify-between text-sm sm:text-base">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold text-gray-900">{formatNumberPlain(selectedQuote.subtotal)}</span>
                          </div>
                          {selectedQuote.costo_envio > 0 && (
                            <div className="flex justify-between text-sm sm:text-base">
                              <span className="text-gray-600">Envío:</span>
                              <span className="font-semibold text-gray-900">{formatNumberPlain(selectedQuote.costo_envio)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-base sm:text-lg pt-2 border-t border-gray-300">
                            <span className="font-bold text-gray-900">Total:</span>
                            <span className="font-bold text-gray-900">{formatNumberPlain(selectedQuote.total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Quotes


