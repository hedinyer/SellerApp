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
  useEffect(() => {
    // Track si ya estamos procesando un focus para evitar loops
    let isFocusing = false

    // Función unificada para manejar interacciones (click, touch, mousedown)
    const handleInteraction = (e: Event) => {
      const target = e.target as HTMLElement
      
      // Solo procesar si es un input, textarea o elemento editable
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable)
      ) {
        // Ignorar elementos deshabilitados
        if ((target as HTMLInputElement).disabled) return;

        // Solo forzar focus si el elemento no está ya enfocado
        // Esto evita interferir con el comportamiento normal de React
        if (document.activeElement !== target && !isFocusing) {
          isFocusing = true
          // Usar un delay seguro para permitir que React maneje el evento primero
          // 50ms es suficiente para evitar conflictos pero imperceptible para el usuario
          setTimeout(() => {
            if (
              target instanceof HTMLElement && 
              target.isConnected && // Asegurar que el elemento sigue en el DOM
              document.activeElement !== target
            ) {
              // Solo forzar focus si React no lo hizo automáticamente
              try {
                target.focus({ preventScroll: false })
                // Opcional: Asegurar que el cursor esté al final si es un input de texto
                // if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'password')) {
                //   const len = target.value.length;
                //   target.setSelectionRange(len, len);
                // }
              } catch (err) {
                // Ignorar errores de focus (puede pasar si el elemento fue removido)
                console.debug('Focus error:', err)
              }
            }
            isFocusing = false
          }, 50)
        }
      }
    }

    // Agregar listeners para múltiples tipos de interacción
    // Usar bubbling phase (false) para no interferir con portales/modales de React
    document.addEventListener('mousedown', handleInteraction, false)
    document.addEventListener('touchstart', handleInteraction, { passive: true })
    document.addEventListener('click', handleInteraction, false)

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleInteraction, false)
      document.removeEventListener('touchstart', handleInteraction)
      document.removeEventListener('click', handleInteraction, false)
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
