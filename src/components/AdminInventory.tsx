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
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'category' | 'currentStock' | 'price'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { formatCurrency, getFontSizeClass } = useConfig()
  const numberFormatter = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const formatPrice = (value: number) => (Number.isFinite(value) ? numberFormatter.format(value) : value)
  
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
    category: 'PANTALONETAS',
    unit: 'unidades',
    status: 'disponible',
    lastUpdated: new Date().toISOString().split('T')[0],
    avgConsumption: 1,
    location: 'Estante General'
  })


  // Cálculo de estadísticas avanzadas
  const calculateInventoryEfficiency = () => {
    if (inventory.length === 0) return 0
    
    let totalEfficiency = 0
    let validItems = 0
    
    inventory.forEach(item => {
      // Solo calcular eficiencia si tiene valores válidos de stock mínimo y máximo
      if (item.minStock > 0 && item.maxStock > 0) {
        const currentStock = item.currentStock
        const minStock = item.minStock
        const maxStock = item.maxStock
        const optimalRange = maxStock - minStock
        
        if (optimalRange > 0) {
          let efficiency = 0
          
          if (currentStock === 0) {
            // Stock agotado: 0% de eficiencia
            efficiency = 0
          } else if (currentStock < minStock) {
            // Stock bajo: eficiencia proporcional entre 0% y 50%
            efficiency = (currentStock / minStock) * 50
          } else if (currentStock >= minStock && currentStock <= maxStock) {
            // Stock óptimo: eficiencia entre 50% y 100%
            // Stock en el mínimo = 50%, stock en el máximo = 100%
            const excessOverMin = currentStock - minStock
            efficiency = 50 + (excessOverMin / optimalRange) * 50
          } else {
            // Stock excesivo: penalizar, pero no tanto como stock bajo
            // Máximo 100% si está ligeramente por encima, decrece gradualmente
            const excessOverMax = currentStock - maxStock
            const excessRatio = excessOverMax / maxStock
            // Si excede más del 50% del máximo, empezar a penalizar más
            if (excessRatio <= 0.5) {
              efficiency = 100 - (excessRatio * 20) // Máximo 10% de penalización
            } else {
              efficiency = 90 - ((excessRatio - 0.5) * 40) // Penalización más fuerte
              efficiency = Math.max(0, efficiency) // No menos de 0%
            }
          }
          
          totalEfficiency += efficiency
          validItems++
        }
      }
    })
    
    // Si no hay items válidos, calcular eficiencia simple basada en disponibilidad
    if (validItems === 0) {
      const itemsWithStock = inventory.filter(item => item.currentStock > 0).length
      return inventory.length > 0 ? (itemsWithStock / inventory.length) * 100 : 0
    }
    
    return totalEfficiency / validItems
  }

  const inventoryStats: InventoryStats = {
    totalItems: inventory.length,
    totalValue: inventory.reduce((sum, item) => sum + (item.currentStock * item.price), 0),
    totalCost: inventory.reduce((sum, item) => sum + (item.currentStock * (item.cost || 0)), 0),
    lowStockItems: inventory.filter(item => item.status === 'bajo').length,
    outOfStockItems: inventory.filter(item => item.status === 'agotado').length,
    expiringItems: inventory.filter(item => item.status === 'bajo').length,
    avgTurnover: inventory.length > 0 ? inventory.reduce((sum, item) => sum + item.avgConsumption, 0) / inventory.length : 0,
    inventoryEfficiency: calculateInventoryEfficiency(),
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
    'PANTALONETAS': '#3b82f6',
    'CAMISETAS': '#8b5cf6',
    'SUDADERAS': '#f59e0b',
    'BUZOS': '#10b981',
    'SHORT': '#ef4444',
    'TOP': '#ec4899',
    'LYCRA': '#06b6d4',
    'FALDA': '#6b7280'
  }

  const categoryNames = {
    'PANTALONETAS': 'PANTALONETAS',
    'CAMISETAS': 'CAMISETAS',
    'SUDADERAS': 'SUDADERAS',
    'BUZOS': 'BUZOS',
    'SHORT': 'SHORT',
    'TOP': 'TOP',
    'LYCRA': 'LYCRA',
    'FALDA': 'FALDA'
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
          category: newItem.category || 'PANTALONETAS',
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
          category: 'PANTALONETAS',
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


  // Filtrar y ordenar items
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus
    
    return matchesSearch && matchesCategory && matchesStatus
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    let av: any, bv: any
    
    if (sortBy === 'name') {
      av = a.name
      bv = b.name
    } else if (sortBy === 'sku') {
      av = a.sku
      bv = b.sku
    } else if (sortBy === 'category') {
      av = a.category
      bv = b.category
    } else if (sortBy === 'currentStock') {
      av = a.currentStock
      bv = b.currentStock
    } else if (sortBy === 'price') {
      av = a.price
      bv = b.price
    }
    
    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * dir
    }
    return String(av).localeCompare(String(bv)) * dir
  })

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / pageSize))
  const pageData = filteredInventory.slice((page - 1) * pageSize, page * pageSize)

  function toggleSort(key: 'name' | 'sku' | 'category' | 'currentStock' | 'price') {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

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
        <div className="mb-4 flex flex-wrap gap-2 justify-center">
          {[
            { id: 'analytics', label: 'Analytics', icon: <TrendingUpIcon size={16} /> },
            { id: 'inventory', label: 'Inventario', icon: <ShoppingCartIcon size={16} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                activeView === tab.id
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
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
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-center config-font-medium metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(16,185,129,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-center h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Valor Total</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(inventoryStats.totalValue)}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">En inventario</p>
                          </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

                  {/* Eficiencia de Inventario */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-center config-font-medium metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-center h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Eficiencia</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{inventoryStats.inventoryEfficiency.toFixed(0)}%</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Stock óptimo</p>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

                  {/* Rotación Promedio */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-center config-font-medium metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(251,146,60,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-center h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Ventas Promedio</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{inventoryStats.avgTurnover.toFixed(1)}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Unidades/semana</p>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>

                  {/* Coste Total */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-center config-font-medium metallic-bg" style={{ animationDelay: '300ms', boxShadow: '0 4px 16px 0 rgba(239,68,68,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-center h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Coste Total</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(inventoryStats.totalCost)}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Inversión actual</p>
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

                {/* Análisis por Categoría */}
                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-gray-800 mb-4">Análisis Detallado por Categoría</h4>
                  <div className="space-y-6">
                    {Object.entries(inventoryStats.itemsByCategory).map(([cat, itemCount]) => {
                      const categoryItems = inventory.filter(item => item.category === cat)
                      const categoryStock = inventoryStats.stockByCategory[cat] || 0
                      const categoryValue = inventoryStats.valueByCategory[cat] || 0
                      const categoryCost = categoryItems.reduce((sum, item) => sum + (item.currentStock * (item.cost || 0)), 0)
                      const categoryMargin = categoryValue > 0 ? ((categoryValue - categoryCost) / categoryValue) * 100 : 0
                      const lowStockCount = categoryItems.filter(item => item.status === 'bajo').length
                      const outOfStockCount = categoryItems.filter(item => item.status === 'agotado').length
                      const avgConsumption = categoryItems.length > 0 
                        ? categoryItems.reduce((sum, item) => sum + item.avgConsumption, 0) / categoryItems.length 
                        : 0

                      // Función para extraer el nombre base del producto (sin talla)
                      const getBaseProductName = (name: string): string => {
                        let baseName = name.trim()
                        
                        // Remover información de talla común en el nombre
                        // Patrones específicos para tallas (más conservador)
                        const sizePatterns = [
                          /\s*(Talla|T|Size|Tamaño)\s*[:\-]?\s*[SMLXL\d]+\s*$/i, // "Talla M", "T M", "Size L"
                          /\s*-\s*(Talla|T|Size|Tamaño)\s*[:\-]?\s*[SMLXL\d]+\s*$/i, // "- Talla M"
                          /\s*[:\-]\s*[SMLXL\d]+\s*$/i, // "- M", ": L"
                          /\s*\([SMLXL\d]+\)\s*$/i, // "(M)", "(L)"
                          /\s*\[[SMLXL\d]+\]\s*$/i, // "[M]", "[L]"
                        ]
                        
                        // Aplicar cada patrón
                        for (const pattern of sizePatterns) {
                          const before = baseName
                          baseName = baseName.replace(pattern, '').trim()
                          // Si se eliminó algo, salir del bucle para evitar eliminaciones múltiples
                          if (before !== baseName) break
                        }
                        
                        // Si el nombre termina con puntos suspensivos seguidos de espacio y posible talla, removerlos
                        baseName = baseName.replace(/\.\.\.\s*[SMLXL\d\s]*$/i, '').trim()
                        
                        // Remover espacios múltiples y limpiar
                        baseName = baseName.replace(/\s+/g, ' ').trim()
                        
                        // Si después de todo el procesamiento el nombre está vacío, usar el original
                        return baseName || name
                      }

                      // Agrupar productos por nombre base (sin talla)
                      const productsByName = new Map<string, {
                        name: string
                        value: number
                        stock: number
                        price: number
                        sku: string[]
                      }>()

                      categoryItems.forEach(item => {
                        const baseName = getBaseProductName(item.name)
                        const existing = productsByName.get(baseName)
                        
                        if (existing) {
                          existing.value += item.currentStock * item.price
                          existing.stock += item.currentStock
                          existing.sku.push(item.sku)
                        } else {
                          productsByName.set(baseName, {
                            name: baseName,
                            value: item.currentStock * item.price,
                            stock: item.currentStock,
                            price: item.price, // Precio promedio, se puede mejorar
                            sku: [item.sku]
                          })
                        }
                      })

                      // Convertir a array y ordenar por valor
                      const sortedByValue = Array.from(productsByName.values())
                        .sort((a, b) => b.value - a.value)

                      // Colores para el gráfico de pie (paleta más amplia)
                      const pieColors = [
                        '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', 
                        '#ec4899', '#06b6d4', '#6b7280', '#84cc16', '#f97316',
                        '#6366f1', '#14b8a6', '#f43f5e', '#a855f7', '#0ea5e9'
                      ]

                      // Mostrar todos los productos individualmente (sin agrupar en "Otros")
                      const totalValue = sortedByValue.reduce((sum, item) => sum + item.value, 0)

                      const pieData = sortedByValue.map(item => ({
                        name: item.name,
                        value: item.value,
                        fullName: item.name,
                        sku: item.sku.join(', ')
                      }))

                      // Para el gráfico de barras, agrupar por producto base + color
                      // Primero obtener los top 10 productos base por valor total
                      const topBarProducts = sortedByValue.slice(0, 10)
                      const topBaseNames = new Set(topBarProducts.map(p => p.name))
                      
                      // Agrupar items por producto base + color
                      const itemsByProductAndColor = new Map<string, InventoryItem[]>()
                      categoryItems.forEach(item => {
                        const baseName = getBaseProductName(item.name)
                        if (topBaseNames.has(baseName)) {
                          // Crear clave compuesta: producto + color
                          const key = `${baseName}|||${item.color || 'Sin color'}`
                          if (!itemsByProductAndColor.has(key)) {
                            itemsByProductAndColor.set(key, [])
                          }
                          itemsByProductAndColor.get(key)!.push(item)
                        }
                      })
                      
                      // Crear mapa de colores por combinación producto+color
                      const variantColorMap = new Map<string, string>()
                      let colorIndex = 0
                      
                      // Ordenar las variantes para asignar colores consistentes
                      const sortedVariants = Array.from(itemsByProductAndColor.keys()).sort()
                      sortedVariants.forEach(key => {
                        if (!variantColorMap.has(key)) {
                          variantColorMap.set(key, pieColors[colorIndex % pieColors.length])
                          colorIndex++
                        }
                      })
                      
                      // Crear datos para el gráfico de barras con todas las tallas
                      const barData: Array<{
                        name: string
                        stock: number
                        value: number
                        fullName: string
                        subcategory: string
                        color: string
                        sku: string
                        size: string
                        productName: string
                        variantKey: string
                        productColor: string
                      }> = []
                      
                      // Ordenar por producto base (para agrupar visualmente) y luego por color y talla
                      Array.from(itemsByProductAndColor.entries())
                        .sort((a, b) => {
                          const [aProduct, aColor] = a[0].split('|||')
                          const [bProduct, bColor] = b[0].split('|||')
                          
                          // Primero ordenar por producto base
                          const aProductIndex = topBarProducts.findIndex(p => p.name === aProduct)
                          const bProductIndex = topBarProducts.findIndex(p => p.name === bProduct)
                          
                          if (aProductIndex !== bProductIndex) {
                            return aProductIndex - bProductIndex
                          }
                          
                          // Si es el mismo producto, ordenar por color
                          return aColor.localeCompare(bColor)
                        })
                        .forEach(([variantKey, items]) => {
                          const [baseName, productColor] = variantKey.split('|||')
                          
                          // Ordenar items por talla
                          const sortedItems = items.sort((a, b) => {
                            // Ordenar tallas: S, M, L, XL, XXL, etc.
                            const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
                            const aSize = a.size.toUpperCase()
                            const bSize = b.size.toUpperCase()
                            const aIndex = sizeOrder.indexOf(aSize) !== -1 ? sizeOrder.indexOf(aSize) : 999
                            const bIndex = sizeOrder.indexOf(bSize) !== -1 ? sizeOrder.indexOf(bSize) : 999
                            return aIndex - bIndex
                          })
                          
                          sortedItems.forEach(item => {
                            barData.push({
                              name: item.size, // Mostrar solo la talla en el eje X
                              stock: item.currentStock,
                              value: item.currentStock * item.price,
                              fullName: `${categoryNames[cat as keyof typeof categoryNames] || cat} - ${baseName} (Color: ${productColor}, Talla: ${item.size})`,
                              subcategory: baseName,
                              color: variantColorMap.get(variantKey) || '#6b7280',
                              sku: item.sku,
                              size: item.size,
                              productName: baseName,
                              variantKey: variantKey,
                              productColor: productColor
                            })
                          })
                        })

                      return (
                        <div 
                          key={cat} 
                          className="bg-white rounded-lg border border-gray-200 p-4 lg:p-6 hover:shadow-md transition-shadow"
                        >
                          {/* Header de la categoría */}
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                            <span 
                              className="w-4 h-4 rounded-full inline-block" 
                              style={{ backgroundColor: categoryColors[cat as keyof typeof categoryColors] || '#6b7280' }}
                            ></span>
                            <h5 className="font-semibold text-gray-900 text-base">
                              {categoryNames[cat as keyof typeof categoryNames] || cat}
                            </h5>
                          </div>

                          {/* Métricas resumidas */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
                            <div className="flex flex-col">
                              <span className="text-gray-600 mb-1">Total productos</span>
                              <span className="font-semibold text-gray-900">{itemCount}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-600 mb-1">Stock total</span>
                              <span className="font-semibold text-gray-900">{categoryStock} unidades</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-600 mb-1">Valor total</span>
                              <span className="font-semibold text-green-700">{formatCurrency(categoryValue)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-600 mb-1">Margen promedio</span>
                              <span className="font-semibold text-green-700">{categoryMargin.toFixed(1)}%</span>
                            </div>
                          </div>

                          {/* Alertas */}
                          {(lowStockCount > 0 || outOfStockCount > 0) && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              {lowStockCount > 0 && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                  {lowStockCount} con stock bajo
                                </span>
                              )}
                              {outOfStockCount > 0 && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                                  {outOfStockCount} agotados
                                </span>
                              )}
                            </div>
                          )}

                          {/* Gráficos de productos individuales */}
                          {categoryItems.length > 0 && (
                            <div className="space-y-6 mt-6">
                              {/* Gráfico de Pie - Distribución de Valor */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h6 className="text-sm font-semibold text-gray-800">
                                    Distribución de Valor por Producto
                                  </h6>
                                  {pieData.length > 1 && (
                                    <span className="text-xs text-gray-500">
                                      {pieData.length} productos
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col lg:flex-row gap-4 items-center">
                                  <div className="w-full lg:w-2/5 h-72 flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Pie
                                          data={pieData}
                                          dataKey="value"
                                          nameKey="name"
                                          cx="50%"
                                          cy="50%"
                                          outerRadius={100}
                                          innerRadius={40}
                                          label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                                          labelLine={false}
                                        >
                                          {pieData.map((entry, index) => (
                                            <Cell 
                                              key={`cell-${index}`} 
                                              fill={pieColors[index % pieColors.length]}
                                              stroke="#fff"
                                              strokeWidth={2}
                                            />
                                          ))}
                                        </Pie>
                                        <Tooltip 
                                          formatter={(value: number) => formatCurrency(value)}
                                          contentStyle={{ 
                                            backgroundColor: 'white', 
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            padding: '8px'
                                          }}
                                        />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                  <div className="w-full lg:w-3/5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-2">
                                      {pieData.map((item, index) => (
                                        <div 
                                          key={index}
                                          className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:shadow-sm transition-shadow"
                                        >
                                          <div 
                                            className="w-4 h-4 rounded flex-shrink-0"
                                            style={{ backgroundColor: pieColors[index % pieColors.length] }}
                                          ></div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-gray-900 break-words" title={item.fullName}>
                                              {item.name}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              {formatCurrency(item.value)} • {((item.value / totalValue) * 100).toFixed(1)}%
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Gráficos de Barras - Stock por Producto (Cuadrícula) */}
                              <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-4">
                                  <h6 className="text-sm font-semibold text-gray-800">
                                    {categoryNames[cat as keyof typeof categoryNames] || cat} - Stock por Talla por Producto
                                  </h6>
                                  {topBarProducts.length > 0 && (
                                    <span className="text-xs text-gray-500">
                                      {topBarProducts.length} productos
                                    </span>
                                  )}
                                </div>
                                
                                {/* Cuadrícula de gráficos */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {topBarProducts.map((product, productIndex) => {
                                    // Obtener datos solo para este producto
                                    const productBarData = barData.filter(d => d.subcategory === product.name)
                                    
                                    // Obtener todas las variantes (producto + color) de este producto base
                                    const variantsForProduct = Array.from(new Set(
                                      productBarData.map(d => d.variantKey)
                                    ))
                                    
                                    // Agrupar tallas por variante (color)
                                    const variantsData = variantsForProduct.map(variantKey => {
                                      const [baseName, productColor] = variantKey.split('|||')
                                      const sizesForVariant = productBarData.filter(d => d.variantKey === variantKey)
                                      const variantStock = sizesForVariant.reduce((sum, d) => sum + d.stock, 0)
                                      const variantColor = variantColorMap.get(variantKey) || '#6b7280'
                                      
                                      return {
                                        variantKey,
                                        productColor,
                                        sizes: sizesForVariant,
                                        totalStock: variantStock,
                                        color: variantColor
                                      }
                                    })
                                    
                                    const totalStock = variantsData.reduce((sum, v) => sum + v.totalStock, 0)
                                    
                                    return (
                                      <div 
                                        key={productIndex}
                                        className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow"
                                      >
                                        {/* Título del producto */}
                                        <div className="mb-2 pb-2 border-b border-gray-200">
                                          <div className="font-semibold text-gray-900 text-xs block truncate" title={product.name}>
                                            {product.name}
                                          </div>
                                          <span className="text-xs text-gray-500">{totalStock} unidades totales</span>
                                        </div>
                                        
                                        {/* Gráfico pequeño */}
                                        {productBarData.length > 0 && (
                                          <div className="h-48 mb-3">
                                            <ResponsiveContainer width="100%" height="100%">
                                              <BarChart 
                                                data={productBarData}
                                                margin={{ top: 5, right: 5, left: 0, bottom: 40 }}
                                              >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ef" strokeOpacity={0.3} />
                                                <XAxis 
                                                  dataKey="name" 
                                                  angle={-45}
                                                  textAnchor="end"
                                                  height={50}
                                                  tick={{ fontSize: 8, fill: '#64748b' }}
                                                  interval={0}
                                                />
                                                <YAxis 
                                                  tick={{ fontSize: 9, fill: '#64748b' }}
                                                  width={30}
                                                />
                                                <Tooltip 
                                                  formatter={(value: number) => [`${value} unidades`, 'Stock']}
                                                  contentStyle={{ 
                                                    backgroundColor: 'white', 
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    padding: '6px',
                                                    fontSize: '11px'
                                                  }}
                                                  labelFormatter={(label, payload) => {
                                                    if (payload && payload.length > 0) {
                                                      const data = payload[0].payload
                                                      return `${data.productColor} - Talla ${data.size}`
                                                    }
                                                    return label
                                                  }}
                                                />
                                                <Bar 
                                                  dataKey="stock" 
                                                  radius={[3, 3, 0, 0]}
                                                >
                                                  {productBarData.map((entry, index) => (
                                                    <Cell 
                                                      key={`bar-cell-${productIndex}-${index}`}
                                                      fill={entry.color}
                                                    />
                                                  ))}
                                                </Bar>
                                              </BarChart>
                                            </ResponsiveContainer>
                                          </div>
                                        )}
                                        
                                        {/* Leyenda compacta */}
                                        <div className="space-y-1">
                                          {variantsData.map((variant, variantIndex) => (
                                            <div key={variantIndex} className="flex items-center gap-2 text-xs">
                                              <div 
                                                className="w-2.5 h-2.5 rounded flex-shrink-0"
                                                style={{ backgroundColor: variant.color }}
                                              ></div>
                                              <span className="text-gray-700 font-medium">{variant.productColor}</span>
                                              <span className="text-gray-500">({variant.totalStock})</span>
                                              <div className="flex flex-wrap gap-1 ml-auto">
                                                {variant.sizes.map((sizeItem, sizeIndex) => (
                                                  <span 
                                                    key={sizeIndex}
                                                    className="text-gray-600"
                                                  >
                                                    {sizeItem.size}:<span className="font-medium">{sizeItem.stock}</span>
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                                
                                {sortedByValue.length > 10 && (
                                  <div className="mt-4 text-xs text-gray-500 text-center">
                                    <p>Las subcategorías restantes ({sortedByValue.length - 10}) tienen menor stock</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Inventory View */}
        {activeView === 'inventory' && (
          <>
            {/* Filtros y Búsqueda */}
            <div className="bg-white border border-gray-200 rounded-[16px] mb-6 p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <SearchIcon size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, SKU, marca..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <select
                    value={filterCategory}
                    onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                  >
                    <option value="all">Todas las categorías</option>
                    {Object.entries(categoryNames).map(([key, value]) => (
                      <option key={key} value={key}>{value}</option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="disponible">Disponible</option>
                    <option value="bajo">Stock Bajo</option>
                    <option value="agotado">Agotado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Lista de Inventario */}
            <div className="bg-white border border-gray-200 rounded-[16px]">
              <div className="p-2 sm:p-3 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-gray-600">{filteredInventory.length} resultados • Página {page} de {totalPages}</div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="hidden sm:inline text-black">Filas:</span>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="border rounded px-2 py-1 bg-white text-black text-xs sm:text-sm">
                    {[10,20,50,100,200].map(n => <option key={n} value={n} className="text-black">{n}</option>)}
                  </select>
                </div>
              </div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-center text-gray-600">
                      <th className="py-2 px-3">🖼️</th>
                      <th className="py-2 px-3 cursor-pointer" onClick={() => toggleSort('name')}>Nombre</th>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3">Categoría</th>
                      <th className="py-2 px-3">Color</th>
                      <th className="py-2 px-3">Talla</th>
                      <th className="py-2 px-3 cursor-pointer" onClick={() => toggleSort('currentStock')}>Stock</th>
                      <th className="py-2 px-3 cursor-pointer" onClick={() => toggleSort('price')}>Precio</th>
                      <th className="py-2 px-3">Estado</th>
                      <th className="py-2 px-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map(item => {
                      const level = item.currentStock === 0 ? 'out' : (item.currentStock <= item.minStock ? 'low' : 'normal')
                      return (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="py-2 px-3 text-center">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded object-cover border border-gray-200 mx-auto" />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 mx-auto" />
                            )}
                          </td>
                          <td className="py-2 px-3 text-gray-900 font-medium text-center">
                            <div className="flex items-center justify-center gap-2">
                              {level !== 'normal' && <span title={level === 'low' ? 'Bajo stock' : 'Agotado'}>{level === 'low' ? '⚠️' : '❌'}</span>}
                              {item.name}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-gray-600 text-center">{item.sku}</td>
                          <td className="py-2 px-3 text-gray-600 text-center">{item.category}</td>
                          <td className="py-2 px-3 text-gray-600 text-center">{item.color}</td>
                          <td className="py-2 px-3 text-gray-600 text-center">{item.size}</td>
                          <td className={`py-2 px-3 font-semibold text-center ${
                            level === 'low' ? 'text-orange-600' : 
                            level === 'out' ? 'text-red-600' : 
                            'text-black'
                          }`}>{item.currentStock}</td>
                          <td className="py-2 px-3 text-black text-center">{formatPrice(Number(item.price))}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              item.status === 'disponible' ? 'bg-green-50 text-green-700 border border-green-200' : 
                              item.status === 'bajo' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 
                              'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {item.status === 'disponible' ? 'Disponible' : item.status === 'bajo' ? 'Bajo stock' : 'Agotado'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleDeleteItem(item.id)} className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 flex items-center gap-1"><TrashIcon size={14} /> Eliminar</button>
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
                    const level = item.currentStock === 0 ? 'out' : (item.currentStock <= item.minStock ? 'low' : 'normal')
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
                                <span className={`font-semibold ${level === 'low' ? 'text-orange-600' : level === 'out' ? 'text-red-600' : 'text-black'}`}>{item.currentStock}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div>
                            <span className="text-xs text-gray-600">Precio: </span>
                            <span className="text-sm font-semibold text-black">{formatPrice(Number(item.price))}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            item.status === 'disponible' ? 'bg-green-50 text-green-700 border border-green-200' : 
                            item.status === 'bajo' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 
                            'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {item.status === 'disponible' ? 'Disponible' : item.status === 'bajo' ? 'Bajo stock' : 'Agotado'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                          <button onClick={() => handleDeleteItem(item.id)} className="flex-1 px-2 py-1.5 border rounded text-red-600 hover:bg-red-50 text-xs flex items-center justify-center gap-1">
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
                <div className="text-gray-600">Mostrando {(page-1)*pageSize + 1}-{Math.min(page*pageSize, filteredInventory.length)} de {filteredInventory.length}</div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                  <button disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))} className="px-3 py-1.5 border rounded disabled:opacity-50 text-xs sm:text-sm text-black">Anterior</button>
                  <span className="text-xs sm:text-sm text-black">Página {page} / {totalPages}</span>
                  <button disabled={page>=totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))} className="px-3 py-1.5 border rounded disabled:opacity-50 text-xs sm:text-sm text-black">Siguiente</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Alerts View */}
        {activeView === 'alerts' && (
          <div className="space-y-6">
            {/* Low Stock Alerts */}
            <div className="bg-white border border-gray-200 rounded-[16px]">
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