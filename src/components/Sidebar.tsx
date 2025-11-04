import { useState, useEffect } from 'react'
import './animations.css'
import { useConfig } from '../contexts/ConfigContext'
import { useAuth } from '../contexts/AuthContext'
import {
  MenuIcon,
  XIcon,
  ClipboardIcon,
  TableIcon,
  MoreHorizontalIcon,
  UserIcon,
  UsersIcon,
  HomeIcon,
  LogOutIcon,
  HistoryIcon,
  ShoppingCartIcon,
  FileTextIcon
} from './icons'

interface SidebarProps {
  className?: string
  onNavigate?: (page: string) => void
  currentPage?: string
}

interface MenuItem {
  id: string
  title: string
  icon: React.ReactNode
  badge?: number
  onClick?: () => void
}

export function Sidebar({ className = '', onNavigate, currentPage = 'dashboard' }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeItem, setActiveItem] = useState(currentPage)
  const { t } = useConfig()
  const { logout, user } = useAuth()

  // Update active item when currentPage changes
  useEffect(() => {
    setActiveItem(currentPage)
  }, [currentPage])

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: <HomeIcon size={20} />,
      onClick: () => {
        setActiveItem('dashboard')
        onNavigate?.('dashboard')
      }
    },
    {
      id: 'inventory',
      title: 'Inventario',
      icon: <TableIcon size={20} />,
      onClick: () => {
        setActiveItem('inventory')
        onNavigate?.('inventory')
      }
    },
    {
      id: 'clothing-pos',
      title: 'Venta',
      icon: <ShoppingCartIcon size={20} />,
      onClick: () => {
        setActiveItem('clothing-pos')
        onNavigate?.('clothing-pos')
      }
    },
    {
      id: 'payment-history',
      title: 'Historial venta',
      icon: <HistoryIcon size={20} />,
      onClick: () => {
        setActiveItem('payment-history')
        onNavigate?.('payment-history')
      }
    },
    {
      id: 'quotes',
      title: 'Cotizaciones',
      icon: <FileTextIcon size={20} />,
      onClick: () => {
        setActiveItem('quotes')
        onNavigate?.('quotes')
      }
    },
    {
      id: 'clients',
      title: 'Clientes',
      icon: <UsersIcon size={20} />,
      onClick: () => {
        setActiveItem('clients')
        onNavigate?.('clients')
      }
    }
  ]

  const bottomItems: MenuItem[] = []

  function handleMenuItemClick(item: MenuItem) {
    item.onClick?.()
    console.log(`Navegando a: ${item.title}`)
  }

  function handleMouseEnter() {
    setIsExpanded(true)
  }

  function handleMouseLeave() {
    setIsExpanded(false)
  }

  const renderDivider = () => (
    <div className="flex justify-center py-2">
      <div className={`${isExpanded ? 'w-full' : 'w-1/2'}`}>
        <div className="h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
      </div>
    </div>
  )

  const renderMenuItem = (item: MenuItem) => (
    <div key={item.id} className="relative group">
      <button
        onClick={() => handleMenuItemClick(item)}
        className={`w-full h-12 flex items-center rounded relative overflow-visible ${
          activeItem === item.id
            ? 'bg-black text-white'
            : 'text-gray-700 hover:bg-gray-50'
        } ${isExpanded ? 'justify-start px-3' : 'justify-center'}`}
      >
        {/* Active indicator */}
        {activeItem === item.id && (
          <div className="absolute left-0 top-0 w-0.5 h-full bg-white"></div>
        )}
        
        {/* Icon container */}
        <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${
          activeItem === item.id 
            ? 'text-white' 
            : 'group-hover:text-black'
        }`}>
          {item.icon}
        </div>

        {/* Badge for collapsed state */}
        {!isExpanded && item.badge && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center leading-none shadow-sm border border-white z-10">
            {item.badge}
          </div>
        )}

        {/* Expanded content */}
        {isExpanded && (
          <div className="ml-3 flex-1 min-w-0 flex items-center justify-between">
            <div className="text-left">
              <p className={`font-medium text-sm truncate ${
                activeItem === item.id ? 'text-white' : 'text-black'
              }`}>
                {item.title}
              </p>
            </div>
            {/* Badge for expanded state */}
            {item.badge && (
              <div className="bg-red-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center leading-none shadow-sm">
                {item.badge}
              </div>
            )}
          </div>
        )}
      </button>

      {/* Tooltip for collapsed state */}
      {!isExpanded && (
        <div className="absolute left-14 top-1/2 transform -translate-y-1/2 bg-black text-white px-3 py-2 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30 shadow-lg">
          <div className="font-medium">{item.title}</div>
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 border-4 border-transparent border-r-black"></div>
        </div>
      )}
    </div>
  )

  return (
    <div 
      className={`fixed top-0 left-0 h-full bg-white shadow-lg z-50 border-r border-gray-100 ${
        isExpanded ? 'w-60' : 'w-16'
      } ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        boxShadow: isExpanded 
          ? '0 20px 40px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.04)'
          : '0 8px 32px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.02)'
      }}
    >
      <div className="h-full flex flex-col">
        {/* Header Section */}
        <div className="p-5 border-b border-gray-50">
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 py-8 px-2 space-y-1 flex flex-col justify-center">
          {renderMenuItem(menuItems[0])}
          {renderDivider()}
          {renderMenuItem(menuItems[1])}
          {renderDivider()}
          {renderMenuItem(menuItems[2])}
          {renderDivider()}
          {renderMenuItem(menuItems[3])}
          {renderDivider()}
          {renderMenuItem(menuItems[4])}
          {renderDivider()}
          {renderMenuItem(menuItems[5])}
        </nav>

        {/* Bottom Section */}
        <div className="p-2 space-y-1">
          {/* Logout */}
          <div className="space-y-1 pt-2 border-t border-gray-50">
            <div className="relative group">
              <button 
                onClick={logout}
                className={`w-full h-12 flex items-center rounded text-gray-600 hover:bg-gray-50 hover:text-red-600 ${
                  isExpanded ? 'justify-start px-3' : 'justify-center'
                }`}
              >
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <LogOutIcon size={20} />
                </div>
                {isExpanded && (
                  <span className="ml-3 font-medium text-sm truncate">
                    Cerrar Sesión
                  </span>
                )}
              </button>
              {!isExpanded && (
                <div className="absolute left-14 top-1/2 transform -translate-y-1/2 bg-black text-white px-3 py-2 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30 shadow-lg">
                  Cerrar Sesión
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 border-4 border-transparent border-r-black"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer indicator */}
        <div className="p-3 flex justify-center">
          <div className={`h-0.5 bg-gray-200 rounded-full ${
            isExpanded ? 'w-6' : 'w-4'
          } hover:bg-gray-300`}></div>
        </div>
      </div>
    </div>
  )
}