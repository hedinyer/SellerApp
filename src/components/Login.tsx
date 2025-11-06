// Add this at the top of the file to ensure TypeScript recognizes import.meta.env
/// <reference types="vite/client" />
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useConfig } from '../contexts/ConfigContext'
import {
  UserIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  LogInIcon,
  AlertTriangleIcon,
  SettingsIcon
} from './icons'
import Galaxy from './Galaxy'
import './animations.css'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin'>('user')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  
  // Ensure username/password are set for default role on mount
  useEffect(() => {
    if (selectedRole === 'user') {
      setUsername('vendedor')
      setPassword('123')
    } else if (selectedRole === 'admin') {
      setUsername('admin')
      setPassword('Dwell.admin.2025*')
    }
    // eslint-disable-next-line
  }, [])
  
  const { login } = useAuth()
  const { t, getFontSizeClass } = useConfig()

  // Memoize font size class
  const fontSizeClass = useMemo(() => getFontSizeClass(), [getFontSizeClass])

  // Memoize handleSubmit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('Por favor completa todos los campos')
      return
    }
    setIsLoggingIn(true)
    try {
      const result = await login(username, password)
      if (!result.success) {
        if (result.error === 'wrong_password') {
          setError('Contrasena incorrecta, intentalo de nuevo')
        } else {
          setError('Usuario o contraseña incorrectos')
        }
      }
    } finally {
      setIsLoggingIn(false)
    }
  }, [username, password, login])

  // Memoize handleRoleQuickSelect
  const handleRoleQuickSelect = useCallback((role: 'user' | 'admin') => {
    setSelectedRole(role)
    if (role === 'user') {
      setUsername('vendedor')
      setPassword('123')
    } else if (role === 'admin') {
      setUsername('admin')
      setPassword('Dwell.admin.2025*')
    }
  }, [])

  return (
    <div 
      className={`min-h-screen w-full flex flex-col ${fontSizeClass}`}
      style={{ fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif' }}
    >
      {/* Header with Logo */}
      <div className="w-full bg-white border-b border-gray-200 p-4">
        <div className="w-full flex items-center justify-center">
          <img 
            src={`${import.meta.env.BASE_URL}applogo.png`} 
            alt="Orderly Logo" 
            style={{
              width: 80,
              height: 80,
              objectFit: 'contain'
            }}
          />
        </div>
      </div>

      {/* Login Form */}
      <div className="w-full flex items-center justify-center bg-white p-4 flex-1">
        <div
          className="w-full max-w-md bg-white border border-gray-200"
          style={{
            borderRadius: 9,
            padding: '24px 20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
        {/* Header */}
          <div className="text-center" style={{marginBottom: 0}}>
            <h1 className="text-2xl font-bold text-gray-900" style={{fontWeight: 700, marginBottom: 4}}>Acceso al Sistema</h1>
          </div>

          {/* Quick Role Selection as Underline Tabs */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3 text-center">Acceso rápido por puesto:</p>
            <div
              role="tablist"
              aria-label="Acceso rápido por puesto"
              style={{
                display: 'flex',
                background: 'none',
                borderRadius: 0,
                border: 'none',
                padding: 0,
                gap: 0,
                justifyContent: 'flex-end',
                marginBottom: 8,
                minHeight: 44,
                alignItems: 'flex-end',
                position: 'relative',
              }}
            >
              {/* Usuario */}
              <button
                type="button"
                role="tab"
                aria-selected={selectedRole === 'user'}
                tabIndex={0}
                onClick={() => handleRoleQuickSelect('user')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '0 0 6px 0',
                  background: 'none',
                  border: 'none',
                  color: selectedRole === 'user' ? '#111' : '#888',
                  fontWeight: selectedRole === 'user' ? 500 : 300,
                  fontSize: 15,
                  borderBottom: selectedRole === 'user' ? '3px solid #111' : '3px solid transparent',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, border-bottom 0.3s cubic-bezier(.4,1.2,.4,1)',
                  minWidth: 0,
                  zIndex: 2,
                  backgroundClip: 'padding-box',
                }}
              >
                <span>Usuario</span>
              </button>
              {/* Administrador */}
              <button
                type="button"
                role="tab"
                aria-selected={selectedRole === 'admin'}
                tabIndex={0}
                onClick={() => handleRoleQuickSelect('admin')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '0 0 6px 0',
                  background: 'none',
                  border: 'none',
                  color: selectedRole === 'admin' ? '#111' : '#888',
                  fontWeight: selectedRole === 'admin' ? 500 : 300,
                  fontSize: 15,
                  borderBottom: selectedRole === 'admin' ? '3px solid #111' : '3px solid transparent',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, border-bottom 0.3s cubic-bezier(.4,1.2,.4,1)',
                  minWidth: 0,
                  zIndex: 2,
                  backgroundClip: 'padding-box',
                }}
              >
                <span>Admin</span>
              </button>
            </div>
          </div>

        {/* Login Form */}
          <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            {/* Username Field */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
              <label htmlFor="username" className="text-sm font-medium text-gray-700" style={{marginBottom: 2}}>Usuario</label>
              <div style={{position: 'relative'}}>
                <div style={{position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none'}}>
                  <UserIcon size={20} className="text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="text-gray-900"
                  style={{
                    width: '100%',
                    padding: '10px 10px 10px 38px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 9,
                    background: '#fff',
                    outline: 'none',
                    fontSize: 15,
                    fontWeight: 400,
                    boxShadow: 'none',
                    transition: 'border 0.2s',
                  }}
                  placeholder=""
                  disabled={isLoggingIn}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
              <label htmlFor="password" className="text-sm font-medium text-gray-700" style={{marginBottom: 2}}>Contraseña</label>
              <div style={{position: 'relative'}}>
                <div style={{position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none'}}>
                  <LockIcon size={20} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-gray-900"
                  style={{
                    width: '100%',
                    padding: '10px 38px 10px 38px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 9,
                    background: '#fff',
                    outline: 'none',
                    fontSize: 15,
                    fontWeight: 400,
                    boxShadow: 'none',
                    transition: 'border 0.2s',
                  }}
                  placeholder=""
                  disabled={isLoggingIn}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#9ca3af'}}
                  disabled={isLoggingIn}
                >
                  {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', color: '#b91c1c', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8}}>
                <AlertTriangleIcon size={18} className="text-red-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                width: '100%',
                background: '#111',
                color: '#fff',
                border: '1.5px solid #111',
                borderRadius: 9,
                padding: '10px 0',
                fontWeight: 700,
                fontSize: 16,
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                opacity: isLoggingIn ? 0.6 : 1,
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {isLoggingIn ? (
                <>
                  <div style={{width: 20, height: 20, border: '2px solid #fff', borderTop: '2px solid #111', borderRadius: '50%', animation: 'spin 1s linear infinite'}} />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <LogInIcon size={20} className="text-white" />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
} 