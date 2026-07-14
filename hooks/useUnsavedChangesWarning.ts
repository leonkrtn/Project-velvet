'use client'

import { useEffect } from 'react'

/**
 * Warnt vor dem Verlassen/Schließen der Seite, solange `isDirty` true ist.
 * Nutzt die native beforeunload-Warnung des Browsers (Text ist von den
 * meisten Browsern aus Sicherheitsgründen nicht anpassbar).
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
