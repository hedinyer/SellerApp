import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'

export type UserRole = 'frontman' | 'kitchen' | 'admin'

interface User {
  id: string
  username: string
  role: UserRole
  name: string
}

interface LoginResult {
  success: boolean
  error?: 'user_not_found' | 'wrong_password'
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Database user record type
interface DbUser {
  id: string
  user: string
  password: string
  role?: string
  rol?: string
  name?: string
  nombre?: string
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize - always show Login first
  useEffect(() => {
    // No automatic session restoration - always show Login first
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<LoginResult> => {
    // Don't use isLoading here - let Login component handle its own loading state
    // This prevents App.tsx from showing loading screen and hiding Login component
    
    // Admin short-circuit: predefined credentials, no Supabase lookup
    const isAdminUser = username?.toString().trim().toLowerCase() === 'admin'
    if (isAdminUser && password === 'Dwell.admin.2025*') {
      const user: User = {
        id: 'admin',
        username: 'admin',
        role: 'admin',
        name: 'Administrador'
      }
      setUser(user)
      localStorage.setItem('restaurant-user', JSON.stringify(user))
      return { success: true }
    }

    try {
      // First, check if user exists
      const { data: userData, error: userError } = await supabase
        .from('Usuarios')
        .select('*')
        .eq('user', username)
        .single()
      
      // If user doesn't exist
      if (userError || !userData) {
        return { success: false, error: 'user_not_found' }
      }
      
      const dbUser = userData as unknown as DbUser
      
      // Check if password is correct
      if (dbUser.password !== password) {
        return { success: false, error: 'wrong_password' }
      }
      
      // Map database fields to User interface
      // Handle role mapping - check both 'role' and 'rol' fields, and map to UserRole
      let userRole: UserRole = 'frontman' // default
      const rawRoleValue = (dbUser.role || dbUser.rol || '')
      const normalizedRole = rawRoleValue
        .toString()
        .trim()
        .toLowerCase()
        // remove diacritics to match values like "administrador" with/without accents
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      if (
        normalizedRole === 'admin' ||
        normalizedRole === 'administrador' ||
        normalizedRole.includes('admin')
      ) {
        userRole = 'admin'
      } else if (
        normalizedRole === 'kitchen' ||
        normalizedRole === 'cocina' ||
        normalizedRole.includes('cocina')
      ) {
        userRole = 'kitchen'
      } else if (
        normalizedRole === 'frontman' ||
        normalizedRole === 'vendedor' ||
        normalizedRole === 'mesero' ||
        normalizedRole.includes('front')
      ) {
        userRole = 'frontman'
      } else if (dbUser.user && dbUser.user.toLowerCase().trim() === 'admin') {
        // Fallback: if username is 'admin', treat as admin
        userRole = 'admin'
      }
      
      // Map name - check both 'name' and 'nombre' fields
      const userName = dbUser.name || dbUser.nombre || dbUser.user || username
      
      const user: User = {
        id: dbUser.id,
        username: dbUser.user,
        role: userRole,
        name: userName
      }
      
      setUser(user)
      localStorage.setItem('restaurant-user', JSON.stringify(user))
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'user_not_found' }
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('restaurant-user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 