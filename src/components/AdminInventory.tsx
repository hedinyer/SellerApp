import { useState, useEffect } from 'react'
import './animations.css'
import './config-styles.css'
import SpotlightCard from './SpotlightCard'
import { useConfig } from '../contexts/ConfigContext'
import { supabase, type GarmentRecord, type SolicitudReposicionRecord } from '../lib/supabaseClient'
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  AlertTriangleIcon,
  SaveIcon,
  XIcon,
  DollarSignIcon,
  ClockIcon,
  BellIcon,
  TrendingUpIcon,
  FilterIcon,
  SearchIcon,
  ShoppingCartIcon,
  HistoryIcon,
  MinusIcon
} from './icons'
import { LineChart, Line, ResponsiveContainer, CartesianGrid, YAxis, XAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'

interface InventoryItem {
  id: string
  name: string
  sku: string
  category: string
  brand: string | null
  color: string
  size: string
  currentStock: number
  minStock: number
  maxStock: number
  unit: string
  price: number
  cost: number | null
  supplier: string
  lastUpdated: string
  status: 'disponible' | 'bajo' | 'agotado'
  location: string
  expirationDate?: string
  lastMovement?: string
  avgConsumption: number // ventas promedio por semana
  imageUrl?: string
  description?: string
}

interface ReposicionItem {
  id: string
  garment_id: string
  sku: string
  producto_nombre: string
  cantidad_actual: number
  umbral: number
  cantidad_solicitada: number | null
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'
  solicitado_por: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

interface InventoryStats {
  totalItems: number
  totalValue: number
  totalCost: number
  lowStockItems: number
  outOfStockItems: number
  expiringItems: number
  avgTurnover: number
  inventoryEfficiency: number
  wasteValue: number
  itemsByCategory: { [key: string]: number }
  stockByCategory: { [key: string]: number }
  valueByCategory: { [key: string]: number }
}

export function AdminInventory() {
  const [isLoading, setIsLoading] = useState(true)
  const [activeView, setActiveView] = useState<'analytics' | 'inventory' | 'alerts'>('analytics')
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [reposiciones, setReposiciones] = useState<ReposicionItem[]>([])
  const { formatCurrency, getFontSizeClass } = useConfig()
  
  // Cargar datos desde Supabase
  useEffect(() => {
    loadInventory()
    loadReposiciones()
  }, [])

  // Realtime listener para actualizar inventario automáticamente
  useEffect(() => {
    const channel = supabase
      .channel('realtime:garments-inventory')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'garments' 
      }, (payload: any) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
          loadInventory()
        }
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch (_) { /* no-op */ }
    }
  }, [])

  // Realtime listener para solicitudes de reposición
  useEffect(() => {
    const channel = supabase
      .channel('realtime:solicitudes-reposicion')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'solicitudes_reposicion' 
      }, (payload: any) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
          loadReposiciones()
        }
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch (_) { /* no-op */ }
    }
  }, [])

  async function loadInventory() {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .eq('status', 'activo')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error cargando inventario:', error)
        return
      }

      if (data) {
        const mapped: InventoryItem[] = data.map((g: GarmentRecord) => ({
          id: g.id,
          name: g.name,
          sku: g.sku,
          category: g.category,
          brand: g.brand,
          color: g.color,
          size: g.size,
          currentStock: g.qty,
          minStock: g.low_stock_threshold,
          maxStock: g.low_stock_threshold * 4, // Estimar maxStock basado en threshold
          unit: 'unidades',
          price: Number(g.price),
          cost: g.cost ? Number(g.cost) : null,
          supplier: g.brand || 'Sin marca',
          lastUpdated: g.updated_at || g.created_at || new Date().toISOString(),
          status: g.qty === 0 ? 'agotado' as const : 
                 g.qty <= g.low_stock_threshold ? 'bajo' as const : 'disponible' as const,
          location: 'Estante General',
          avgConsumption: 1, // TODO: Calcular desde ventas reales
          imageUrl: g.image_url || undefined,
          description: g.description || undefined
        }))
        setInventory(mapped)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadReposiciones() {
    try {
      const { data, error } = await supabase
        .from('solicitudes_reposicion')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error cargando reposiciones:', error)
        return
      }

      if (data) {
        setReposiciones(data as ReposicionItem[])
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  // Datos ampliados del inventario
  const [inventory, setInventory] = useState<InventoryItem[]>([])


  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    category: 'Otros',
    unit: 'unidades',
    status: 'disponible',
    lastUpdated: new Date().toISOString().split('T')[0],
    avgConsumption: 1,
    location: 'Estante General'
  })


  // Cálculo de estadísticas avanzadas
  const inventoryStats: InventoryStats = {
    totalItems: inventory.length,
    totalValue: inventory.reduce((sum, item) => sum + (item.currentStock * item.price), 0),
    totalCost: inventory.reduce((sum, item) => sum + (item.currentStock * (item.cost || 0)), 0),
    lowStockItems: inventory.filter(item => item.status === 'bajo').length,
    outOfStockItems: inventory.filter(item => item.status === 'agotado').length,
    expiringItems: inventory.filter(item => item.status === 'bajo').length,
    avgTurnover: inventory.reduce((sum, item) => sum + item.avgConsumption, 0) / inventory.length,
    inventoryEfficiency: inventory.filter(item => item.currentStock > 0).length / inventory.length * 100,
    wasteValue: 0, // TODO: Calcular desde pérdidas reales si se implementa
    itemsByCategory: inventory.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1
      return acc
    }, {} as { [key: string]: number }),
    stockByCategory: inventory.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.currentStock
      return acc
    }, {} as { [key: string]: number }),
    valueByCategory: inventory.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + (item.currentStock * item.price)
      return acc
    }, {} as { [key: string]: number })
  }

  const categoryColors = {
    'Camisetas': '#3b82f6',
    'Pantalones': '#8b5cf6',
    'Zapatos': '#f59e0b',
    'Accesorios': '#10b981',
    'Chaquetas': '#ef4444',
    'Vestidos': '#ec4899',
    'Ropa Interior': '#06b6d4',
    'Otros': '#6b7280'
  }

  const categoryNames = {
    'Camisetas': 'Camisetas',
    'Pantalones': 'Pantalones',
    'Zapatos': 'Zapatos',
    'Accesorios': 'Accesorios',
    'Chaquetas': 'Chaquetas',
    'Vestidos': 'Vestidos',
    'Ropa Interior': 'Ropa Interior',
    'Otros': 'Otros'
  }

  // Datos para gráficos
  const chartDataValue = [
    { v: 15200 }, { v: 14800 }, { v: 15600 }, { v: 14200 }, { v: 15800 }, { v: inventoryStats.totalValue }, { v: 16200 }
  ]
  const chartDataEfficiency = [
    { v: 85 }, { v: 88 }, { v: 82 }, { v: 90 }, { v: 87 }, { v: inventoryStats.inventoryEfficiency }, { v: 89 }
  ]
  const chartDataTurnover = [
    { v: 3.2 }, { v: 3.8 }, { v: 2.9 }, { v: 4.1 }, { v: 3.5 }, { v: inventoryStats.avgTurnover }, { v: 3.7 }
  ]
  const chartDataCost = [
    { v: 11200 }, { v: 10800 }, { v: 11600 }, { v: 10200 }, { v: 11800 }, { v: inventoryStats.totalCost }, { v: 12200 }
  ]

  const daysLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  // Funciones de utilidad
  const getLowStockItems = () => {
    return inventory.filter(item => item.status === 'bajo' || item.status === 'agotado')
      .sort((a, b) => {
        if (a.status === 'agotado' && b.status !== 'agotado') return -1
        if (b.status === 'agotado' && a.status !== 'agotado') return 1
        return (a.currentStock / a.maxStock) - (b.currentStock / b.maxStock)
      })
  }

  const lowStockAlerts = getLowStockItems()

  // Funciones de manejo
  const handleAddItem = async () => {
    if (newItem.name && newItem.currentStock !== undefined && newItem.price && newItem.cost !== undefined) {
      try {
        const sku = `SKU-${Date.now()}`
        const payload = {
          name: newItem.name,
          sku: sku,
          category: newItem.category || 'Otros',
          brand: newItem.supplier || null,
          color: 'N/A', // TODO: Agregar campo de color en el formulario
          size: 'N/A', // TODO: Agregar campo de tamaño en el formulario
          price: newItem.price,
          cost: newItem.cost,
          status: 'activo' as const,
          qty: newItem.currentStock,
          low_stock_threshold: newItem.minStock || 5,
          image_url: null,
          description: newItem.description || null
        }

        const { data, error } = await supabase
          .from('garments')
          .insert(payload)
          .select()
          .single()

        if (error) {
          console.error('Error agregando producto:', error)
          alert('Error al agregar producto: ' + error.message)
          return
        }

        // Recargar inventario
        await loadInventory()
        setNewItem({
          category: 'Otros',
          unit: 'unidades',
          status: 'disponible',
          lastUpdated: new Date().toISOString().split('T')[0],
          avgConsumption: 1,
          location: 'Estante General'
        })
        setIsAddItemOpen(false)
        setCurrentStep(1)
      } catch (err) {
        console.error('Error:', err)
        alert('Error al agregar producto')
      }
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return
    
    try {
      const { error } = await supabase
        .from('garments')
        .update({ status: 'descatalogado' })
        .eq('id', id)

      if (error) {
        console.error('Error eliminando producto:', error)
        alert('Error al eliminar producto: ' + error.message)
        return
      }

      // Recargar inventario
      await loadInventory()
    } catch (err) {
      console.error('Error:', err)
      alert('Error al eliminar producto')
    }
  }


  // Filtrar items
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <div 
      className={`min-h-screen bg-gray-50 transition-opacity duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      } ${getFontSizeClass()}`} 
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <div className="p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6 lg:mb-8 animate-fadeInSlide">
          <h1 className="text-lg lg:text-xl font-bold text-gray-900">Gestión de Inventario - Tienda de Ropa</h1>
          <p className="text-xs lg:text-sm text-gray-600 font-normal mt-1">
            Control de stock, análisis de ventas y reposiciones de productos
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex justify-center">
            <nav className="bg-white rounded-[12px] shadow-sm flex px-1 py-1 gap-1">
              {[
                { id: 'analytics', label: 'Analytics', icon: <TrendingUpIcon size={16} /> },
                { id: 'inventory', label: 'Inventario', icon: <ShoppingCartIcon size={16} /> },
                { id: 'alerts', label: 'Alertas', icon: <BellIcon size={16} /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as any)}
                  className={`px-3 py-2 rounded-[8px] font-semibold text-sm transition-all duration-200 flex items-center gap-2
                    ${activeView === tab.id
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
                  `}
                  style={{ minWidth: 90 }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Analytics View */}
        {activeView === 'analytics' && (
          <>
            {/* Critical Alerts */}
            {(inventoryStats.outOfStockItems > 0 || inventoryStats.expiringItems > 0) && (
              <div className="flex justify-center mb-8">
                <div className="bg-red-50 border border-red-200 rounded-[8px] p-4 animate-slideInUp" style={{ animationDelay: '0ms' }}>
                  <div className="flex items-center justify-center text-center">
                    <AlertTriangleIcon size={18} className="text-red-500 mr-3" />
                    <div>
                      <h3 className="text-red-800 font-medium text-sm">¡Atención! Inventario Crítico</h3>
                      <p className="text-red-700 text-xs mt-1">
                        {inventoryStats.outOfStockItems} producto(s) agotado(s) • {inventoryStats.expiringItems} producto(s) con stock bajo
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Metrics */}
            <div className="relative rounded-[16px] border border-gray-200 shadow-sm mb-8 lg:mb-10 p-4 lg:p-6 overflow-hidden bg-white">
              <div className="relative z-10">
                <div className="mb-4">
                  <h2 className="text-lg lg:text-xl font-bold text-gray-900">Métricas de Inventario Avanzadas</h2>
                  <p className="text-xs lg:text-sm text-gray-600 font-normal mt-1">Indicadores clave para optimización del inventario</p>
                      </div>
                <div className="grid grid-cols-2 lg:flex lg:justify-center gap-3 lg:gap-4">
                  {/* Valor Total Inventario */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(16,185,129,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-between h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Valor Total</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(inventoryStats.totalValue)}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">En inventario</p>
                          </div>
                          <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                            <ResponsiveContainer width="100%" height={48}>
                              <LineChart data={chartDataValue.map((d, i) => ({ ...d, label: daysLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                                <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

                  {/* Eficiencia de Inventario */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-between h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Eficiencia</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{inventoryStats.inventoryEfficiency.toFixed(0)}%</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Stock disponible</p>
                      </div>
                          <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                            <ResponsiveContainer width="100%" height={48}>
                              <LineChart data={chartDataEfficiency.map((d, i) => ({ ...d, label: daysLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                                <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

                  {/* Rotación Promedio */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(251,146,60,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-between h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Ventas Promedio</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{inventoryStats.avgTurnover.toFixed(1)}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Unidades/semana</p>
                      </div>
                          <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                            <ResponsiveContainer width="100%" height={48}>
                              <LineChart data={chartDataTurnover.map((d, i) => ({ ...d, label: daysLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                                <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Line type="monotone" dataKey="v" stroke="#fb923c" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

                  {/* Coste Total */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '300ms', boxShadow: '0 4px 16px 0 rgba(239,68,68,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-between h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Coste Total</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(inventoryStats.totalCost)}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Inversión actual</p>
                      </div>
                          <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                            <ResponsiveContainer width="100%" height={48}>
                              <LineChart data={chartDataCost.map((d, i) => ({ ...d, label: daysLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                                <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                    </div>
                  </div>
                </SpotlightCard>
                  </div>
                </div>
              </div>
            </div>

            {/* Análisis Completo de Inventario */}
            <div className="w-full mb-8">
              <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 animate-fadeInSlide">
                <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h2 className="text-lg lg:text-xl font-bold text-gray-900">Análisis Completo de Inventario</h2>
                    <p className="text-xs lg:text-sm text-gray-600 font-normal mt-1">Visualizaciones y métricas avanzadas para la toma de decisiones</p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                    {inventoryStats.lowStockItems > 0 && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                        {inventoryStats.lowStockItems} productos con stock bajo
                      </span>
                    )}
                    {inventoryStats.outOfStockItems > 0 && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                        {inventoryStats.outOfStockItems} productos agotados
                      </span>
                    )}
                    {inventoryStats.expiringItems > 0 && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                        {inventoryStats.expiringItems} productos con stock bajo
                      </span>
                    )}
                  </div>
                </div>

                {/* Métricas adicionales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500 mb-1">Margen promedio</span>
                    <span className="text-2xl font-bold text-green-900">
                      {(((inventoryStats.totalValue - inventoryStats.totalCost) / inventoryStats.totalValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                    <div className="flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500 mb-1">Pérdidas/Devoluciones</span>
                    <span className="text-2xl font-bold text-red-900">{formatCurrency(inventoryStats.wasteValue)}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500 mb-1">Total productos</span>
                    <span className="text-2xl font-bold text-blue-900">{inventoryStats.totalItems}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500 mb-1">Categorías activas</span>
                    <span className="text-2xl font-bold text-purple-900">{Object.keys(inventoryStats.itemsByCategory).length}</span>
                  </div>
                </div>

                {/* Gráfico de distribución por categorías */}
                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Distribución del Inventario por Categoría</h4>
                  <div className="flex flex-col items-center">
                    <div className="w-full h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(inventoryStats.valueByCategory).map(([cat, value]) => ({
                              name: categoryNames[cat as keyof typeof categoryNames] || cat,
                              value,
                              color: categoryColors[cat as keyof typeof categoryColors] || '#6b7280'
                            }))}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {Object.entries(inventoryStats.valueByCategory).map(([cat], idx) => (
                              <Cell key={cat} fill={categoryColors[cat as keyof typeof categoryColors] || '#6b7280'} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-4 justify-center">
                      {Object.entries(inventoryStats.valueByCategory).map(([cat, value]) => (
                        <div key={cat} className="flex items-center gap-2 text-xs">
                          <span 
                            className="w-3 h-3 rounded-full inline-block" 
                            style={{ backgroundColor: categoryColors[cat as keyof typeof categoryColors] || '#6b7280' }}
                          ></span>
                          <span className="font-medium text-gray-700">{categoryNames[cat as keyof typeof categoryNames] || cat}</span>
                          <span className="text-gray-500">{formatCurrency(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Gráfico de barras - Stock por categoría */}
                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Stock Actual por Categoría</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Object.entries(inventoryStats.stockByCategory).map(([cat, stock]) => ({
                      category: categoryNames[cat as keyof typeof categoryNames] || cat,
                      stock,
                      fill: categoryColors[cat as keyof typeof categoryColors] || '#6b7280'
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ef" strokeOpacity={0.5} />
                      <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip />
                      <Bar dataKey="stock" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Inventory View */}
        {activeView === 'inventory' && (
          <>
            {/* Filtros y Búsqueda */}
            <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm mb-6 p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <SearchIcon size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, SKU, marca..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                  >
                    <option value="all">Todas las categorías</option>
                    {Object.entries(categoryNames).map(([key, value]) => (
                      <option key={key} value={key}>{value}</option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="disponible">Disponible</option>
                    <option value="bajo">Stock Bajo</option>
                    <option value="agotado">Agotado</option>
                  </select>
                  <button
                    onClick={() => setIsAddItemOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm whitespace-nowrap"
                  >
                    <PlusIcon size={16} className="mr-2" />
                    Agregar Producto
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Inventario */}
            <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-base">Inventario Actual</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {filteredInventory.length} de {inventory.length} productos
                </p>
              </div>
              <div className="p-2">
                <div className="grid grid-cols-1 gap-2">
                  {filteredInventory.map((item) => {
                    const stockPercentage = ((item.currentStock) / item.maxStock) * 100
                    return (
                      <div
                        key={item.id}
                        className={`bg-white border border-gray-100 rounded-[6px] px-3 py-2 shadow-none hover:shadow-sm transition-all duration-200 group flex flex-col gap-2 text-xs ${
                          item.status === 'agotado' ? 'border-red-200 bg-red-50' :
                          item.status === 'bajo' ? 'border-yellow-200 bg-yellow-50' :
                          'border-gray-100'
                        }`}
                      >
                        {/* Información principal */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm mb-1">{item.name}</div>
                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                              <span>{item.category}</span>
                              <span>·</span>
                              <span>SKU: {item.sku}</span>
                              <span>·</span>
                              <span>{item.color} / {item.size}</span>
                              <span>·</span>
                              <span>{item.supplier}</span>
                              <span>·</span>
                              <span className={`font-bold ${
                                item.status === 'agotado' ? 'text-red-600' :
                                item.status === 'bajo' ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {item.status}
                              </span>
                              {item.expirationDate && (
                                <>
                                  <span>·</span>
                                  <span className="text-orange-600">
                                    Vence: {new Date(item.expirationDate).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                          </div>
                        </div>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="flex items-center justify-center w-7 h-7 rounded border border-gray-200 bg-white text-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 shadow-none"
                            title="Eliminar"
                          >
                            <TrashIcon size={13} />
                          </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">Stock {stockPercentage.toFixed(1)}%</span>
                            <span className="text-gray-600">
                              Ventas: {item.avgConsumption} {item.unit}/sem
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full transition-all duration-500 ${
                                item.status === 'agotado' ? 'bg-red-500' :
                                item.status === 'bajo' ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Detalles del producto */}
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                            <p className="text-xs font-bold text-blue-700">{item.currentStock} {item.unit}</p>
                            <p className="text-[10px] text-blue-600">Stock</p>
                      </div>
                          <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                            <p className="text-xs font-bold text-green-700">{formatCurrency(item.price)}</p>
                            <p className="text-[10px] text-green-600">P. Venta</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded border border-gray-200">
                            <p className="text-xs font-bold text-gray-700">{formatCurrency(item.cost || 0)}</p>
                            <p className="text-[10px] text-gray-600">Coste</p>
                          </div>
                          <div className="text-center p-2 bg-purple-50 rounded border border-purple-200">
                            <p className="text-xs font-bold text-purple-700">{formatCurrency(item.currentStock * item.price)}</p>
                            <p className="text-[10px] text-purple-600">Valor</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Alerts View */}
        {activeView === 'alerts' && (
          <div className="space-y-6">
            {/* Low Stock Alerts */}
            <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Alertas de Stock Bajo</h3>
                <p className="text-xs text-gray-600 mt-1">Productos que necesitan reposición</p>
                                </div>
              <div className="p-4">
                {lowStockAlerts.length > 0 ? (
                  <div className="space-y-4">
                    {lowStockAlerts.map((item) => (
                      <div key={item.id} className={`border-l-4 p-4 rounded-r-lg ${
                        item.status === 'agotado' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              item.status === 'agotado' ? 'bg-red-200' : 'bg-yellow-200'
                            }`}>
                              {item.status === 'agotado' ? '🚨' : '⚠️'}
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900">{item.name}</h5>
                              <p className="text-sm text-gray-600">
                                {item.category} • {item.supplier}
                              </p>
                              <p className="text-xs text-gray-500">
                                Stock actual: {item.currentStock} {item.unit} • Mínimo: {item.minStock} {item.unit}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`font-medium text-sm ${
                              item.status === 'agotado' ? 'text-red-700' : 'text-yellow-700'
                            }`}>
                              {item.status === 'agotado' ? 'Agotado' : 'Stock Bajo'}
                            </span>
                            <p className="text-xs text-gray-500">Ubicación: {item.location}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BellIcon size={48} className="mx-auto text-gray-300 mb-4" />
                    <h4 className="font-medium text-gray-900 mb-2">Todo el stock está en niveles óptimos</h4>
                    <p className="text-gray-600">No hay productos con stock bajo</p>
                  </div>
                )}
                                </div>
                              </div>

          </div>
        )}

        {/* Modal de 3 pasos para agregar producto */}
        {isAddItemOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md" style={{ minHeight: '100vh', minWidth: '100vw' }}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-2 p-0 relative animate-fadeInSlide max-h-[95vh] overflow-y-auto border border-gray-200">
                              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
                onClick={() => {
                  setIsAddItemOpen(false)
                  setCurrentStep(1)
                }}
                aria-label="Cerrar"
              >
                <XIcon size={22} />
                              </button>
              <div className="px-6 pt-6 pb-2">
                <h3 className="font-bold text-black text-lg mb-1">Agregar nuevo producto</h3>
                <p className="text-xs text-gray-700 mb-4">Paso {currentStep} de 3</p>
              </div>
              <div className="px-6 pb-6">
                {/* Paso 1: Categoría y Ubicación */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-black mb-2">Información básica</div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-2">Categoría *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(categoryNames).map(([key, value]) => (
                              <button
                            key={key}
                            onClick={() => setNewItem({...newItem, category: key})}
                            className={`py-3 px-2 border rounded-lg text-left transition-all duration-200 text-xs font-semibold ${
                              newItem.category === key 
                                ? 'border-blue-500 bg-blue-50 text-black' 
                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                            }`}
                          >
                            {value}
                              </button>
                        ))}
                            </div>
                          </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-2">Ubicación *</label>
                      <input
                        type="text"
                        value={newItem.location || ''}
                        onChange={(e) => setNewItem({...newItem, location: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                        placeholder="Ej: Estante A-1, Vitrina B-2..."
                      />
                        </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-2">Unidad de medida *</label>
                      <select
                        value={newItem.unit}
                        onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                      >
                        <option value="unidades">Unidades</option>
                        <option value="pares">Pares</option>
                        <option value="cajas">Cajas</option>
                        <option value="paquetes">Paquetes</option>
                        <option value="sets">Sets</option>
                      </select>
                      </div>
                </div>
                )}
                
                {/* Paso 2: Detalles del producto */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-black mb-2">Detalles del producto</div>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Nombre del producto *</label>
                        <input
                          type="text"
                          value={newItem.name || ''}
                          onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                          placeholder="Nombre del producto"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Marca/Proveedor *</label>
                        <input
                          type="text"
                          value={newItem.supplier || ''}
                          onChange={(e) => setNewItem({...newItem, supplier: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                          placeholder="Nombre de la marca o proveedor"
                        />
                    </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-black mb-1">Precio de venta *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newItem.price || ''}
                            onChange={(e) => setNewItem({...newItem, price: parseFloat(e.target.value)})}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-black mb-1">Coste *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newItem.cost || ''}
                            onChange={(e) => setNewItem({...newItem, cost: parseFloat(e.target.value)})}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Fin de temporada (opcional)</label>
                        <input
                          type="date"
                          value={newItem.expirationDate || ''}
                          onChange={(e) => setNewItem({...newItem, expirationDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Paso 3: Stock y confirmación */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-black mb-2">Stock y configuración</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Stock actual *</label>
                        <input
                          type="number"
                          value={newItem.currentStock || ''}
                          onChange={(e) => setNewItem({...newItem, currentStock: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                          placeholder="0"
                          min="0"
                        />
              </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Stock mínimo</label>
                        <input
                          type="number"
                          value={newItem.minStock || ''}
                          onChange={(e) => setNewItem({...newItem, minStock: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Stock máximo</label>
                        <input
                          type="number"
                          value={newItem.maxStock || ''}
                          onChange={(e) => setNewItem({...newItem, maxStock: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                          placeholder="100"
                          min="0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-1">Ventas promedio (por semana)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newItem.avgConsumption || ''}
                        onChange={(e) => setNewItem({...newItem, avgConsumption: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                        placeholder="1.0"
                        min="0"
                      />
            </div>

                    {/* Resumen */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <h4 className="text-xs font-semibold text-gray-800">Resumen del producto</h4>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">Nombre:</span>
                        <span className="font-medium text-black">{newItem.name}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">Categoría:</span>
                        <span className="font-medium text-black">{categoryNames[newItem.category as keyof typeof categoryNames]}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">Stock inicial:</span>
                        <span className="font-bold text-blue-600">{newItem.currentStock} {newItem.unit}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">Valor total:</span>
                        <span className="font-bold text-green-600">{formatCurrency((newItem.currentStock || 0) * (newItem.price || 0))}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Botones de navegación */}
                <div className="mt-6 flex justify-between">
                  <div>
                    {currentStep > 1 && (
                      <button
                        onClick={() => setCurrentStep(currentStep - 1)}
                        className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors duration-200 text-xs"
                      >
                        Anterior
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {currentStep < 3 ? (
                      <button
                        onClick={() => {
                          if (currentStep === 1 && newItem.category && newItem.location && newItem.unit) {
                            setCurrentStep(2)
                          } else if (currentStep === 2 && newItem.name && newItem.supplier && newItem.price && newItem.cost) {
                            setCurrentStep(3)
                          }
                        }}
                        disabled={
                          (currentStep === 1 && (!newItem.category || !newItem.location || !newItem.unit)) ||
                          (currentStep === 2 && (!newItem.name || !newItem.supplier || !newItem.price || !newItem.cost))
                        }
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                      >
                        Siguiente
                      </button>
                    ) : (
                      <button
                        onClick={handleAddItem}
                        disabled={!newItem.currentStock}
                        className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 flex items-center text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <SaveIcon size={14} className="mr-2" />
                        Guardar Producto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botón flotante para mobile */}
        <button
          onClick={() => setIsAddItemOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center md:hidden z-40 hover:scale-110"
        >
          <PlusIcon size={24} />
        </button>
      </div>
    </div>
  )
} 