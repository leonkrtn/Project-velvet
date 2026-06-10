'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Check, AlertCircle } from 'lucide-react'

type ToastVariant = 'success' | 'error'

interface ToastEntry {
  id: number
  message: string
  variant: ToastVariant
}

type ShowToast = (message: string, variant?: ToastVariant) => void

// Default ist ein No-op, damit Komponenten den Hook auch außerhalb des
// Providers (z.B. im Veranstalter-Portal) gefahrlos aufrufen können.
const ToastContext = createContext<ShowToast>(() => {})

export function useBpToast(): ShowToast {
  return useContext(ToastContext)
}

export function BpToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const idRef = useRef(0)

  const show = useCallback<ShowToast>((message, variant = 'success') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toasts.length > 0 && (
        <div className="bp-toast-container" role="status" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`bp-toast${t.variant === 'error' ? ' bp-toast-error' : ''}`}>
              {t.variant === 'error' ? <AlertCircle size={15} /> : <Check size={15} />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
