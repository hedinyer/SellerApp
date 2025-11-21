import { useState, useEffect } from 'react'
import './animations.css'
import SpotlightCard from './SpotlightCard'
import Stepper, { Step } from './Stepper'
import { useConfig } from '../contexts/ConfigContext'
import { useOrders } from '../contexts/OrderContext'
import { useAuth } from '../contexts/AuthContext'
import {
  ClipboardIcon,
  TableIcon,
  PlusIcon,
  MinusIcon,
  ShoppingCartIcon,
  UserIcon,
  TrashIcon,
  CheckIcon
} from './icons'

interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  description: string
  image?: string
  available: boolean
}

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  notes?: string
}

interface Table {
  number: number
  capacity: number
  status: 'available' | 'occupied'
  guests?: number
}

// Componente para el ícono de chef personalizado
const ChefIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./cocina.png" 
    alt="Chef" 
    width={size} 
    height={size} 
    className={className}
  />
)

// Componente para el ícono de mesa personalizado
const TableCustomIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <img 
    src="./mesa.png" 
    alt="Mesa" 
    width={size} 
    height={size} 
    className={className}
  />
)

export function TakeOrder() {
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [guests, setGuests] = useState(0)
  const [showCompletedAnimation, setShowCompletedAnimation] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const { t, formatCurrency, getFontSizeClass } = useConfig()
  const { addOrder } = useOrders()
  const { user } = useAuth()

  // Función para normalizar texto (eliminar acentos y caracteres especiales)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos y diacríticos
      .replace(/[^a-z0-9\s]/g, '') // Elimina caracteres especiales excepto espacios
      .trim()
  }

  useEffect(() => {
    // Simulate loading with shorter delay
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  // Mock data para mesas disponibles
  const availableTables: Table[] = [
    { number: 1, capacity: 2, status: 'available' },
    { number: 3, capacity: 4, status: 'available' },
    { number: 6, capacity: 6, status: 'available' },
    { number: 11, capacity: 4, status: 'available' },
    { number: 16, capacity: 2, status: 'available' },
    { number: 19, capacity: 8, status: 'available' },
    { number: 20, capacity: 6, status: 'available' },
    { number: 30, capacity: 4, status: 'available' },
    { number: 34, capacity: 2, status: 'available' },
    { number: 43, capacity: 8, status: 'available' },
    { number: 44, capacity: 4, status: 'available' },
    { number: 45, capacity: 6, status: 'available' },
    { number: 46, capacity: 2, status: 'available' },
    { number: 47, capacity: 4, status: 'available' },
    { number: 48, capacity: 8, status: 'available' }
  ]

  // Mock data para el menú
  const menuItems: MenuItem[] = [
    // Entrantes
    { id: '1', name: 'Jamón Ibérico', category: 'entrantes', price: 34.90, description: 'Jamón ibérico de bellota cortado a mano', available: true },
    { id: '2', name: 'Pulpo a la Gallega', category: 'entrantes', price: 28.90, description: 'Pulpo cocido con papas, pimentón y aceite de oliva', available: true },
    { id: '3', name: 'Croquetas Caseras', category: 'entrantes', price: 14.90, description: 'Croquetas de jamón ibérico (6 unidades)', available: true },
    { id: '4', name: 'Tortilla Española', category: 'entrantes', price: 16.90, description: 'Tortilla de patatas tradicional', available: true },
    { id: '5', name: 'Gazpacho', category: 'entrantes', price: 9.90, description: 'Gazpacho andaluz con verduras frescas', available: true },

    // Principales
    { id: '6', name: 'Paella Valenciana', category: 'principales', price: 28.90, description: 'Paella tradicional con pollo, conejo y verduras', available: true },
    { id: '7', name: 'Chuletón Ibérico', category: 'principales', price: 45.90, description: 'Chuletón de cerdo ibérico a la parrilla (400g)', available: true },
    { id: '8', name: 'Lubina a la Sal', category: 'principales', price: 42.90, description: 'Lubina fresca cocinada en costra de sal', available: true },
    { id: '9', name: 'Cochinillo Asado', category: 'principales', price: 48.90, description: 'Cochinillo segoviano asado al horno', available: true },
    { id: '10', name: 'Arroz con Bogavante', category: 'principales', price: 56.90, description: 'Arroz cremoso con bogavante fresco', available: true },
    { id: '11', name: 'Secreto Ibérico', category: 'principales', price: 28.90, description: 'Secreto ibérico a la plancha con verduras', available: true },

    // Postres
    { id: '12', name: 'Crema Catalana', category: 'postres', price: 12.90, description: 'Crema catalana tradicional quemada', available: true },
    { id: '13', name: 'Tiramisú', category: 'postres', price: 14.90, description: 'Tiramisú italiano casero', available: true },
    { id: '14', name: 'Flan Casero', category: 'postres', price: 8.90, description: 'Flan de huevo con caramelo', available: true },
    { id: '15', name: 'Tarta de Queso', category: 'postres', price: 15.90, description: 'Tarta de queso New York', available: true },

    // Bebidas
    { id: '16', name: 'Vino Tinto Reserva', category: 'bebidas', price: 32.90, description: 'Vino tinto Ribera del Duero', available: true },
    { id: '17', name: 'Albariño', category: 'bebidas', price: 28.90, description: 'Vino blanco Rías Baixas', available: true },
    { id: '18', name: 'Sangría', category: 'bebidas', price: 18.50, description: 'Sangría de la casa (1 litro)', available: true },
    { id: '19', name: 'Cerveza Artesanal', category: 'bebidas', price: 8.90, description: 'Cerveza artesanal local', available: true },
    { id: '20', name: 'Agua Mineral', category: 'bebidas', price: 4.50, description: 'Agua mineral con gas o sin gas', available: true }
  ]

  const categories = [
    { id: 'all', name: t('all'), icon: '🍽️' },
    { id: 'entrantes', name: t('starters'), icon: '🥗' },
    { id: 'principales', name: t('mains'), icon: '🍖' },
    { id: 'postres', name: t('desserts'), icon: '🍰' },
    { id: 'bebidas', name: t('drinks'), icon: '🍷' }
  ]

  const filteredItems = menuItems.filter(item => {
    // Filter by category
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    
    // Filter by search query (sin acentos)
    const matchesSearch = searchQuery === '' || (() => {
      const normalizedQuery = normalizeText(searchQuery)
      const normalizedName = normalizeText(item.name)
      const normalizedDescription = normalizeText(item.description)
      
      return normalizedName.includes(normalizedQuery) || 
             normalizedDescription.includes(normalizedQuery)
    })()
    
    return matchesCategory && matchesSearch
  })

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id)
    if (existingItem) {
      setCart(cart.map(cartItem => 
        cartItem.id === item.id 
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ))
    } else {
      setCart([...cart, { 
        id: item.id, 
        name: item.name, 
        price: item.price, 
        quantity: 1 
      }])
    }
  }

  const removeFromCart = (itemId: string) => {
    const existingItem = cart.find(cartItem => cartItem.id === itemId)
    if (existingItem && existingItem.quantity > 1) {
      setCart(cart.map(cartItem => 
        cartItem.id === itemId 
          ? { ...cartItem, quantity: cartItem.quantity - 1 }
          : cartItem
      ))
    } else {
      setCart(cart.filter(cartItem => cartItem.id !== itemId))
    }
  }

  const clearCart = () => {
    setCart([])
  }

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  const resetOrder = () => {
    setCart([])
    setSelectedTable(null)
    setGuests(0)
    setSelectedCategory('all')
    setSearchQuery('')
    setCurrentStep(1)
  }

  // Validaciones para cada paso
  const isStep1Valid = () => {
    if (selectedTable === null || guests === 0) return false
    
    // Verificar que la mesa tenga suficiente capacidad
    const table = availableTables.find(t => t.number === selectedTable)
    if (!table) return false
    
    return table.capacity >= guests
  }

  const isStep2Valid = () => {
    return cart.length > 0
  }

  const isStepValid = (step: number) => {
    switch(step) {
      case 1: return isStep1Valid()
      case 2: return isStep2Valid()
      default: return true
    }
  }

  const handleSubmitOrder = () => {
    if (!selectedTable || cart.length === 0) {
      alert(t('pleaseSelectTable'))
      return
    }

    // Convertir cart items al formato del contexto de órdenes
    const orderItems = cart.map(cartItem => {
      const menuItem = menuItems.find(mi => mi.id === cartItem.id)
      return {
        id: cartItem.id,
        name: cartItem.name,
        category: menuItem?.category || 'other',
        quantity: cartItem.quantity,
        notes: cartItem.notes
      }
    })

    const orderData = {
      table: selectedTable,
      guests: guests,
      items: orderItems,
      waiter: user?.name || 'Usuario'
    }

    // Enviar orden al contexto (que la enviará a cocina)
    addOrder(orderData)
    
    console.log('Orden enviada a cocina:', orderData)
    
    // Mostrar animación de completado
    setShowCompletedAnimation(true)
    
    // Después de 3 segundos, resetear todo
    setTimeout(() => {
      setShowCompletedAnimation(false)
      resetOrder()
    }, 3000)
  }

  return (
    <div 
      className={`h-full overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 relative transition-opacity duration-500 ${
        isLoading ? 'opacity-0' : 'opacity-100'
      } ${getFontSizeClass()}`}
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <div className="p-6">
        
        {/* Completed Animation Overlay */}
        {showCompletedAnimation && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 text-center max-w-sm mx-4 animate-bounce-in">
              <div className="mb-4">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <CheckIcon size={40} className="text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-green-600 mb-2">{t('orderConfirmed')}</h3>
              <p className="text-gray-600 mb-2">{t('table')} {selectedTable}</p>
              <p className="text-xl font-bold text-gray-900 mb-4">{formatCurrency(getTotalPrice())}</p>
              <div className="flex items-center justify-center space-x-1 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">{t('sendingToKitchen')}</p>
            </div>
          </div>
        )}

        {/* Stepper Component */}
        <Stepper
          initialStep={currentStep}
          onStepChange={(step) => {
            setCurrentStep(step);
            console.log('Paso cambiado a:', step);
          }}
          onFinalStepCompleted={() => {
            console.log('Todos los pasos completados!');
          }}
          backButtonText={t('previous')}
          nextButtonText={t('next')}
          validateStep={isStepValid}
        >
          {/* Paso 1: Selección de Mesa */}
          <Step>
            <div className="w-full max-w-5xl mx-auto">
              {/* Header - Homogeneizado con Dashboard */}
              <div className="mb-8 animate-fadeInSlide text-center">
                              <h1 className="text-3xl font-bold text-black mb-2 tracking-tight">
                {t('selectTable')}
              </h1>
              <p className="text-gray-600 font-medium">
                {t('step1Subtitle')}
              </p>
              </div>

              {/* Configuración de Huéspedes */}
              <div className="mb-8 animate-slideInUp" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center justify-center">
                  {/* Quick Selection Buttons */}
                  <div>
                    <div className="grid grid-cols-8 gap-3 max-w-4xl mx-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num, index) => (
                        <button
                          key={num}
                          onClick={() => setGuests(num)}
                          className={`group relative overflow-hidden rounded-2xl aspect-square transition-all duration-300 transform hover:scale-105 w-20 h-20
                            ${guests === num
                              ? 'bg-black text-white border-2 border-black shadow-lg ring-2 ring-black'
                              : 'bg-white border-2 border-black text-black hover:bg-gray-100 hover:shadow-md'}
                          `}
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          {/* Shine effect */}
                          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          {/* Selection indicator */}
                          {guests === num && (
                            <div className="absolute top-2 right-2">
                              <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center">
                                <CheckIcon size={14} className="text-white" />
                              </div>
                            </div>
                          )}
                          {/* Content */}
                          <div className="relative z-10 flex flex-col items-center justify-center h-full p-2">
                            {/* Person icons visualization */}
                            <div className="flex flex-wrap items-center justify-center gap-0.5 mb-1">
                              {Array.from({ length: Math.min(num, 4) }, (_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 h-2 rounded-full ${guests === num ? 'bg-white/80' : 'bg-black'}`}
                                />
                              ))}
                              {num > 4 && (
                                <span className={`text-xs font-bold ml-0.5 ${guests === num ? 'text-white' : 'text-black'}`}>+</span>
                              )}
                            </div>
                            {/* Number */}
                            <div className={`text-3xl font-bold transition-colors ${guests === num ? 'text-white' : 'text-black'}`}>{num}</div>
                            {/* Label */}
                            <div className={`text-xs font-medium transition-colors ${guests === num ? 'text-white/90' : 'text-black/60'}`}>{num === 1 ? t('person') : t('people')}</div>
                          </div>
                          {/* Ripple effect */}
                          <div className="absolute inset-0 bg-black/10 rounded-2xl scale-0 group-active:scale-100 transition-transform duration-150"></div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>



              <div className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
                <div className="bg-white border-b border-gray-200 p-2 sm:p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <div className="text-left">
                        <h3 className="font-bold text-black text-sm sm:text-base text-left">{t('availableTables')}</h3>
                        <p className="text-gray-600 text-xs text-left">{t('selectPreferredTable')}</p>
                      </div>
                    </div>
                    <div className="bg-white px-2 py-1 rounded border border-gray-200">
                      <span className="text-black font-bold text-xs">
                        {availableTables.length} {t('availableText')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-2 sm:p-3 bg-gray-50">

                  
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9 gap-1.5 sm:gap-2 mb-3">
                    {availableTables.map((table, index) => {
                      // Lógica para determinar si la mesa es recomendada
                      const isRecommended = table.capacity >= guests && table.capacity <= guests + 2;
                      const isPerfectMatch = table.capacity === guests || (guests <= 2 && table.capacity === 2);
                      const isTooSmall = table.capacity < guests;
                      
                      return (
                        <div
                          key={table.number}
                          className="group perspective-1000 animate-slideInUp"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <button
                            onClick={() => !isTooSmall && setSelectedTable(table.number)}
                            disabled={isTooSmall}
                            className={`
                              relative w-full aspect-square rounded-2xl transition-all duration-300 
                              transform-gpu hover:scale-105 hover:-translate-y-1 hover:rotate-1
                              ${selectedTable === table.number && !isTooSmall
                                ? 'border-4 border-green-400'
                                : 'border-2 border-gray-200'}
                              ${isTooSmall ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                              ${isPerfectMatch
                                ? 'bg-gradient-to-br from-blue-200 to-blue-400'
                                : isRecommended
                                ? 'bg-gradient-to-br from-blue-100 to-blue-300'
                                : isTooSmall
                                ? 'bg-gradient-to-br from-red-200 to-red-400'
                                : 'bg-gradient-to-br from-white to-gray-100 hover:border-blue-400'}
                            `}
                          >
                            {/* Recommendation Badge */}
                            {isPerfectMatch && selectedTable !== table.number && (
                              <div className="absolute -top-0.5 -right-0.5 z-10">
                                <div className="bg-blue-500 text-white text-xs px-1 py-0.5 rounded font-bold">
                                  ⭐
                                </div>
                              </div>
                            )}
                            {/* Show star even if selected and perfect match */}
                            {isPerfectMatch && selectedTable === table.number && (
                              <div className="absolute -top-0.5 -right-0.5 z-10">
                                <div className="bg-blue-500 text-white text-xs px-1 py-0.5 rounded font-bold">
                                  ⭐
                                </div>
                              </div>
                            )}
                            
                            {isTooSmall && (
                              <div className="absolute -top-0.5 -right-0.5 z-10">
                                <div className="bg-red-400 text-white text-xs px-1 py-0.5 rounded font-bold">
                                  ✕
                                </div>
                              </div>
                            )}

                            {/* Background Pattern */}
                            <div className="absolute inset-0 rounded-2xl overflow-hidden">
                              <div className={`absolute inset-0 opacity-10 ${
                                selectedTable === table.number 
                                  ? 'bg-emerald-600' 
                                  : isPerfectMatch 
                                  ? 'bg-blue-600'
                                  : isRecommended
                                  ? 'bg-blue-400'
                                  : isTooSmall
                                  ? 'bg-red-600'
                                  : 'bg-slate-500'
                              }`}></div>
                            </div>

                            {/* Selection Check */}
                            {selectedTable === table.number && (
                              <div className="absolute top-1.5 right-1.5">
                                <div className="bg-emerald-500 text-white p-0.5 rounded animate-bounce">
                                  <CheckIcon size={6} />
                                </div>
                              </div>
                            )}

                            {/* Mesa Number - Prominent Display */}
                            <div className="relative flex flex-col items-center justify-center h-full">
                              <div className={`
                                text-lg sm:text-xl md:text-2xl font-black tracking-tight mb-0.5 text-black
                                transition-all duration-300 transform group-hover:scale-105
                              `}>
                                {table.number}
                              </div>
                              
                              {/* Capacity Badge */}
                              <div className="px-1 py-0.5 rounded text-xs font-semibold bg-white/80 text-black transition-all duration-300">
                                <UserIcon size={6} className="inline mr-0.5 text-black" />
                                {table.capacity}
                              </div>
                              
                              {/* Status Text */}
                              {isPerfectMatch && selectedTable !== table.number && (
                                <div className="text-xs font-bold mt-0.5 text-black">
                                  {t('ideal')}
                                </div>
                              )}
                              {isRecommended && !isPerfectMatch && selectedTable !== table.number && (
                                <div className="text-xs font-medium mt-0.5 text-black">
                                  {t('good')}
                                </div>
                              )}
                              {isTooSmall && (
                                <div className="text-xs font-medium mt-0.5 text-black">
                                  {t('smallTable')}
                                </div>
                              )}
                            </div>

                            {/* Shine Effect */}
                            <div className="absolute inset-0 rounded overflow-hidden">
                              <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-white/20 to-transparent transform rotate-12 translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out"></div>
                            </div>

                            {/* Hover Glow */}
                            <div className={`
                              absolute inset-0 rounded transition-opacity duration-300
                              ${selectedTable === table.number 
                                ? 'bg-emerald-400/10' 
                                : isPerfectMatch
                                ? 'bg-blue-400/10'
                                : 'bg-blue-400/0 group-hover:bg-blue-400/10'
                              }
                            `}></div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Legend */}
                  <div className="bg-white/70 rounded p-2 border border-gray-200/50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 rounded bg-blue-500"></div>
                        <span className="text-gray-700">⭐ {t('ideal')}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 rounded bg-blue-300"></div>
                        <span className="text-gray-700">{t('recommended')}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 rounded bg-gray-300"></div>
                        <span className="text-gray-700">{t('available')}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 rounded bg-red-300"></div>
                        <span className="text-gray-700">✕ {t('tooSmall')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Step>

          {/* Paso 2: Menú de Productos */}
          <Step>
            <div className="w-full max-w-5xl mx-auto">
              {/* Header - Homogeneizado con Dashboard */}
              <div className="mb-8 animate-fadeInSlide text-center">
                              <h1 className="text-3xl font-bold text-black mb-2 tracking-tight">
                {t('menuTitle')}
              </h1>
              <p className="text-gray-600 font-medium">
                {t('step2Subtitle').replace('{table}', selectedTable?.toString() || '').replace('{guests}', guests.toString())}
              </p>
              </div>

              {/* Progress Summary */}
              <div className="bg-white rounded-[8px] border border-gray-100 animate-slideInUp mb-8 max-w-[820px] mx-auto" style={{ animationDelay: '100ms' }}>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <TableIcon size={18} className="text-blue-600 mr-2" />
                      <h3 className="font-semibold text-gray-800 text-sm">{t('orderProgress')}</h3>
                    </div>
                    <div className="flex items-center space-x-6 text-xs">
                      <span className="text-gray-600">
                        {t('table')}: <span className="font-medium text-blue-600">{selectedTable}</span>
                      </span>
                      <span className="text-gray-600">
                        {t('guests')}: <span className="font-medium text-blue-600">{guests}</span>
                      </span>
                      <span className="text-gray-600">
                        {t('products')}: <span className="font-medium text-green-600">{getTotalItems()}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
                <div className="bg-white border-b border-gray-200 p-2 sm:p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <div>
                        <h3 className="font-bold text-black text-sm sm:text-base">{t('menuTitle')}</h3>
                        <p className="text-gray-600 text-xs">{t('selectPreferredTable')}</p>
                      </div>
                    </div>
                    <div className="bg-white px-2 py-1 rounded border border-gray-200">
                      <span className="text-black font-bold text-xs">
                        {filteredItems.length} {t('availableText')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-2 sm:p-3 bg-white">
                  {/* Search Bar */}
                  <div className="mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('search')}
                        className="w-full px-3 py-2 bg-gray-50 border-0 border-b border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors duration-200 text-sm"
                      />
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
                          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors duration-200 opacity-60 hover:opacity-100"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category Filters */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`px-4 py-2 rounded text-xs font-semibold transition-all duration-300 transform hover:scale-105
                          ${selectedCategory === category.id
                            ? 'bg-black text-white border border-black'
                            : 'bg-white text-black border border-black hover:bg-gray-100'}
                        `}
                      >
                        <span className="mr-1">{category.icon}</span>
                        {category.name}
                      </button>
                    ))}
                  </div>
                  
                                      <div className="max-h-[450px] sm:max-h-[550px] md:max-h-[600px] overflow-y-auto pr-2 -mr-2 py-1 kitchen-scrollbar">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {filteredItems.map((item, index) => {
                        const cartItem = cart.find(cartItem => cartItem.id === item.id);
                        const isInCart = !!cartItem;
                        
                        return (
                          <div
                            key={item.id}
                            className="group bg-white rounded-[8px] border border-gray-200 flex p-2 transition-all duration-300 hover:bg-gray-50 hover:border-gray-300 relative"
                          >
                            {/* Add/Remove buttons - top right of card */}
                            <div className="absolute -top-1 -right-1 flex gap-1 z-10">
                              {/* Remove button - only show when item is in cart */}
                              {isInCart && (
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="w-6 h-6 sm:w-7 sm:h-7 bg-red-500 text-white flex items-center justify-center hover:scale-110 hover:bg-red-600 transition-all duration-200 rounded-full"
                                >
                                  <MinusIcon size={12} className="sm:w-3.5 sm:h-3.5" />
                                </button>
                              )}
                              
                              {/* Add button */}
                              <button
                                onClick={() => addToCart(item)}
                                className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-600 text-white flex items-center justify-center hover:scale-110 hover:bg-blue-500 transition-all duration-200 rounded-full"
                              >
                                <PlusIcon size={12} className="sm:w-3.5 sm:h-3.5" />
                              </button>
                            </div>

                            {/* Left side: text info */}
                            <div className="flex-grow flex flex-col pr-8 text-left">
                              <h4 className="font-bold text-gray-900 text-xs sm:text-sm text-left">{item.name}</h4>
                              <p className="text-gray-600 text-xs mt-1 flex-grow line-clamp-2 text-left">{item.description}</p>
                              <div className="mt-1">
                                <span className="font-bold text-gray-700 text-xs text-left">{t('productInfo')}</span>
                                <div className="text-right">
                                  <p className="text-blue-600 text-sm font-bold mt-0 text-left break-all leading-tight">{formatCurrency(item.price)}</p>
                                </div>
                              </div>
                            </div>

                            {/* Right side: image */}
                            <div className="flex-shrink-0 w-16 sm:w-18 h-16 sm:h-18 relative self-center">
                              {/* Image Placeholder */}
                              <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                                <div className="text-4xl sm:text-5xl opacity-60">
                                  {categories.find(cat => cat.id === item.category)?.icon || '🍽️'}
                                </div>
                              </div>
                              
                              {/* In Cart Indicator */}
                              {isInCart && (
                                <div className="absolute bottom-0 right-0 transform translate-x-1/4 translate-y-1/4">
                                    <div className="bg-green-500 text-white text-xs w-4 h-4 rounded-full font-bold flex items-center justify-center ring-2 ring-white/50">
                                      {cartItem.quantity}
                                    </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    
                    {filteredItems.length === 0 && (
                      <div className="text-center py-12 text-gray-600">
                        <ChefIcon size={48} className="mx-auto mb-4 opacity-30" />
                        {searchQuery ? (
                          <>
                            <p className="text-lg mb-2">{t('noResultsFound')} "{searchQuery}"</p>
                            <p className="text-sm">{t('tryOtherTerms')}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg mb-2">{t('noProductsInCategory')}</p>
                            <p className="text-sm">{t('trySelectingOther')}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cart Summary Fixed at Bottom - Enhanced for responsive prices */}
              {cart.length > 0 && (
                <div className="fixed bottom-4 left-4 right-4 z-50 lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:mt-4">
                  <div className="bg-white rounded-lg border-2 border-green-400 p-3 rounded-[8px]">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="bg-green-500 p-2 rounded-lg flex-shrink-0">
                          <ShoppingCartIcon size={16} className="text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-sm">
                            {getTotalItems()} {t('productsText')}
                          </p>
                          <p className="text-xs text-gray-600">
                            {t('tableNumber', { number: selectedTable ?? 0 })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-black text-lg text-green-600 break-all leading-tight">
                          {formatCurrency(getTotalPrice())}
                        </p>
                        <p className="text-xs text-gray-500">{t('total')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Step>

          {/* Paso 3: Carrito y Resumen */}
          <Step>
            <div className="w-full max-w-5xl mx-auto">
              {/* Header - Homogeneizado con Dashboard */}
              <div className="mb-8 animate-fadeInSlide text-center">
                              <h1 className="text-3xl font-bold text-black mb-2 tracking-tight">
                {t('orderSummary')}
              </h1>
              <p className="text-gray-600 font-medium">
                {t('step3Subtitle').replace('{table}', selectedTable?.toString() || '')}
              </p>
              </div>

              

              {/* Order Summary Cards - Dashboard Style, ahora en una sola línea */}
              <div className="flex gap-4 mb-8 justify-center flex-wrap">
                {/* Table Info */}
                <div className="w-full max-w-[180px]">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-32 flex flex-col justify-between metallic-bg" style={{ animationDelay: '0ms', boxShadow: '0 4px 16px 0 rgba(59,130,246,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full">
                        <h3 className="font-semibold text-black text-sm mb-2 tracking-wide uppercase opacity-80 text-center w-full">{t('table')}</h3>
                        <div className="flex flex-col items-center justify-center flex-1">
                          <p className="text-4xl font-extrabold text-black" style={{ fontFamily: 'Helvetica Neue' }}>{selectedTable}</p>
                        </div>
                        <p className="text-xs font-normal text-black/70 leading-tight text-center">{guests} {guests === 1 ? t('person') : t('people')}</p>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>

                {/* Total Info - más ancha, ahora en el centro */}
                <div className="w-full max-w-[340px]">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-32 flex flex-col justify-between metallic-bg" style={{ animationDelay: '200ms', boxShadow: '0 4px 16px 0 rgba(34,197,94,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full">
                        <h3 className="font-semibold text-black text-sm mb-2 tracking-wide uppercase opacity-80 text-center w-full">{t('total')}</h3>
                        <div className="flex flex-col items-center justify-center flex-1">
                          <p className="text-4xl font-extrabold text-black" style={{ fontFamily: 'Helvetica Neue' }}>{formatCurrency(getTotalPrice())}</p>
                        </div>
                        <p className="text-xs font-normal text-black/70 leading-tight text-center">{t('including')} {t('taxes')}</p>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>

                {/* Products Info - ahora a la derecha */}
                <div className="w-full max-w-[180px]">
                  <SpotlightCard spotlightColor="rgba(0, 0, 0, 0.08)">
                    <div className="rounded-2xl px-4 py-6 shadow-2xl animate-slideInUp relative overflow-hidden h-32 flex flex-col justify-between metallic-bg" style={{ animationDelay: '100ms', boxShadow: '0 4px 16px 0 rgba(168,85,247,0.15)' }}>
                      <div className="absolute inset-0 pointer-events-none metallic-shine" />
                      <div className="flex flex-col justify-between h-full">
                        <h3 className="font-semibold text-black text-sm mb-2 tracking-wide uppercase opacity-80 text-center w-full">{t('products')}</h3>
                        <div className="flex flex-col items-center justify-center flex-1">
                          <p className="text-4xl font-extrabold text-black" style={{ fontFamily: 'Helvetica Neue' }}>{getTotalItems()}</p>
                        </div>
                        <p className="text-xs font-normal text-black/70 leading-tight text-center">{cart.length} {cart.length === 1 ? t('type') : t('types')}</p>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
              </div>

              {cart.length > 0 ? (
                <div className="space-y-4">
                  {/* Order Items */}
                  <div className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800">{t('yourOrder')}</h3>
                        <div className="flex items-center space-x-2">
                                                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              {getTotalItems()} {t('items')}
                            </span>
                          {cart.length > 0 && (
                            <button
                              onClick={clearCart}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition-all duration-200"
                              title={t('clearCartTooltip')}
                            >
                              <TrashIcon size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                                        {/* Table Headers */}
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                      <div className="flex items-center space-x-4">
                        {/* Product Icon Header */}
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">🍽️</span>
                        </div>
                        
                        {/* Product Info Header - Aligned left to match content */}
                        <div className="flex-grow min-w-0">
                          <span className="text-xs font-medium text-gray-600">{t('productInfo')}</span>
                        </div>
                        
                        {/* Quantity Controls Header - Centered to match controls */}
                        <div className="flex items-center justify-center min-w-[140px]">
                          <span className="text-xs font-medium text-gray-600">{t('quantity')}</span>
                        </div>
                        
                        {/* Subtotal Header - Right aligned */}
                        <div className="text-right min-w-[80px]">
                          <span className="text-xs font-medium text-gray-600">{t('subtotal')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                      {cart.map((item, index) => {
                        const menuItem = menuItems.find(mi => mi.id === item.id);
                        const categoryIcon = categories.find(cat => cat.id === menuItem?.category)?.icon || '🍽️';
                        
                        return (
                          <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors duration-200">
                            <div className="flex items-center space-x-4">
                              {/* Product Icon */}
                              <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">{categoryIcon}</span>
                              </div>
                              
                              {/* Product Info - Enhanced for responsive prices */}
                              <div className="flex-grow min-w-0">
                                <h4 className="font-semibold text-gray-900 line-clamp-2">{item.name}</h4>
                                <p className="text-sm text-gray-600 break-all leading-tight">{formatCurrency(item.price)} {t('unitPrice')}</p>
                              </div>
                              
                              {/* Quantity Controls */}
                              <div className="flex items-center space-x-3 flex-shrink-0">
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors duration-200"
                                >
                                  <MinusIcon size={16} />
                                </button>
                                
                                <div className="bg-gray-100 px-3 py-1 rounded-full min-w-[60px] text-center">
                                  <span className="font-bold text-gray-900">{item.quantity}</span>
                                </div>
                                
                                <button
                                  onClick={() => addToCart(menuItems.find(mi => mi.id === item.id)!)}
                                  className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors duration-200"
                                >
                                  <PlusIcon size={16} />
                                </button>
                              </div>
                              
                              {/* Subtotal - Enhanced for responsive prices */}
                              <div className="text-right min-w-[100px] flex-shrink-0">
                                <p className="font-bold text-lg text-gray-900 break-all leading-tight">{formatCurrency(item.price * item.quantity)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Total Section - Enhanced for responsive prices */}
                    <div className="bg-gray-50 px-4 py-4 border-t border-gray-200">
                      <div className="flex justify-between items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-600">{t('orderTotal')}</p>
                          <p className="text-xs text-gray-500">{getTotalItems()} {t('products')} • {t('table')} {selectedTable}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-2xl font-black text-green-600 break-all leading-tight">{formatCurrency(getTotalPrice())}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={handleSubmitOrder}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-4 px-6 rounded text-lg font-bold transition-all duration-200 active:scale-95 flex items-center justify-center space-x-2"
                    >
                      <CheckIcon size={20} />
                      <span>{t('confirmOrder')}</span>
                    </button>
                    
                    <p className="text-center text-xs text-gray-500">
                      {t('canEditQuantities')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-[8px] border border-gray-200">
                  <ShoppingCartIcon size={48} className="mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('noProductsInOrder')}</h3>
                  <p className="text-sm text-gray-500 mb-4">{t('goBackToPrevious')}</p>
                </div>
              )}
            </div>
          </Step>
        </Stepper>
      </div>
    </div>
  )
}