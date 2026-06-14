'use client'

import { Check, Loader2, AlertCircle } from 'lucide-react'
import type { SaveStatus as Status } from '@/hooks/useAutoSave'

/**
 * Dezenter Auto-Save-Statusindikator. Einheitlicher Stil für die ganze App
 * (gespiegelt vom bisherigen AutosaveStatus im Profil).
 */
export function SaveStatus({ status }: { status: Status }) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span style={{ fontSize: 12, color: 'var(--text-tertiary, #888)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
        Speichert…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span style={{ fontSize: 12, color: '#2E7D32', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Check size={12} />
        Gespeichert
      </span>
    )
  }
  return (
    <span style={{ fontSize: 12, color: '#C62828', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <AlertCircle size={12} />
      Fehler beim Speichern
    </span>
  )
}

export default SaveStatus
