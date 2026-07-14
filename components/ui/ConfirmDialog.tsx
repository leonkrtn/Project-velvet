'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

// Default: verhält sich wie window.confirm (blockierend, immer "ok"), falls
// eine Komponente außerhalb des Providers gerendert wird.
const ConfirmContext = createContext<ConfirmFn>(async (options) => {
  const message = typeof options === 'string' ? options : `${options.title}${options.message ? `\n${options.message}` : ''}`
  return typeof window !== 'undefined' ? window.confirm(message) : true
})

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const resolverRef = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts: ConfirmOptions = typeof options === 'string' ? { title: options } : options
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setPending({ ...opts, resolve })
    })
  }, [])

  const close = useCallback((ok: boolean) => {
    resolverRef.current?.(ok)
    resolverRef.current = null
    setPending(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={() => close(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-dialog-head">
              {pending.danger && (
                <span className="confirm-dialog-icon" aria-hidden="true">
                  <AlertTriangle size={18} />
                </span>
              )}
              <h3 id="confirm-dialog-title">{pending.title}</h3>
            </div>
            {pending.message && <p className="confirm-dialog-message">{pending.message}</p>}
            <div className="confirm-dialog-actions">
              <button type="button" className="confirm-dialog-btn-ghost" onClick={() => close(false)}>
                {pending.cancelLabel ?? 'Abbrechen'}
              </button>
              <button
                type="button"
                className={pending.danger ? 'confirm-dialog-btn-danger' : 'confirm-dialog-btn-primary'}
                onClick={() => close(true)}
                autoFocus
              >
                {pending.confirmLabel ?? 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
