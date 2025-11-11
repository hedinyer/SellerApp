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
 */
export function useInputFix() {
  useEffect(() => {
    // Función para forzar el focus en inputs cuando se hace clic
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Si el click es en un input, textarea o elemento editable
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable)
      ) {
        // No usar stopPropagation para no interferir con otros handlers
        // Solo asegurar el focus después del click normal
        
        // Forzar focus después de un pequeño delay para asegurar que funcione
        // Usar requestAnimationFrame para mejor sincronización
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (target instanceof HTMLElement) {
              // Asegurar que el elemento esté realmente enfocado
              target.focus({ preventScroll: false })
              
              // Asegurar que el input esté seleccionado y listo para escribir
              if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                // Si el input tiene un valor y no es password, seleccionar todo
                if (target.value && target.type !== 'password' && target.type !== 'email') {
                  // Solo seleccionar si el usuario hace doble clic o si el input está vacío
                  if (e.detail === 1) {
                    // Click simple: solo focus
                    target.focus()
                  } else if (e.detail === 2) {
                    // Doble click: seleccionar todo
                    target.select()
                  }
                } else {
                  // Si no tiene valor o es password, solo asegurar el focus
                  target.focus()
                  // Mover el cursor al final si hay texto
                  if (target.value) {
                    target.setSelectionRange(target.value.length, target.value.length)
                  }
                }
              } else if (target.isContentEditable) {
                // Para elementos contenteditable, asegurar el focus
                target.focus()
              }
            }
          }, 0)
        })
      }
    }

    // Función para manejar eventos de teclado y asegurar que se propaguen
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      
      // Si el evento es en un input o textarea, asegurar que no se bloquee
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable)
      ) {
        // No prevenir el comportamiento por defecto para inputs normales
        // Solo para teclas especiales que no deberían afectar la escritura
        if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') {
          return // Permitir comportamiento normal
        }
        
        // Asegurar que el elemento tenga focus antes de escribir
        if (document.activeElement !== target) {
          // Si el usuario está escribiendo pero el elemento no tiene focus,
          // forzar el focus inmediatamente
          requestAnimationFrame(() => {
            if (target instanceof HTMLElement) {
              target.focus()
            }
          })
        }
        
        // Asegurar que el evento se propague correctamente
        // No prevenir el comportamiento por defecto para caracteres normales
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
          // Permitir que el evento continúe normalmente
          return
        }
      }
    }
    
    // Función adicional para manejar eventos de teclado antes de que se procesen
    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      
      // Asegurar que los eventos de teclado lleguen a los inputs
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable)
      ) {
        // Verificar que el elemento tenga focus
        if (document.activeElement !== target) {
          target.focus()
        }
      }
    }

    // Función para manejar el focus cuando se hace focus en un input
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable)
      ) {
        // Asegurar que el input esté realmente enfocado
        if (document.activeElement !== target) {
          setTimeout(() => {
            target.focus()
          }, 0)
        }
      }
    }

    // Función para manejar mousedown (antes del click) para mejor respuesta
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      if (
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable)
      ) {
        // Preparar el elemento para recibir focus inmediatamente
        requestAnimationFrame(() => {
          if (target instanceof HTMLElement) {
            target.focus()
          }
        })
      }
    }

    // Agregar event listeners con capture para interceptar eventos temprano
    // Usar capture phase para asegurar que se ejecuten antes que otros handlers
    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keypress', handleKeyPress, true)
    document.addEventListener('focus', handleFocus, true)
    document.addEventListener('focusin', handleFocus, true)
    
    // También escuchar eventos en la ventana para capturar todos los eventos
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keypress', handleKeyPress, true)

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keypress', handleKeyPress, true)
      document.removeEventListener('focus', handleFocus, true)
      document.removeEventListener('focusin', handleFocus, true)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keypress', handleKeyPress, true)
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

