import { useState, useEffect } from 'react'
import './animations.css'
import './config-styles.css'
import SpotlightCard from './SpotlightCard'
import { useConfig } from '../contexts/ConfigContext'
import { supabase } from '../lib/supabaseClient'
import {
  PlusIcon,
  MinusIcon,
  TrashIcon,
  EditIcon,
  SaveIcon,
  XIcon,
  CalendarIcon,
  DollarSignIcon,
  UserIcon,
  AlertTriangleIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  TrendingUpIcon,
  CreditCardIcon,
  FilterIcon,
  SearchIcon,
  SettingsIcon
} from './icons'
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, YAxis, XAxis, Tooltip } from 'recharts'

// Interfaces principales
interface ExpenseCategory {
  id: string
  name: string
  icon: string
  color: string
  gradient: string
  type: 'operativo' | 'fijo' | 'imprevisto' | 'custom'
  isEditable: boolean
}

interface Expense {
  id: string
  categoryId: string
  description: string
  amount: number
  date: string
  type: 'unico' | 'recurrente'
  status: 'pagado' | 'pendiente' | 'programado' | 'vencido'
  dueDate?: string
  paymentMethod?: 'efectivo' | 'tarjeta' | 'transferencia' | 'cheque'
  recurring?: {
    frequency: 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'anual'
    nextDue: string
    endDate?: string
  }
  alerts?: {
    enabled: boolean
    times: ('72h' | '24h' | '1h')[]
  }
  receipt?: string
  notes?: string
  employee?: string
}

interface ExpenseStats {
  totalMonth: number
  totalYear: number
  byCategory: { [key: string]: number }
  pendingPayments: number
  overdue: number
  averageMonthly: number
  cashFlowDays: number
  projectedNext: number
}

interface AlertSettings {
  enabled: boolean
  email: boolean
  push: boolean
  times: ('72h' | '24h' | '1h')[]
}

export function AdminExpenses() {
  const [isLoading, setIsLoading] = useState(true)
  const [activeView, setActiveView] = useState<'analytics' | 'expenses' | 'alerts' | 'categories'>('analytics')
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const { formatCurrency, getFontSizeClass } = useConfig()

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  // Categorías desde base de datos (Supabase)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])

  // Gastos desde base de datos (Supabase)
  const [expenses, setExpenses] = useState<Expense[]>([])

  // Helpers para mapear registros de BD a los tipos locales
  const mapDbCategory = (r: any): ExpenseCategory => ({
    id: r.id,
    name: r.name,
    icon: r.icon || '',
    color: r.color || 'bg-gray-500',
    gradient: r.gradient || 'linear-gradient(90deg, #d1d5db 0%, #374151 100%)',
    type: r.type,
    isEditable: Boolean(r.is_editable ?? r.isEditable ?? false)
  })

  const parseJsonArray = (v: any): ('72h' | '24h' | '1h')[] => {
    if (!v) return []
    if (Array.isArray(v)) return v as any
    try { return JSON.parse(v) as any } catch { return [] }
  }

  const mapDbExpense = (r: any): Expense => ({
    id: String(r.id),
    categoryId: r.category_id ?? r.categoryId,
    description: r.description,
    amount: Number(r.amount) || 0,
    date: r.date,
    type: r.type,
    status: r.status,
    dueDate: r.due_date ?? undefined,
    paymentMethod: r.payment_method ?? undefined,
    recurring: r.type === 'recurrente' ? {
      frequency: r.recurring_frequency,
      nextDue: r.recurring_next_due,
      endDate: r.recurring_end_date ?? undefined
    } : undefined,
    alerts: {
      enabled: Boolean(r.alerts_enabled),
      times: parseJsonArray(r.alerts_times)
    },
    receipt: r.receipt ?? undefined,
    notes: r.notes ?? undefined,
    employee: r.employee ?? undefined
  })

  // Cargar datos desde Supabase
  useEffect(() => {
    async function loadExpensesAndCategories() {
      try {
        setIsLoading(true)
        const [{ data: catRows, error: catErr }, { data: expRows, error: expErr }] = await Promise.all([
          supabase.from('expense_categories').select('*').order('name', { ascending: true }),
          supabase.from('expenses').select('*').order('date', { ascending: false }).limit(1000)
        ])
        if (catErr) console.error('Error loading categories:', catErr)
        if (expErr) console.error('Error loading expenses:', expErr)
        setCategories((catRows || []).map(mapDbCategory))
        setExpenses((expRows || []).map(mapDbExpense))
      } catch (e) {
        console.error('Load expenses/categories error:', e)
      } finally {
        setIsLoading(false)
      }
    }
    loadExpensesAndCategories()
  }, [])

  // Nuevo estado para formulario de 3 pasos
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    type: 'unico',
    status: 'pendiente',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'tarjeta',
    alerts: {
      enabled: false,
      times: ['24h']
    }
  })

  // Estado para modal de nueva categoría
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<{ name: string; type: 'operativo' | 'fijo' | 'imprevisto' | 'custom' }>({ name: '', type: 'operativo' });
  // Estado para edición de categoría
  const [editCategory, setEditCategory] = useState<ExpenseCategory | null>(null);
  const [editCategoryData, setEditCategoryData] = useState<{ name: string; type: 'operativo' | 'fijo' | 'imprevisto' | 'custom' }>({ name: '', type: 'operativo' });

  // Calcular estadísticas
  const expenseStats: ExpenseStats = {
    totalMonth: expenses.filter(e => e.date.startsWith('2024-01')).reduce((sum, e) => sum + e.amount, 0),
    totalYear: expenses.reduce((sum, e) => sum + e.amount, 0),
    byCategory: categories.reduce((acc, cat) => {
      acc[cat.id] = expenses.filter(e => e.categoryId === cat.id).reduce((sum, e) => sum + e.amount, 0)
      return acc
    }, {} as { [key: string]: number }),
    pendingPayments: expenses.filter(e => e.status === 'pendiente').length,
    overdue: expenses.filter(e => e.status === 'vencido').length,
    averageMonthly: expenses.reduce((sum, e) => sum + e.amount, 0) / 12,
    cashFlowDays: Math.floor(15000 / (expenses.reduce((sum, e) => sum + e.amount, 0) / 30)), // Simulado
    projectedNext: expenses.filter(e => e.type === 'recurrente').reduce((sum, e) => sum + e.amount, 0)
  }

  // Datos para gráficos - siguiendo patrón AdminDashboard
  const chartDataTotalMonth = [
    { v: 8500 }, { v: 9200 }, { v: 8800 }, { v: 10200 }, { v: 9100 }, { v: expenseStats.totalMonth }, { v: 9800 }
  ]
  const chartDataPendingPayments = [
    { v: 3 }, { v: 5 }, { v: 2 }, { v: 4 }, { v: 3 }, { v: expenseStats.pendingPayments }, { v: 2 }
  ]
  const chartDataOverdue = [
    { v: 1 }, { v: 0 }, { v: 2 }, { v: 1 }, { v: 0 }, { v: expenseStats.overdue }, { v: 0 }
  ]
  const chartDataCashFlow = [
    { v: 45 }, { v: 52 }, { v: 38 }, { v: 41 }, { v: 47 }, { v: expenseStats.cashFlowDays }, { v: 43 }
  ]

  const daysLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  // Etiquetas de meses para eje X
  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul']

  // Datos para gráfico de torta por categorías
  const pieData = categories.map(cat => ({
    name: cat.name,
    value: expenseStats.byCategory[cat.id] || 0,
    color: cat.color.replace('bg-', ''),
    icon: cat.icon
  })).filter(d => d.value > 0)

  // Función para obtener categoría por ID
  const getCategoryById = (id: string) => categories.find(cat => cat.id === id)

  // Función para obtener color de estado
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pagado': return 'bg-green-100 text-green-800 border-green-200'
      case 'pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'programado': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'vencido': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Función para obtener icono de estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pagado': return <CheckCircleIcon size={12} />
      case 'pendiente': return <ClockIcon size={12} />
      case 'programado': return <CalendarIcon size={12} />
      case 'vencido': return <AlertTriangleIcon size={12} />
      default: return <ClockIcon size={12} />
    }
  }

  // Función para verificar alertas próximas
  const getUpcomingAlerts = () => {
    const now = new Date()
    return expenses.filter(expense => {
      if (expense.status !== 'pendiente' || !expense.dueDate || !expense.alerts?.enabled) return false
      
      const dueDate = new Date(expense.dueDate)
      const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      return diffHours <= 72 && diffHours > 0
    }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
  }

  const upcomingAlerts = getUpcomingAlerts()

  // Función para agregar nuevo gasto (Step 3)
  const handleAddExpense = async () => {
    if (newExpense.description && newExpense.amount && newExpense.categoryId) {
      try {
        const payload: any = {
          id: (globalThis as any).crypto?.randomUUID?.() || String(Date.now()),
          category_id: newExpense.categoryId,
          description: newExpense.description,
          amount: newExpense.amount,
          date: newExpense.date || new Date().toISOString().split('T')[0],
          type: newExpense.type,
          status: newExpense.status,
          payment_method: newExpense.paymentMethod,
          due_date: newExpense.dueDate || null,
          recurring_frequency: newExpense.type === 'recurrente' ? newExpense.recurring?.frequency || null : null,
          recurring_next_due: newExpense.type === 'recurrente' ? newExpense.recurring?.nextDue || null : null,
          recurring_end_date: newExpense.type === 'recurrente' ? newExpense.recurring?.endDate || null : null,
          alerts_enabled: Boolean(newExpense.alerts?.enabled),
          alerts_times: (newExpense.alerts?.times || []) as any,
          notes: newExpense.notes || null
        }
        const { data, error } = await supabase
          .from('expenses')
          .insert([payload])
          .select('*')
          .single()
        if (error) {
          console.error('Insert expense error:', error)
          alert('No se pudo guardar el gasto. Revisa permisos/estructura de la tabla.')
          return
        }
        const created = mapDbExpense(data)
        setExpenses([created, ...expenses])
        setNewExpense({
          type: 'unico',
          status: 'pendiente',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'tarjeta',
          alerts: { enabled: false, times: ['24h'] }
        })
        setIsAddExpenseOpen(false)
        setCurrentStep(1)
      } catch (e) {
        console.error('handleAddExpense error:', e)
      }
    }
  }

  // Función para eliminar gasto
  const handleDeleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) {
        console.error('Delete expense error:', error)
        return
      }
      setExpenses(expenses.filter(e => e.id !== id))
    } catch (e) {
      console.error('handleDeleteExpense error:', e)
    }
  }

  // Filtrar gastos
  const filteredExpenses = expenses.filter(expense => {
    const category = getCategoryById(expense.categoryId)
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         category?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = filterCategory === 'all' || expense.categoryId === filterCategory
    const matchesStatus = filterStatus === 'all' || expense.status === filterStatus
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  // Helper para mini-charts estilo dashboard
  const miniChartStyle = {
    chartHeight: 48,
    lineStrokeWidth: 1.5,
    dot: { r: 2 },
    grid: false,
    axis: false
  }

  // Tooltip personalizado para PieChart (ahora accede a categories y formatCurrency del scope)
  function PieCategoryTooltip({ active, payload }: any) {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, fontSize: 14, minWidth: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ width: 14, height: 14, borderRadius: 7, background: categories.find((c: any) => c.name === data.name)?.gradient?.split(' ')[1] || '#60a5fa', display: 'inline-block', marginRight: 8 }}></span>
            <span style={{ fontWeight: 600, color: '#111' }}>{data.name}</span>
          </div>
          <div style={{ color: '#2563EB', fontWeight: 700 }}>{formatCurrency(data.value)}</div>
        </div>
      )
    }
    return null;
  }

  // Datos simulados para próximos 3 meses y promedio trimestral
  const chartDataNext3Months = [
    { v: 9000, label: 'Feb' },
    { v: 9500, label: 'Mar' },
    { v: 9800, label: 'Abr' }
  ];
  const chartDataQuarterAvg = [
    { v: 9100, label: 'Feb' },
    { v: 9400, label: 'Mar' },
    { v: 9700, label: 'Abr' }
  ];
  const next3MonthsTotal = chartDataNext3Months.reduce((sum, d) => sum + d.v, 0);
  const quarterAvg = chartDataQuarterAvg.reduce((sum, d) => sum + d.v, 0) / chartDataQuarterAvg.length;

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
          <h1 className="text-lg lg:text-xl font-bold text-gray-900">Control de Gastos Operativos</h1>
          <p className="text-xs lg:text-sm text-gray-600 font-normal mt-1">
            Gestión inteligente de gastos, alertas y proyecciones financieras
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex justify-center">
            <nav className="bg-white rounded-[12px] shadow-sm flex px-1 py-1 gap-1">
              {[
                { id: 'analytics', label: 'Analytics', icon: <TrendingUpIcon size={16} /> },
                { id: 'expenses', label: 'Gastos', icon: <DollarSignIcon size={16} /> },
                { id: 'alerts', label: 'Alertas', icon: <BellIcon size={16} /> },
                { id: 'categories', label: 'Categorías', icon: <SettingsIcon size={16} /> }
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
            {/* Stats Overview - Siguiendo patrón AdminDashboard */}
            <div className="relative rounded-[16px] border border-gray-200 shadow-sm mb-8 lg:mb-10 p-4 lg:p-6 overflow-hidden bg-white">
              <div className="relative z-10">
                <div className="mb-4">
                  <h2 className="text-lg lg:text-xl font-bold text-gray-900">Resumen Financiero</h2>
                  <p className="text-xs lg:text-sm text-gray-600 font-normal mt-1">Métricas clave de gastos operativos</p>
                </div>
                <div className="grid grid-cols-2 lg:flex lg:justify-center gap-3 lg:gap-4">
                  {/* Total Mes */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(239,68,68,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-between h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Este Mes</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(expenseStats.totalMonth)}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Gastos totales</p>
                          </div>
                          <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                            <ResponsiveContainer width="100%" height={48}>
                              <LineChart data={chartDataTotalMonth.map((d, i) => ({ ...d, label: daysLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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

                  {/* Pagos Pendientes */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(251,146,60,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-between h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Pendientes</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{expenseStats.pendingPayments}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Por pagar</p>
                          </div>
                          <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                            <ResponsiveContainer width="100%" height={48}>
                              <LineChart data={chartDataPendingPayments.map((d, i) => ({ ...d, label: daysLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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

                  {/* Vencidos */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(220,38,38,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-between h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Vencidos</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{expenseStats.overdue}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Urgentes</p>
                          </div>
                          <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                            <ResponsiveContainer width="100%" height={48}>
                              <LineChart data={chartDataOverdue.map((d, i) => ({ ...d, label: daysLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
                                <CartesianGrid stroke="#e0e7ef" strokeOpacity={0.13} vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Line type="monotone" dataKey="v" stroke="#dc2626" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={true} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </SpotlightCard>
                  </div>

                  {/* Días de Operación */}
                  <div className="w-full lg:w-64">
                    <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                      <div className="rounded-2xl px-4 py-4 shadow-2xl animate-slideInUp relative overflow-hidden h-28 xl:h-36 flex flex-col justify-between config-font-medium metallic-bg" style={{ animationDelay: '300ms', boxShadow: '0 4px 16px 0 rgba(16,185,129,0.15)' }}>
                        <div className="absolute inset-0 pointer-events-none metallic-shine" />
                        <div className="flex flex-col justify-between h-full relative z-10">
                          <div className="flex flex-col items-center justify-center pt-1 pb-2">
                            <h3 className="font-semibold text-black text-xs lg:text-sm mb-1 tracking-wide uppercase opacity-80 text-center w-full">Flujo de Caja</h3>
                            <p className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-black leading-tight" style={{ fontFamily: 'Helvetica Neue' }}>{expenseStats.cashFlowDays}</p>
                            <p className="text-[10px] lg:text-xs font-normal text-black/70 leading-tight mt-1">Días de operación</p>
                          </div>
                          <div className="w-full px-2 h-10 xl:h-12 flex items-end">
                            <ResponsiveContainer width="100%" height={48}>
                              <LineChart data={chartDataCashFlow.map((d, i) => ({ ...d, label: daysLabels[i] }))} margin={{ left: 0, right: 0, top: 4, bottom: 4 }}>
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
                </div>
              </div>
            </div>

            {/* Gráficos Analíticos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Distribución por Categorías */}
              <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm animate-slideInUp" style={{ animationDelay: '400ms' }}>
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">Distribución por Categorías</h3>
                  <p className="text-xs text-gray-600 mt-1">Gastos del mes actual</p>
                </div>
                <div className="p-4">
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={categories.find(c => c.name === entry.name)?.gradient?.split(' ')[1] || '#60a5fa'} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieCategoryTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {pieData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center">
                          <span
                            className="w-3 h-3 rounded mr-2"
                            style={{
                              background: categories.find(c => c.name === item.name)?.gradient?.split(' ')[1] || '#60a5fa',
                              display: 'inline-block'
                            }}
                          ></span>
                          <span className="text-gray-700">{item.name}</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Proyección Próximo Mes */}
              <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm animate-slideInUp" style={{ animationDelay: '500ms' }}>
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">Proyección Financiera</h3>
                  <p className="text-xs text-gray-600 mt-1">Gastos fijos proyectados</p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">Próximo Mes</span>
                        <span className="text-lg font-bold text-blue-900">{formatCurrency(expenseStats.projectedNext)}</span>
                      </div>
                      <div className="w-full h-16 mb-1">
                        <ResponsiveContainer width="100%" height={56}>
                          <LineChart data={chartDataTotalMonth.map((d, i) => ({ ...d, label: monthLabels[i] }))} margin={{ left: 0, right: 0, top: 8, bottom: 8 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#2563EB' }} axisLine={false} tickLine={false} />
                            <Line type="monotone" dataKey="v" stroke="#2563EB" strokeWidth={miniChartStyle.lineStrokeWidth} dot={miniChartStyle.dot} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-xs text-blue-700">Gastos recurrentes confirmados</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-yellow-900">Promedio Mensual</span>
                        <span className="text-lg font-bold text-yellow-900">{formatCurrency(expenseStats.averageMonthly)}</span>
                      </div>
                      <div className="w-full h-16 mb-1">
                        <ResponsiveContainer width="100%" height={56}>
                          <LineChart data={chartDataTotalMonth.map((d, i) => ({ ...d, label: monthLabels[i] }))} margin={{ left: 0, right: 0, top: 8, bottom: 8 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#F59E42' }} axisLine={false} tickLine={false} />
                            <Line type="monotone" dataKey="v" stroke="#F59E42" strokeWidth={miniChartStyle.lineStrokeWidth} dot={miniChartStyle.dot} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-xs text-yellow-700">Basado en últimos 12 meses</p>
                    </div>
                    {/* Próximos 3 Meses */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-900">Próximos 3 Meses</span>
                        <span className="text-lg font-bold text-purple-900">{formatCurrency(next3MonthsTotal)}</span>
                      </div>
                      <div className="w-full h-16 mb-1">
                        <ResponsiveContainer width="100%" height={56}>
                          <LineChart data={chartDataNext3Months} margin={{ left: 0, right: 0, top: 8, bottom: 8 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a855f7' }} axisLine={false} tickLine={false} />
                            <Line type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={miniChartStyle.lineStrokeWidth} dot={miniChartStyle.dot} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-xs text-purple-700">Proyección acumulada</p>
                    </div>
                    {/* Promedio Trimestral */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-pink-900">Promedio Trimestral</span>
                        <span className="text-lg font-bold text-pink-900">{formatCurrency(quarterAvg)}</span>
                      </div>
                      <div className="w-full h-16 mb-1">
                        <ResponsiveContainer width="100%" height={56}>
                          <LineChart data={chartDataQuarterAvg} margin={{ left: 0, right: 0, top: 8, bottom: 8 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#ec4899' }} axisLine={false} tickLine={false} />
                            <Line type="monotone" dataKey="v" stroke="#ec4899" strokeWidth={miniChartStyle.lineStrokeWidth} dot={miniChartStyle.dot} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-xs text-pink-700">Promedio últimos 3 meses</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Expenses View */}
        {activeView === 'expenses' && (
          <>
            {/* Filtros y Búsqueda */}
            <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm mb-6 p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <SearchIcon size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar gastos por descripción o categoría..."
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
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="pagado">Pagado</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="programado">Programado</option>
                    <option value="vencido">Vencido</option>
                  </select>
                  <button
                    onClick={() => setIsAddExpenseOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm whitespace-nowrap"
                  >
                    <PlusIcon size={16} className="mr-2" />
                    Agregar Gasto
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Gastos */}
            <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-base">Registro de Gastos</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {filteredExpenses.length} de {expenses.length} gastos
                </p>
              </div>
              <div className="p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredExpenses.map((expense) => {
                    const category = getCategoryById(expense.categoryId)
                    return (
                      <div
                        key={expense.id}
                        className="bg-white border border-gray-100 rounded-[6px] px-3 py-2 shadow-none hover:shadow-sm transition-all duration-200 group flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-xs"
                      >
                        {/* Información principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-gray-900 truncate text-xs mb-0.5">
                                {expense.description}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                                <span>{category?.name}</span>
                                <span>·</span>
                                <span>{new Date(expense.date).toLocaleDateString()}</span>
                                <span>·</span>
                                <span className={expense.type === 'recurrente' ? 'text-blue-600' : 'text-gray-600'}>
                                  {expense.type === 'recurrente' ? 'Recurrente' : 'Único'}
                                </span>
                                {expense.paymentMethod && (
                                  <>
                                    <span>·</span>
                                    <span>{expense.paymentMethod}</span>
                                  </>
                                )}
                              </div>
                              {expense.notes && (
                                <div className="text-[10px] text-gray-400 mt-0.5 truncate">{expense.notes}</div>
                              )}
                              {expense.dueDate && expense.status !== 'pagado' && (
                                <div className="text-[10px] text-red-600 mt-0.5">
                                  Vence: {new Date(expense.dueDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Monto y estado */}
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className="text-base font-bold text-gray-900 min-w-[60px] text-right">{formatCurrency(expense.amount)}</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${getStatusColor(expense.status)}`}
                            style={{ minWidth: 54, textTransform: 'capitalize', background: 'white', borderWidth: 1 }}>
                            {expense.status}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="flex items-center justify-center w-7 h-7 rounded border border-gray-200 bg-white text-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 shadow-none"
                            title="Eliminar"
                          >
                            <TrashIcon size={13} />
                          </button>
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
          <div className="bg-white rounded-[8px] border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Sistema de Alertas Inteligentes</h3>
              <p className="text-xs text-gray-600 mt-1">Notificaciones próximas y configuración</p>
            </div>
            <div className="p-4">
              {upcomingAlerts.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Próximas Alertas</h4>
                  {upcomingAlerts.map((expense) => {
                    const category = getCategoryById(expense.categoryId)
                    const dueDate = new Date(expense.dueDate!)
                    const now = new Date()
                    const diffHours = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
                    
                    let alertLevel = 'yellow'
                    let alertText = '72h antes'
                    if (diffHours <= 24) {
                      alertLevel = 'orange'
                      alertText = '24h antes'
                    }
                    if (diffHours <= 1) {
                      alertLevel = 'red'
                      alertText = '1h antes'
                    }

                    return (
                      <div key={expense.id} className={`border-l-4 border-${alertLevel}-500 bg-${alertLevel}-50 p-4 rounded-r-lg`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: category?.gradient }}>
                              {category?.icon}
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900">{expense.description}</h5>
                              <p className="text-sm text-gray-600">
                                Vence: {dueDate.toLocaleDateString()} • {formatCurrency(expense.amount)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-${alertLevel}-700 font-medium text-sm`}>
                              {alertText}
                            </span>
                            <p className="text-xs text-gray-500">{diffHours}h restantes</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BellIcon size={48} className="mx-auto text-gray-300 mb-4" />
                  <h4 className="font-medium text-gray-900 mb-2">No hay alertas pendientes</h4>
                  <p className="text-gray-600">Todos los pagos están al día</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories View */}
        {activeView === 'categories' && (
          <div className="bg-white rounded-[8px] border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-black text-lg">Gestión de Categorías</h3>
              <p className="text-xs text-gray-600 mt-1">Personaliza las categorías de gastos</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <div key={category.id} className="rounded-lg border border-gray-100 bg-white px-4 py-3 flex items-center justify-between gap-2 hover:shadow transition-all duration-200">
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="font-semibold text-black text-sm truncate">{category.name}</div>
                      <div className="text-xs text-gray-400 capitalize truncate">{category.type}</div>
                    </div>
                    <div className="flex flex-col items-end min-w-[80px]">
                      <span className="font-bold text-blue-700 text-base leading-tight">{formatCurrency(expenseStats.byCategory[category.id] || 0)}</span>
                      <span className="text-xs text-gray-500 leading-tight">{expenses.filter(e => e.categoryId === category.id).length} gastos</span>
                    </div>
                    {category.isEditable && (
                      <button
                        className="text-gray-400 hover:text-blue-600 ml-2"
                        onClick={() => {
                          setEditCategory(category);
                          setEditCategoryData({ name: category.name, type: category.type });
                        }}
                        title="Editar categoría"
                      >
                        <EditIcon size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {/* Card para nueva categoría */}
                <button
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="rounded-lg border-2 border-dashed border-gray-200 bg-white px-4 py-3 flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 min-h-[72px]"
                  style={{ minHeight: 72 }}
                >
                  <span className="text-2xl text-blue-500 font-bold leading-none">+</span>
                  <span className="text-xs text-blue-700 font-semibold">Nueva categoría</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de 3 pasos para agregar gasto */}
        {isAddExpenseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md" style={{ minHeight: '100vh', minWidth: '100vw' }}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-2 p-0 relative animate-fadeInSlide max-h-[95vh] overflow-y-auto border border-gray-200">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
                onClick={() => {
                  setIsAddExpenseOpen(false)
                  setCurrentStep(1)
                }}
                aria-label="Cerrar"
              >
                <XIcon size={22} />
              </button>
              <div className="px-6 pt-6 pb-2">
                <h3 className="font-bold text-black text-lg mb-1">Agregar nuevo gasto</h3>
                <p className="text-xs text-gray-700 mb-4">Paso {currentStep} de 3</p>
              </div>
              <div className="px-6 pb-6">
                {/* Paso 1: Tipo */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-black mb-2">¿Qué tipo de gasto es?</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setNewExpense({...newExpense, type: 'unico'})}
                        className={`py-4 px-2 border rounded-lg text-left transition-all duration-200 text-xs font-semibold ${
                          newExpense.type === 'unico' 
                            ? 'border-blue-500 bg-blue-50 text-black' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        Gasto Único
                        <div className="text-[11px] text-gray-500 font-normal mt-1">Compra individual, reparación, etc.</div>
                      </button>
                      <button
                        onClick={() => setNewExpense({...newExpense, type: 'recurrente'})}
                        className={`py-4 px-2 border rounded-lg text-left transition-all duration-200 text-xs font-semibold ${
                          newExpense.type === 'recurrente' 
                            ? 'border-blue-500 bg-blue-50 text-black' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        Gasto Recurrente
                        <div className="text-[11px] text-gray-500 font-normal mt-1">Alquiler, servicios, nómina, etc.</div>
                      </button>
                    </div>
                  </div>
                )}
                {/* Paso 2: Detalles */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-black mb-2">Detalles del gasto</div>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Descripción *</label>
                        <input
                          type="text"
                          value={newExpense.description || ''}
                          onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                          placeholder="Ej: Compra de ingredientes"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Monto *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={newExpense.amount || ''}
                          onChange={(e) => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Categoría *</label>
                        <select
                          value={newExpense.categoryId || ''}
                          onChange={(e) => setNewExpense({...newExpense, categoryId: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                        >
                          <option value="">Seleccionar categoría</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Método de Pago</label>
                        <select
                          value={newExpense.paymentMethod || 'tarjeta'}
                          onChange={(e) => setNewExpense({...newExpense, paymentMethod: e.target.value as any})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                        >
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta">Tarjeta</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="cheque">Cheque</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Fecha</label>
                        <input
                          type="date"
                          value={newExpense.date}
                          onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                        />
                      </div>
                      {newExpense.type === 'recurrente' && (
                        <div>
                          <label className="block text-xs font-medium text-black mb-1">Fecha de Vencimiento</label>
                          <input
                            type="date"
                            value={newExpense.dueDate || ''}
                            onChange={(e) => setNewExpense({...newExpense, dueDate: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                          />
                        </div>
                      )}
                    </div>
                    {newExpense.type === 'recurrente' && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-xs font-semibold text-blue-900 mb-2">Configuración de Recurrencia</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-blue-700 mb-1">Frecuencia</label>
                            <select
                              value={newExpense.recurring?.frequency || 'mensual'}
                              onChange={(e) => setNewExpense({
                                ...newExpense, 
                                recurring: {...newExpense.recurring, frequency: e.target.value as any, nextDue: newExpense.recurring?.nextDue || new Date().toISOString().split('T')[0] }
                              })}
                              className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                            >
                              <option value="semanal">Semanal</option>
                              <option value="quincenal">Quincenal</option>
                              <option value="mensual">Mensual</option>
                              <option value="trimestral">Trimestral</option>
                              <option value="anual">Anual</option>
                            </select>
                          </div>
                          <div className="flex items-center mt-5">
                            <input
                              type="checkbox"
                              checked={newExpense.alerts?.enabled || false}
                              onChange={(e) => setNewExpense({
                                ...newExpense,
                                alerts: {...newExpense.alerts, enabled: e.target.checked, times: newExpense.alerts?.times || ['24h']}
                              })}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                            />
                            <span className="text-xs text-blue-700">Activar alertas</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Paso 3: Confirmación */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-black mb-2">Confirmar datos</div>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">Descripción:</span>
                        <span className="font-medium text-black">{newExpense.description}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">Monto:</span>
                        <span className="font-bold text-black">{formatCurrency(newExpense.amount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">Categoría:</span>
                        <span className="font-medium text-black">{categories.find(c => c.id === newExpense.categoryId)?.name}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">Tipo:</span>
                        <span className="font-medium text-black">{newExpense.type === 'recurrente' ? 'Recurrente' : 'Único'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">Método de pago:</span>
                        <span className="font-medium text-black">{newExpense.paymentMethod}</span>
                      </div>
                      {newExpense.type === 'recurrente' && newExpense.alerts?.enabled && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-700">Alertas:</span>
                          <span className="font-medium text-blue-600">Activadas</span>
                        </div>
                      )}
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
                          if (currentStep === 1 && newExpense.type) {
                            setCurrentStep(2)
                          } else if (currentStep === 2 && newExpense.description && newExpense.amount && newExpense.categoryId) {
                            setCurrentStep(3)
                          }
                        }}
                        disabled={
                          (currentStep === 1 && !newExpense.type) ||
                          (currentStep === 2 && (!newExpense.description || !newExpense.amount || !newExpense.categoryId))
                        }
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                      >
                        Siguiente
                      </button>
                    ) : (
                      <button
                        onClick={handleAddExpense}
                        className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 flex items-center text-xs"
                      >
                        <SaveIcon size={14} className="mr-2" />
                        Guardar Gasto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para crear nueva categoría */}
        {isAddCategoryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
            <div className="bg-white rounded-xl shadow-2xl max-w-xs w-full mx-2 p-0 relative animate-fadeInSlide border border-gray-200">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
                onClick={() => setIsAddCategoryOpen(false)}
                aria-label="Cerrar"
              >
                <XIcon size={20} />
              </button>
              <div className="px-6 pt-6 pb-2">
                <h3 className="font-bold text-black text-base mb-1">Nueva categoría</h3>
              </div>
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={newCategory.name}
                      onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                      placeholder="Ej: Marketing Digital"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Tipo *</label>
                    <select
                      value={newCategory.type}
                      onChange={e => setNewCategory({ ...newCategory, type: e.target.value as 'operativo' | 'fijo' | 'imprevisto' | 'custom' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                    >
                      <option value="operativo">Operativo</option>
                      <option value="fijo">Fijo</option>
                      <option value="imprevisto">Imprevisto</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={async () => {
                      if (newCategory.name.trim()) {
                        try {
                          const payload: any = {
                            id: `custom-${crypto.randomUUID?.() || Date.now()}`,
                            name: newCategory.name,
                            icon: '',
                            color: 'bg-gray-500',
                            gradient: 'linear-gradient(90deg, #d1d5db 0%, #374151 100%)',
                            type: newCategory.type,
                            is_editable: true
                          }
                          const { data, error } = await supabase
                            .from('expense_categories')
                            .insert([payload])
                            .select('*')
                            .single()
                          if (error) {
                            console.error('Insert category error:', error)
                            alert('No se pudo crear la categoría. Revisa permisos/estructura de la tabla.')
                            return
                          }
                          const created = mapDbCategory(data)
                          setCategories(([...categories, created]) as ExpenseCategory[])
                          setIsAddCategoryOpen(false)
                          setNewCategory({ name: '', type: 'operativo' })
                        } catch (e) {
                          console.error('Create category error:', e)
                          alert('Error inesperado al crear la categoría.')
                        }
                      }
                    }}
                    className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200 text-xs font-semibold"
                  >
                    Crear categoría
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para editar categoría */}
        {editCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
            <div className="bg-white rounded-xl shadow-2xl max-w-xs w-full mx-2 p-0 relative animate-fadeInSlide border border-gray-200">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
                onClick={() => setEditCategory(null)}
                aria-label="Cerrar"
              >
                <XIcon size={20} />
              </button>
              <div className="px-6 pt-6 pb-2">
                <h3 className="font-bold text-black text-base mb-1">Editar categoría</h3>
              </div>
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={editCategoryData.name}
                      onChange={e => setEditCategoryData({ ...editCategoryData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                      placeholder="Ej: Marketing Digital"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Tipo *</label>
                    <select
                      value={editCategoryData.type}
                      onChange={e => setEditCategoryData({ ...editCategoryData, type: e.target.value as 'operativo' | 'fijo' | 'imprevisto' | 'custom' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black text-xs"
                    >
                      <option value="operativo">Operativo</option>
                      <option value="fijo">Fijo</option>
                      <option value="imprevisto">Imprevisto</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={async () => {
                      if (editCategory && editCategoryData.name.trim()) {
                        try {
                          const { data, error } = await supabase
                            .from('expense_categories')
                            .update({ name: editCategoryData.name, type: editCategoryData.type })
                            .eq('id', editCategory.id)
                            .select('*')
                            .single()
                          if (error) {
                            console.error('Update category error:', error)
                            return
                          }
                          const updated = mapDbCategory(data)
                          setCategories(categories.map(cat => cat.id === updated.id ? updated : cat) as ExpenseCategory[])
                          setEditCategory(null)
                        } catch (e) {
                          console.error('Edit category error:', e)
                        }
                      }
                    }}
                    className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200 text-xs font-semibold"
                  >
                    Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botón flotante para mobile */}
        <button
          onClick={() => setIsAddExpenseOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center md:hidden z-40 hover:scale-110"
        >
          <PlusIcon size={24} />
        </button>
      </div>
    </div>
  )
} 