'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Check, AlertCircle } from 'lucide-react'

type ToastVariant = 'success' | 'error'

interface ToastEntry {
  id: number
  message: string
  variant: ToastVariant
  actionLabel?: string
  onAction?: () => void
}

interface ToastOptions {
  variant?: ToastVariant
  actionLabel?: string
  onAction?: () => void
}

type ShowToast = (message: string, options?: ToastVariant | ToastOptions) => void

// Default ist ein No-op, damit Komponenten den Hook auch außerhalb des
// Providers (z.B. im Veranstalter-Portal) gefahrlos aufrufen können.
const ToastContext = createContext<ShowToast>(() => {})

export function useBpToast(): ShowToast {
  return useContext(ToastContext)
}

const AUTO_DISMISS_MS = 3200
const AUTO_DISMISS_WITH_ACTION_MS = 6000

export function BpToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const idRef = useRef(0)

  const show = useCallback<ShowToast>((message, options) => {
    const opts: ToastOptions = typeof options === 'string' ? { variant: options } : (options ?? {})
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, variant: opts.variant ?? 'success', actionLabel: opts.actionLabel, onAction: opts.onAction }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, opts.onAction ? AUTO_DISMISS_WITH_ACTION_MS : AUTO_DISMISS_MS)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
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
              {t.onAction && (
                <button
                  type="button"
                  className="bp-toast-action"
                  onClick={() => { t.onAction?.(); dismiss(t.id) }}
                >
                  {t.actionLabel ?? 'Rückgängig'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
