import { useState, useEffect } from 'react'
import { useConfig } from '../contexts/ConfigContext'
import { UserIcon, EditIcon, TrashIcon, PlusIcon, SearchIcon, FilterIcon } from './icons'
import './animations.css'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts'
import SpotlightCard from './SpotlightCard'
import { supabase } from '../lib/supabaseClient'

interface Employee {
  id: string
  name: string
  email: string
  phone: string
  position: string
  salary: number
  payrollType: 'mensual' | 'quincenal' | 'semanal'
  startDate: string
  status: 'activo' | 'inactivo'
  avatar?: string
  department: string
  shifts: string[]
}

export function AdminEmployees() {
  const [isLoading, setIsLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'activo' | 'inactivo'>('todos')
  const [filterPosition, setFilterPosition] = useState('todos')
  const [isAddingEmployee, setIsAddingEmployee] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    salary: '',
    payrollType: 'mensual' as 'mensual' | 'quincenal' | 'semanal',
    startDate: '',
    status: 'activo' as 'activo' | 'inactivo',
    department: '',
    shifts: [] as string[]
  })
  const [editEmployee, setEditEmployee] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    salary: '',
    payrollType: 'mensual' as 'mensual' | 'quincenal' | 'semanal',
    startDate: '',
    status: 'activo' as 'activo' | 'inactivo',
    department: '',
    shifts: [] as string[]
  })
  const [isSavingNew, setIsSavingNew] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const { formatCurrency } = useConfig()

  // Cargar datos del empleado cuando se edita
  useEffect(() => {
    if (editingEmployee) {
      const employee = employees.find(emp => emp.id === editingEmployee)
      if (employee) {
        setEditEmployee({
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          position: employee.position,
          salary: employee.salary.toString(),
          payrollType: employee.payrollType,
          startDate: employee.startDate,
          status: employee.status,
          department: employee.department,
          shifts: [...employee.shifts]
        })
      }
    }
  }, [editingEmployee, employees])

  useEffect(() => {
    let isMounted = true
    async function loadEmployees() {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)
      if (!isMounted) return
      if (error || !data) {
        setEmployees([])
        setIsLoading(false)
        return
      }
      const mapped: Employee[] = (data as any[]).map(r => ({
        id: String(r.id),
        name: r.name as string,
        email: r.email as string,
        phone: r.phone as string,
        position: (r.position as string) || 'Vendedor',
        salary: Number(r.salary) || 0,
        payrollType: (r.payroll_type as 'mensual' | 'quincenal' | 'semanal') || 'mensual',
        startDate: (r.start_date ? new Date(r.start_date).toISOString().slice(0,10) : new Date().toISOString().slice(0,10)),
        status: (r.status as 'activo' | 'inactivo') || 'activo',
        department: (r.department as string) || 'Ventas',
        shifts: (Array.isArray(r.shifts) ? r.shifts : []) as string[]
      }))
      setEmployees(mapped)
      setIsLoading(false)
    }
    loadEmployees()
    return () => { isMounted = false }
  }, [])

  // Filtrar empleados
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.position.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'todos' || employee.status === filterStatus
    const matchesPosition = filterPosition === 'todos' || employee.position === filterPosition

    return matchesSearch && matchesStatus && matchesPosition
  })

  // Obtener posiciones únicas para filtro
  const uniquePositions = Array.from(new Set(employees.map(emp => emp.position)))

  // Generar datos de ejemplo para gráficos (últimos 3 meses)
  const generateChartData = (employeePosition: string) => {
    const months = ['Octubre', 'Noviembre', 'Diciembre']
    const data = months.map(month => {
      const base = { month }
      
      if (employeePosition.toLowerCase().includes('mesero')) {
        return {
          ...base,
          mesasAtendidas: Math.floor(Math.random() * 50) + 30,
          propinas: Math.floor(Math.random() * 20) + 15,
          satisfaccion: +(Math.random() * 2 + 3).toFixed(1),
          ordenesServidas: Math.floor(Math.random() * 100) + 80
        }
      } else if (employeePosition.toLowerCase().includes('chef')) {
        return {
          ...base,
          platosPreparados: Math.floor(Math.random() * 80) + 60,
          tiempoPrep: Math.floor(Math.random() * 5) + 8,
          calificacion: +(Math.random() * 1.5 + 3.5).toFixed(1),
          ingredientesUsados: Math.floor(Math.random() * 20) + 25
        }
      } else if (employeePosition.toLowerCase().includes('cajera')) {
        return {
          ...base,
          transacciones: Math.floor(Math.random() * 40) + 60,
          tiempoPromedio: Math.floor(Math.random() * 2) + 2,
          precision: +(Math.random() * 5 + 95).toFixed(1),
          ventas: Math.floor(Math.random() * 2000) + 3000
        }
      } else if (employeePosition.toLowerCase().includes('supervisor')) {
        return {
          ...base,
          empleadosCargo: Math.floor(Math.random() * 5) + 8,
          evaluaciones: Math.floor(Math.random() * 10) + 15,
          incidentesResueltos: Math.floor(Math.random() * 8) + 7,
          eficiencia: +(Math.random() * 10 + 85).toFixed(1)
        }
      } else {
        return {
          ...base,
          tareasCompletadas: Math.floor(Math.random() * 20) + 25,
          eficiencia: +(Math.random() * 15 + 80).toFixed(1),
          horasTrabajadas: Math.floor(Math.random() * 15) + 35,
          calificacion: +(Math.random() * 2 + 3).toFixed(1)
        }
      }
    })
    return data
  }

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Cargando empleados...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 lg:mb-8 animate-fadeInSlide">
        
        <p className="text-gray-600 font-medium text-sm lg:text-base">
          Administra el personal de la tienda y fábrica y sus datos
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:flex lg:justify-center gap-3 lg:gap-4 mb-6 lg:mb-8 max-w-4xl mx-auto">
        <div className="w-full lg:w-48">
          <SpotlightCard spotlightColor="rgba(139, 92, 246, 0.08)">
            <div className="rounded-2xl px-4 py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-32 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(139,92,246,0.15)' }}>
              <div className="absolute inset-0 pointer-events-none metallic-shine" />
              <div className="flex flex-col justify-between h-full">
                <h3 className="font-semibold text-black text-xs lg:text-sm mb-2 tracking-wide uppercase opacity-80 text-center w-full">Empleados</h3>
                <div className="flex flex-col items-center justify-center flex-1">
                  <p className="text-lg lg:text-xl xl:text-2xl font-extrabold text-black">{employees.length}</p>
                </div>
                <p className="text-xs lg:text-sm font-normal text-black/70 leading-tight">Empleados registrados</p>
              </div>
            </div>
          </SpotlightCard>
        </div>
        <div className="w-full lg:w-48">
          <SpotlightCard spotlightColor="rgba(34, 197, 94, 0.08)">
            <div className="rounded-2xl px-4 py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-32 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(34,197,94,0.15)' }}>
              <div className="absolute inset-0 pointer-events-none metallic-shine" />
              <div className="flex flex-col justify-between h-full">
                <h3 className="font-semibold text-black text-xs lg:text-sm mb-2 tracking-wide uppercase opacity-80 text-center w-full">Activos</h3>
                <div className="flex flex-col items-center justify-center flex-1">
                  <p className="text-lg lg:text-xl xl:text-2xl font-extrabold text-black">{employees.filter(emp => emp.status === 'activo').length}</p>
                </div>
                <p className="text-xs lg:text-sm font-normal text-black/70 leading-tight">Empleados activos</p>
              </div>
            </div>
          </SpotlightCard>
        </div>
        <div className="w-full lg:w-48">
          <SpotlightCard spotlightColor="rgba(59, 130, 246, 0.08)">
            <div className="rounded-2xl px-4 py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-32 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
              <div className="absolute inset-0 pointer-events-none metallic-shine" />
              <div className="flex flex-col justify-between h-full">
                <h3 className="font-semibold text-black text-xs lg:text-sm mb-2 tracking-wide uppercase opacity-80 text-center w-full">Nómina Total</h3>
                <div className="flex flex-col items-center justify-center flex-1">
                  <p className="text-lg lg:text-xl xl:text-2xl font-extrabold text-black">{formatCurrency(employees.reduce((sum, emp) => sum + emp.salary, 0))}</p>
                </div>
                <p className="text-xs lg:text-sm font-normal text-black/70 leading-tight">Suma de salarios</p>
              </div>
            </div>
          </SpotlightCard>
        </div>
        <div className="w-full lg:w-48">
          <SpotlightCard spotlightColor="rgba(251, 146, 60, 0.08)">
            <div className="rounded-2xl px-4 py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-32 xl:h-36 flex flex-col justify-between metallic-bg" style={{ animationDelay: '300ms', boxShadow: '0 4px 16px 0 rgba(251,146,60,0.15)' }}>
              <div className="absolute inset-0 pointer-events-none metallic-shine" />
              <div className="flex flex-col justify-between h-full">
                <h3 className="font-semibold text-black text-xs lg:text-sm mb-2 tracking-wide uppercase opacity-80 text-center w-full">Departamentos</h3>
                <div className="flex flex-col items-center justify-center flex-1">
                  <p className="text-lg lg:text-xl xl:text-2xl font-extrabold text-black">{Array.from(new Set(employees.map(emp => emp.department))).length}</p>
                </div>
                <p className="text-xs lg:text-sm font-normal text-black/70 leading-tight">Departamentos únicos</p>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-[8px] border border-gray-300 shadow-sm overflow-hidden">
        {/* Header and Controls */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-800">Lista de Empleados</h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredEmployees.length} de {employees.length} empleados
              </p>
            </div>
            {/* Controls: Search, Filters, Add */}
            <div className="flex flex-col lg:flex-row gap-2 items-start lg:items-center">
              {/* Search */}
              <div className="relative w-full lg:w-56">
                <SearchIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar empleados..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white text-black border border-gray-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              {/* Filters */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 bg-white text-black border border-gray-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className="px-3 py-2 bg-white text-black border border-gray-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="todos">Todas las posiciones</option>
                {uniquePositions.map(position => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
              {/* Add Employee */}
              <button
                onClick={() => setIsAddingEmployee(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <PlusIcon size={16} />
                Agregar Empleado
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Empleado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posición
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Departamento
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Salario
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Inicio
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr 
                  key={employee.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedEmployee(employee)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                        <UserIcon size={20} className="text-purple-600" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-sm text-gray-500">{employee.email}</div>
                        <div className="text-xs text-gray-400">{employee.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-900">{employee.position}</div>
                    <div className="text-sm text-gray-500">
                      {employee.shifts.join(', ')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {employee.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(employee.salary)}</div>
                    <div className="text-xs text-gray-500">{employee.payrollType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                      employee.status === 'activo' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                    {new Date(employee.startDate).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingEmployee(employee.id)
                        }}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Editar empleado"
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`¿Estás seguro de que quieres eliminar a ${employee.name}?`)) {
                            setEmployees(prev => prev.filter(emp => emp.id !== employee.id))
                          }
                        }}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Eliminar empleado"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-12">
              <UserIcon size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron empleados</h3>
              <p className="text-gray-500">Intenta ajustar tus filtros de búsqueda</p>
            </div>
          )}
        </div>
      </div>

      {/* Employee Dashboard Modal */}
      {selectedEmployee && (
        <div 
          className="fixed inset-0 w-full h-full bg-black bg-opacity-40 backdrop-blur-md flex items-center justify-center z-50"
          onClick={() => setSelectedEmployee(null)}
        >
          <div 
            className="bg-white rounded-[15px] max-w-4xl w-full max-h-[90vh] overflow-y-auto apple-scrollbar-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="relative mb-8">
                {/* Close button */}
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all duration-200 z-10"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>

                {/* Employee Card */}
                <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-[15px] p-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded flex items-center justify-center shadow-lg">
                        <UserIcon size={28} className="text-white" />
                      </div>
                    </div>

                    {/* Employee Info */}
                    <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <h2 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">
                          {selectedEmployee.name}
                        </h2>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-purple-600 font-semibold">{selectedEmployee.position}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-600">{selectedEmployee.department}</span>
                        </div>
                      </div>

                      {/* Contact info chips */}
                      <div className="flex flex-wrap gap-2">
                        <div className="inline-flex items-center px-2.5 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 shadow-sm">
                          <svg className="w-3.5 h-3.5 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {selectedEmployee.email}
                        </div>
                        <div className="inline-flex items-center px-2.5 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 shadow-sm">
                          <svg className="w-3.5 h-3.5 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {selectedEmployee.phone}
                        </div>
                        <div className="inline-flex items-center px-2.5 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 shadow-sm">
                          <svg className="w-3.5 h-3.5 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          {formatCurrency(selectedEmployee.salary)} / {selectedEmployee.payrollType}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                             {/* Employee Info */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                  <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                   <h3 className="font-semibold text-black mb-2">Información General</h3>
                   <div className="space-y-2 text-sm text-black text-left">
                     <p><span className="font-medium">Salario:</span> {formatCurrency(selectedEmployee.salary)}</p>
                     <p><span className="font-medium">Tipo de nómina:</span> {selectedEmployee.payrollType}</p>
                     <p><span className="font-medium">Fecha de inicio:</span> {new Date(selectedEmployee.startDate).toLocaleDateString('es-ES')}</p>
                     <p><span className="font-medium">Estado:</span> 
                       <span className={`ml-2 px-2 py-1 rounded text-xs ${
                         selectedEmployee.status === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                       }`}>
                         {selectedEmployee.status}
                       </span>
                     </p>
                   </div>
                 </div>

                 <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                   <h3 className="font-semibold text-black mb-2">Horarios</h3>
                   <div className="space-y-2 text-sm text-black text-left">
                     {selectedEmployee.shifts.map((shift, index) => (
                       <p key={index} className="flex items-center gap-2">
                         <span className="w-2 h-2 bg-gray-600 rounded-full"></span>
                         {shift}
                       </p>
                     ))}
                   </div>
                 </div>

                 <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                   <h3 className="font-semibold text-black mb-2">Contacto</h3>
                   <div className="space-y-2 text-sm text-black text-left">
                     <p><span className="font-medium">Teléfono:</span> {selectedEmployee.phone}</p>
                     <p><span className="font-medium">Email:</span> {selectedEmployee.email}</p>
                   </div>
                 </div>
               </div>

              {/* Performance Metrics */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas de Rendimiento</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {selectedEmployee.position.toLowerCase().includes('mesero') && (
                    <>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Mesas Atendidas (Mes)</p>
                        <p className="text-2xl font-bold text-purple-600 mt-1">{Math.floor(Math.random() * 150) + 50}</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Propinas Promedio</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(Math.floor(Math.random() * 50) + 10)}</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Satisfacción Cliente</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{(Math.random() * 2 + 3).toFixed(1)}/5</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Órdenes Servidas</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">{Math.floor(Math.random() * 300) + 100}</p>
                      </div>
                    </>
                  )}

                  {selectedEmployee.position.toLowerCase().includes('chef') && (
                    <>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Platos Preparados</p>
                        <p className="text-2xl font-bold text-purple-600 mt-1">{Math.floor(Math.random() * 200) + 100}</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Tiempo Prep. Promedio</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{Math.floor(Math.random() * 10) + 8}min</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Calificación Platos</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{(Math.random() * 1.5 + 3.5).toFixed(1)}/5</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Ingredientes Usados</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">{Math.floor(Math.random() * 50) + 20}</p>
                      </div>
                    </>
                  )}

                  {selectedEmployee.position.toLowerCase().includes('cajera') && (
                    <>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Transacciones</p>
                        <p className="text-2xl font-bold text-purple-600 mt-1">{Math.floor(Math.random() * 100) + 50}</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Tiempo Promedio</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{Math.floor(Math.random() * 3) + 2}min</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Precisión</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{(Math.random() * 5 + 95).toFixed(1)}%</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Ventas Totales</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(Math.floor(Math.random() * 5000) + 2000)}</p>
                      </div>
                    </>
                  )}

                  {selectedEmployee.position.toLowerCase().includes('supervisor') && (
                    <>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Empleados a Cargo</p>
                        <p className="text-2xl font-bold text-purple-600 mt-1">{Math.floor(Math.random() * 10) + 5}</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Evaluaciones</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{Math.floor(Math.random() * 20) + 10}</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Incidentes Resueltos</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{Math.floor(Math.random() * 15) + 5}</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Eficiencia Equipo</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">{(Math.random() * 10 + 85).toFixed(1)}%</p>
                      </div>
                    </>
                  )}

                  {!['mesero', 'chef', 'cajera', 'supervisor'].some(role => selectedEmployee.position.toLowerCase().includes(role)) && (
                    <>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Tareas Completadas</p>
                        <p className="text-2xl font-bold text-purple-600 mt-1">{Math.floor(Math.random() * 50) + 20}</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Eficiencia</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{(Math.random() * 20 + 75).toFixed(1)}%</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Horas Trabajadas</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{Math.floor(Math.random() * 40) + 30}h</p>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4 text-center">
                        <p className="text-sm text-gray-600">Calificación</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">{(Math.random() * 2 + 3).toFixed(1)}/5</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Performance Charts */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencias de Rendimiento (Últimos 3 Meses)</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {selectedEmployee.position.toLowerCase().includes('mesero') && (
                    <>
                      {/* Mesas Atendidas */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Mesas Atendidas por Mes</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="mesasAtendidas" stroke="#8b5cf6" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Propinas */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Propinas Promedio por Mes</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="propinas" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Satisfacción Cliente */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Satisfacción del Cliente</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis domain={[0, 5]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="satisfaccion" stroke="#3b82f6" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Órdenes Servidas */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Órdenes Servidas por Mes</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="ordenesServidas" fill="#f97316" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {selectedEmployee.position.toLowerCase().includes('chef') && (
                    <>
                      {/* Platos Preparados */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Platos Preparados por Mes</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="platosPreparados" fill="#8b5cf6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Tiempo de Preparación */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Tiempo de Preparación Promedio</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="tiempoPrep" stroke="#10b981" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Calificación */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Calificación de Platos</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis domain={[0, 5]} />
                            <Tooltip />
                            <Area type="monotone" dataKey="calificacion" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Ingredientes Usados */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Ingredientes Utilizados por Mes</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="ingredientesUsados" fill="#f97316" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {selectedEmployee.position.toLowerCase().includes('cajera') && (
                    <>
                      {/* Transacciones */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Transacciones por Mes</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="transacciones" fill="#8b5cf6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Tiempo Promedio */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Tiempo Promedio por Transacción</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="tiempoPromedio" stroke="#10b981" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Precisión */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Precisión en Transacciones</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis domain={[90, 100]} />
                            <Tooltip />
                            <Area type="monotone" dataKey="precision" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Ventas */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Ventas Totales por Mes</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="ventas" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {selectedEmployee.position.toLowerCase().includes('supervisor') && (
                    <>
                      {/* Empleados a Cargo */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Empleados a Cargo</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="empleadosCargo" stroke="#8b5cf6" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Evaluaciones */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Evaluaciones Realizadas</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="evaluaciones" fill="#10b981" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Incidentes Resueltos */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Incidentes Resueltos</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="incidentesResueltos" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Eficiencia del Equipo */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Eficiencia del Equipo</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis domain={[70, 100]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="eficiencia" stroke="#f97316" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {!['mesero', 'chef', 'cajera', 'supervisor'].some(role => selectedEmployee.position.toLowerCase().includes(role)) && (
                    <>
                      {/* Tareas Completadas */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Tareas Completadas por Mes</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="tareasCompletadas" fill="#8b5cf6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Eficiencia */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Eficiencia en el Trabajo</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis domain={[70, 100]} />
                            <Tooltip />
                            <Area type="monotone" dataKey="eficiencia" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Horas Trabajadas */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Horas Trabajadas por Mes</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="horasTrabajadas" stroke="#3b82f6" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Calificación */}
                      <div className="bg-white border border-gray-300 rounded-[15px] p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Calificación General</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={generateChartData(selectedEmployee.position)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis domain={[0, 5]} />
                            <Tooltip />
                            <Area type="monotone" dataKey="calificacion" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setSelectedEmployee(null)
                    setEditingEmployee(selectedEmployee.id)
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                >
                  Editar Empleado
                </button>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {isAddingEmployee && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm"
          style={{ minHeight: '100vh', minWidth: '100vw', width: '100%', height: '100%' }}
          onClick={() => { if (!isSavingNew) setIsAddingEmployee(false) }}
        >
          <div 
            className="bg-white rounded-[12px] shadow-2xl max-w-lg w-full mx-4 p-6 relative animate-fadeInSlide"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
              onClick={() => { if (!isSavingNew) setIsAddingEmployee(false) }}
              aria-label="Cerrar"
            >
              <span className="text-2xl leading-none">&times;</span>
            </button>
            <h2 className="font-semibold text-gray-800 text-lg mb-2">Agregar Nuevo Empleado</h2>
            <p className="text-xs text-gray-500 mb-4">Registra un nuevo empleado para el restaurante</p>
            {/* Form */}
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (isSavingNew) return
              if (!newEmployee.name || !newEmployee.email || !newEmployee.position || !newEmployee.salary || !newEmployee.department) {
                alert('Por favor completa todos los campos obligatorios')
                return
              }

              // Validaciones para cumplir con los CHECK CONSTRAINTS de la tabla
              const allowedPositions = ['Vendedor', 'Administración', 'Fábrica']
              const allowedDepartments = ['Ventas', 'Administración', 'Fábrica']
              if (!allowedPositions.includes(newEmployee.position)) {
                alert(`El cargo (position) debe ser uno de: ${allowedPositions.join(', ')}`)
                return
              }
              if (!allowedDepartments.includes(newEmployee.department)) {
                alert(`El departamento debe ser uno de: ${allowedDepartments.join(', ')}`)
                return
              }

              try {
                setIsSavingNew(true)
                const payload = {
                  name: newEmployee.name,
                  email: newEmployee.email,
                  phone: newEmployee.phone || null,
                  position: newEmployee.position,
                  department: newEmployee.department,
                  salary: parseFloat(newEmployee.salary),
                  payroll_type: newEmployee.payrollType,
                  start_date: newEmployee.startDate || new Date().toISOString().split('T')[0],
                  status: newEmployee.status,
                  shifts: newEmployee.shifts,
                  avatar: null as any
                }
                const { data, error } = await supabase
                  .from('employees')
                  .insert(payload)
                  .select('*')
                  .single()
                if (error) throw error

                if (data) {
                  const created: Employee = {
                    id: String(data.id),
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    position: data.position,
                    salary: Number(data.salary) || 0,
                    payrollType: data.payroll_type,
                    startDate: data.start_date,
                    status: data.status,
                    department: data.department,
                    shifts: Array.isArray(data.shifts) ? data.shifts : []
                  }
                  setEmployees(prev => [created, ...prev])
                }

                setNewEmployee({
                  name: '',
                  email: '',
                  phone: '',
                  position: '',
                  salary: '',
                  payrollType: 'mensual',
                  startDate: '',
                  status: 'activo',
                  department: '',
                  shifts: []
                })
                setIsAddingEmployee(false)
              } catch (err: any) {
                console.error('Insert employee error:', err)
                const message = err?.message || err?.error?.message || err?.details || 'Error desconocido'
                alert(`No se pudo guardar el empleado: ${message}`)
              } finally {
                setIsSavingNew(false)
              }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Información Personal */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 border-b border-gray-200 pb-2">Información Personal</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ej: Juan Pérez"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newEmployee.email}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="juan.perez@restaurant.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={newEmployee.phone}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="+1 234-567-8900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Inicio
                    </label>
                    <input
                      type="date"
                      value={newEmployee.startDate}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Información Laboral */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 border-b border-gray-200 pb-2">Información Laboral</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Posición *
                    </label>
                    <input
                      type="text"
                      value={newEmployee.position}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, position: e.target.value }))}
                      className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ej: Vendedor, Administración, Fábrica"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departamento *
                    </label>
                    <select
                      value={newEmployee.department}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seleccionar departamento</option>
                      <option value="Ventas">Ventas</option>
                      <option value="Administración">Administración</option>
                      <option value="Fábrica">Fábrica</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Salario *
                    </label>
                    <input
                      type="text"
                      value={newEmployee.salary}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, salary: e.target.value }))}
                      className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="1000.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Nómina
                    </label>
                    <select
                      value={newEmployee.payrollType}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, payrollType: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="mensual">Mensual</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="semanal">Semanal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado
                    </label>
                    <select
                      value={newEmployee.status}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Turnos */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">Turnos de Trabajo</h3>
                <div className="flex flex-wrap gap-2">
                  {['Mañana', 'Tarde', 'Noche'].map((shift) => (
                    <label key={shift} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newEmployee.shifts.includes(shift)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewEmployee(prev => ({ ...prev, shifts: [...prev.shifts, shift] }))
                          } else {
                            setNewEmployee(prev => ({ ...prev, shifts: prev.shifts.filter(s => s !== shift) }))
                          }
                        }}
                        className="mr-2 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">{shift}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { if (!isSavingNew) setIsAddingEmployee(false) }}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNew}
                  className={`px-3 py-1.5 rounded transition-colors text-sm ${isSavingNew ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isSavingNew ? 'Guardando…' : 'Agregar Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          style={{ minHeight: '100vh', minWidth: '100vw', width: '100%', height: '100%' }}
          onClick={() => { if (!isSavingEdit) setEditingEmployee(null) }}
        >
          <div 
            className="bg-white rounded max-w-2xl w-full max-h-[90vh] overflow-y-auto apple-scrollbar-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="relative mb-6">
                <h2 className="text-lg font-bold text-gray-900 text-center">Editar Empleado</h2>
                <button
                  onClick={() => { if (!isSavingEdit) setEditingEmployee(null) }}
                  className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all duration-200"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={async (e) => {
                e.preventDefault()
                if (isSavingEdit) return
                if (!editEmployee.name || !editEmployee.email || !editEmployee.position || !editEmployee.salary || !editEmployee.department) {
                  alert('Por favor completa todos los campos obligatorios')
                  return
                }

                // Validaciones alineadas con CHECK CONSTRAINTS
                const allowedPositions = ['Vendedor', 'Administración', 'Fábrica']
                const allowedDepartments = ['Ventas', 'Administración', 'Fábrica']
                if (!allowedPositions.includes(editEmployee.position)) {
                  alert(`El cargo (position) debe ser uno de: ${allowedPositions.join(', ')}`)
                  return
                }
                if (!allowedDepartments.includes(editEmployee.department)) {
                  alert(`El departamento debe ser uno de: ${allowedDepartments.join(', ')}`)
                  return
                }

                try {
                  setIsSavingEdit(true)
                  const payload: any = {
                    name: editEmployee.name,
                    email: editEmployee.email,
                    phone: editEmployee.phone || null,
                    position: editEmployee.position,
                    department: editEmployee.department,
                    salary: parseFloat(editEmployee.salary),
                    payroll_type: editEmployee.payrollType,
                    start_date: editEmployee.startDate,
                    status: editEmployee.status,
                    shifts: editEmployee.shifts
                  }
                  const { data, error } = await supabase
                    .from('employees')
                    .update(payload)
                    .eq('id', editingEmployee)
                    .select('*')
                    .single()
                  if (error) throw error

                  if (data) {
                    const updated: Employee = {
                      id: String(data.id),
                      name: data.name,
                      email: data.email,
                      phone: data.phone,
                      position: data.position,
                      salary: Number(data.salary) || 0,
                      payrollType: data.payroll_type,
                      startDate: data.start_date,
                      status: data.status,
                      department: data.department,
                      shifts: Array.isArray(data.shifts) ? data.shifts : []
                    }
                    setEmployees(prev => prev.map(emp => emp.id === editingEmployee ? updated : emp))
                  }
                  setEditingEmployee(null)
                } catch (err: any) {
                  console.error('Update employee error:', err)
                  const message = err?.message || err?.error?.message || err?.details || 'Error desconocido'
                  alert(`No se pudo actualizar el empleado: ${message}`)
                } finally {
                  setIsSavingEdit(false)
                }
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Información Personal */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800 border-b border-gray-200 pb-2">Información Personal</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre Completo *
                      </label>
                      <input
                        type="text"
                        value={editEmployee.name}
                        onChange={(e) => setEditEmployee(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Ej: Juan Pérez"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={editEmployee.email}
                        onChange={(e) => setEditEmployee(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="juan.perez@restaurant.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={editEmployee.phone}
                        onChange={(e) => setEditEmployee(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="+1 234-567-8900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de Inicio
                      </label>
                      <input
                        type="date"
                        value={editEmployee.startDate}
                        onChange={(e) => setEditEmployee(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Información Laboral */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800 border-b border-gray-200 pb-2">Información Laboral</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Posición *
                      </label>
                      <input
                        type="text"
                        value={editEmployee.position}
                        onChange={(e) => setEditEmployee(prev => ({ ...prev, position: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ej: Vendedor, Administración, Fábrica"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Departamento *
                      </label>
                      <select
                        value={editEmployee.department}
                        onChange={(e) => setEditEmployee(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      >
                      <option value="">Seleccionar departamento</option>
                      <option value="Ventas">Ventas</option>
                      <option value="Administración">Administración</option>
                      <option value="Fábrica">Fábrica</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Salario *
                      </label>
                      <input
                        type="text"
                        value={editEmployee.salary}
                        onChange={(e) => setEditEmployee(prev => ({ ...prev, salary: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="1000.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Nómina
                      </label>
                      <select
                        value={editEmployee.payrollType}
                        onChange={(e) => setEditEmployee(prev => ({ ...prev, payrollType: e.target.value as any }))}
                        className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="mensual">Mensual</option>
                        <option value="quincenal">Quincenal</option>
                        <option value="semanal">Semanal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Estado
                      </label>
                      <select
                        value={editEmployee.status}
                        onChange={(e) => setEditEmployee(prev => ({ ...prev, status: e.target.value as any }))}
                        className="w-full px-3 py-2 bg-white text-black border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Turnos */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">Turnos de Trabajo</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Mañana', 'Tarde', 'Noche'].map((shift) => (
                      <label key={shift} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editEmployee.shifts.includes(shift)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditEmployee(prev => ({ ...prev, shifts: [...prev.shifts, shift] }))
                            } else {
                              setEditEmployee(prev => ({ ...prev, shifts: prev.shifts.filter(s => s !== shift) }))
                            }
                          }}
                          className="mr-2 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">{shift}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => { if (!isSavingEdit) setEditingEmployee(null) }}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className={`px-3 py-1.5 rounded transition-colors text-sm ${isSavingEdit ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    {isSavingEdit ? 'Guardando…' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 