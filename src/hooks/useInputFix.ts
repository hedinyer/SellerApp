import { useEffect } from 'react'
import React from 'react'

/**
 * Hook para solucionar problemas de inputs que no responden en Electron
 * Especialmente útil en Windows cuando la app se instala en diferentes PCs
 * 
 * Este hook soluciona problemas comunes:
 * - Inputs que no responden al hacer clic
 * - Inputs que no reciben eventos de teclado
 * - Problemas de focus en Electron
 * 
 * IMPORTANTE: Este hook solo maneja el focus en clicks, NO interfiere con eventos de teclado
 * para evitar conflictos con React y permitir que los inputs funcionen normalmente.
 */
export function useInputFix() {
  // Patch window.alert and window.confirm to restore focus
  useEffect(() => {
    const originalAlert = window.alert
    const originalConfirm = window.confirm

    const restoreFocus = () => {
      // Force window focus
      window.focus()
      // Restore focus to active element if possible
      if (document.activeElement instanceof HTMLElement) {
        const el = document.activeElement
        // Small delay to allow window focus to settle
        setTimeout(() => {
          try {
            el.blur()
            el.focus()
          } catch (e) {
            // Ignore focus errors
          }
        }, 50)
      }
    }

    window.alert = (...args) => {
      originalAlert.apply(window, args)
      restoreFocus()
    }

    window.confirm = (...args) => {
      const result = originalConfirm.apply(window, args)
      restoreFocus()
      return result
    }

    return () => {
      window.alert = originalAlert
      window.confirm = originalConfirm
    }
  }, [])

  useEffect(() => {
    // Función unificada para manejar interacciones (click, touch, mousedown)
    const handleInteraction = (e: Event) => {
      const target = e.target as HTMLElement
      
      // Si el usuario está interactuando, asegurarnos de que la ventana tenga foco
      if (!document.hasFocus()) {
        window.focus()
      }

      // Solo procesar si es un input, textarea o elemento editable
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable)
      ) {
        // Ignorar elementos deshabilitados
        if ((target as HTMLInputElement).disabled) return;

        // Force focus logic
        const forceFocus = () => {
           if (
              target instanceof HTMLElement && 
              target.isConnected // Asegurar que el elemento sigue en el DOM
            ) {
              try {
                // Forzar focus en la ventana primero
                window.focus()
                target.focus({ preventScroll: false })
              } catch (err) {
                console.debug('Focus error:', err)
              }
            }
        }

        // Si no tiene foco, intentamos dárselo
        if (document.activeElement !== target) {
          // Intentar inmediatamente
          forceFocus()
          
          // Y también con delay por si React está renderizando
          setTimeout(forceFocus, 50)
          // Un segundo intento más tarde para casos difíciles
          setTimeout(forceFocus, 150)
        }
      }
    }

    // Monitor visibility change to restore focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        window.focus()
      }
    }

    // Agregar listeners para múltiples tipos de interacción
    document.addEventListener('mousedown', handleInteraction, false)
    document.addEventListener('touchstart', handleInteraction, { passive: true })
    document.addEventListener('click', handleInteraction, false)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleInteraction, false)
      document.removeEventListener('touchstart', handleInteraction)
      document.removeEventListener('click', handleInteraction, false)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [])
}

/**
 * Componente wrapper que aplica el fix de inputs automáticamente
 */
export function InputFixProvider({ children }: { children: React.ReactNode }) {
  useInputFix()
  return React.createElement(React.Fragment, null, children)
}
