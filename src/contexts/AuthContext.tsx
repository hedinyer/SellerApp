import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type UserRole = 'frontman' | 'kitchen' | 'admin'

interface User {
  id: string
  username: string
  role: UserRole
  name: string
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock users - en producción esto vendría de una API
const mockUsers: (User & { password: string })[] = [
  {
    id: '1',
    username: 'vendedor',
    password: '123',
    role: 'frontman',
    name: 'Carlos Vendedor'
  },
  {
    id: '2',
    username: 'cocina',
    password: '123',
    role: 'kitchen',
    name: 'Ana Cocinera'
  },
  {
    id: '3',
    username: 'frontman',
    password: '123',
    role: 'frontman',
    name: 'María Frontman'
  },
  {
    id: '4',
    username: 'chef',
    password: '123',
    role: 'kitchen',
    name: 'José Chef'
  },
  {
    id: '5',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Administrador Principal'
  }
]

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for saved session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('restaurant-user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem('restaurant-user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const foundUser = mockUsers.find(
      u => u.username === username && u.password === password
    )
    
    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser
      setUser(userWithoutPassword)
      localStorage.setItem('restaurant-user', JSON.stringify(userWithoutPassword))
      setIsLoading(false)
      return true
    }
    
    setIsLoading(false)
    return false
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