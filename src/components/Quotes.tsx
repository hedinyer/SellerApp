import { useEffect, useMemo, useState } from 'react'
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
  const [inventory, setInventory] = useState<{ id: string; name: string; sku: string; price: number; imageUrl?: string }[]>([])
  const [invQuery, setInvQuery] = useState('')
  const [showInventoryPicker, setShowInventoryPicker] = useState(false)

  // Lock background scroll when modal is open so the backdrop covers entire page
  useEffect(() => {
    if (showInventoryPicker) {
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }
  }, [showInventoryPicker])

  useEffect(() => {
    async function loadFromDb() {
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .order('created_at', { ascending: false })
      if (error || !data) return
      const list = (data as unknown as GarmentRecord[]).map(g => ({
        id: g.id,
        name: g.name,
        sku: g.sku,
        price: Number(g.price) || 0,
        imageUrl: g.image_url || undefined
      }))
      setInventory(list)
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

  function handleGenerateQuote() {
    const quoteDate = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
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
              <div class="meta">Fecha: ${formattedDate}</div>
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
        <div className="fixed inset-0 z-50 w-screen h-screen bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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
                .filter(it => (invQuery || '').trim() === '' || [it.name, it.sku].some(x => (x || '').toLowerCase().includes(invQuery.toLowerCase())))
                .map(it => (
                <div key={it.id} className="flex items-center gap-2 sm:gap-3 py-2 sm:py-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded overflow-hidden border border-gray-200 flex items-center justify-center flex-shrink-0">
                    {it.imageUrl ? <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" /> : <div className="text-[10px] sm:text-xs text-gray-400">IMG</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs sm:text-sm text-gray-900 truncate">{it.name}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500 truncate">SKU: {it.sku}</div>
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-gray-900 mr-1 sm:mr-2 flex-shrink-0">{formatNumberPlain(it.price)}</div>
                  <button
                    className="border rounded px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                    onClick={() => {
                      setItems(prev => [...prev, {
                        id: crypto.randomUUID(),
                        description: `${it.name}`,
                        retailPrice: it.price,
                        unitDiscount: 0,
                        quantity: 1,
                        total: 0,
                        modifications: [],
                        imageUrl: it.imageUrl || ''
                      }])
                      setShowInventoryPicker(false)
                    }}
                  >Agregar</button>
                </div>
              ))}
              {inventory.length === 0 && (
                <div className="text-center text-xs sm:text-sm text-gray-500 py-6">No hay prendas en inventario.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Quotes


