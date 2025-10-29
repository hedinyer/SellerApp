import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { AdminSidebar } from './components/AdminSidebar'
import { Dashboard } from './components/Dashboard'
import { AdminDashboard } from './components/AdminDashboard'
import { AdminEmployees } from './components/AdminEmployees'
import { AdminExpenses } from './components/AdminExpenses'
import { AdminDebts } from './components/AdminDebts'
import { AdminInventory } from './components/AdminInventory'
import { UserInventory } from './components/UserInventory'
import { TakeOrder } from './components/TakeOrder'
import { PaymentHistory } from './components/PaymentHistory'
import { Settings } from './components/Settings'
import { Login } from './components/Login'
import { KitchenDashboard } from './components/KitchenDashboard'
import { Clients } from './components/Clients'
import { ConfigProvider } from './contexts/ConfigContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { OrderProvider } from './contexts/OrderContext'
import './components/animations.css'
import './components/config-styles.css'

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [previousPage, setPreviousPage] = useState('')
  const { user, isLoading } = useAuth()

  // Set initial page based on user role
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setCurrentPage('admin-dashboard')
      } else if (user.role === 'frontman') {
        setCurrentPage('dashboard')
      }
      // kitchen role uses its own dashboard without page navigation
    }
  }, [user])

  // Handle page navigation with smooth transitions
  const handlePageNavigation = (newPage: string) => {
    if (newPage === currentPage) return

    // Start transition
    setIsTransitioning(true)
    setPreviousPage(currentPage)

    // Short delay to allow exit animation
    setTimeout(() => {
      setCurrentPage(newPage)
      
      // End transition after enter animation completes
      setTimeout(() => {
        setIsTransitioning(false)
        setPreviousPage('')
      }, 400)
    }, 100)
  }

  const renderCurrentPage = () => {
    // Si el usuario es de cocina, solo mostrar KitchenDashboard
    if (user?.role === 'kitchen') {
      return <KitchenDashboard />
    }

    // Si es admin, mostrar la interfaz de administración
    if (user?.role === 'admin') {
      const pageContent = (() => {
        switch (currentPage) {
          case 'admin-dashboard':
            return <AdminDashboard />
          case 'admin-employees':
            return <AdminEmployees />
          case 'admin-expenses':
            return <AdminExpenses />
          case 'admin-debts':
            return <AdminDebts />
          case 'admin-inventory':
            return <AdminInventory />
          case 'admin-settings':
            return <Settings />
          default:
            return <AdminDashboard />
        }
      })()

      return (
        <div 
          key={currentPage}
          className={`page-content ${
            isTransitioning ? 'page-loading' : 'page-enter'
          }`}
        >
          {pageContent}
        </div>
      )
    }

    // Si es frontman/mesero, mostrar la interfaz normal
    const pageContent = (() => {
      switch (currentPage) {
        case 'dashboard':
          return <Dashboard />
        case 'inventory':
          return <UserInventory />
        case 'take-order':
          return <TakeOrder />
        case 'payment-history':
          return <PaymentHistory />
        case 'clients':
          return <Clients />
        case 'settings':
          return <Settings />
        default:
          return <Dashboard />
      }
    })()

    return (
      <div 
        key={currentPage}
        className={`page-content ${
          isTransitioning ? 'page-loading' : 'page-enter'
        }`}
      >
        {pageContent}
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando aplicación...</p>
        </div>
      </div>
    )
  }

  // Login screen
  if (!user) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar Components */}
      {user.role === 'frontman' && (
        <Sidebar 
          onNavigate={handlePageNavigation} 
          currentPage={currentPage} 
        />
      )}
      
      {user.role === 'admin' && (
        <AdminSidebar 
          onNavigate={handlePageNavigation} 
          currentPage={currentPage} 
        />
      )}
      
      {/* Main Content with Transition Container */}
      <div className={`transition-all duration-300 ${(user.role === 'frontman' || user.role === 'admin') ? 'ml-16' : ''}`}>
        <div className="page-transition-container main-content-transition">
          {renderCurrentPage()}
        </div>
      </div>
      
      {/* Optional: Loading overlay during transitions */}
      {isTransitioning && (user.role === 'frontman' || user.role === 'admin') && (
        <div className="fixed inset-0 pointer-events-none z-10">
          <div className="absolute top-4 right-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-600 font-medium">Cargando...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ConfigProvider>
        <OrderProvider>
          <AppContent />
        </OrderProvider>
      </ConfigProvider>
    </AuthProvider>
  )
}

export default App 