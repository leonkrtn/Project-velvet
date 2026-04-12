'use client'
import React from 'react'
import { useEvent } from '@/lib/event-context'
import { DEFAULT_FEATURE_TOGGLES } from '@/lib/store'
import type { FeatureKey } from '@/lib/store'

export function useFeatureEnabled(key: FeatureKey): boolean {
  const { event } = useEvent()
  if (!event) return true // not loaded yet — don't block
  return event.organizer?.featureToggles?.[key] ?? DEFAULT_FEATURE_TOGGLES[key]
}

export function FeatureDisabledScreen() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--bg)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, fontSize: 22,
      }}>
        🔒
      </div>
      <h2 style={{
        fontFamily: 'var(--heading-font)', fontSize: 22, fontWeight: 500,
        color: 'var(--text)', margin: '0 0 10px',
      }}>
        Funktion deaktiviert
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
        Diese Funktion wurde vom Veranstalter deaktiviert. Bei Fragen wende dich an deinen Hochzeitsplaner.
      </p>
    </div>
  )
}
