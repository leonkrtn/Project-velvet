'use client'
import React from 'react'

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
      background: on ? 'var(--gold)' : 'var(--border)', position: 'relative', flexShrink: 0,
    }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.2s' }} />
    </button>
  )
}

interface Props {
  sectionKey: string
  label: string
  enabled: boolean
  onToggle: (k: string) => void
  readOnly?: boolean
  children: React.ReactNode
}

export function Section({ sectionKey, label, enabled, onToggle, readOnly, children }: Props) {
  // In readOnly, disabled sections don't exist in this proposal — hide entirely
  if (readOnly && !enabled) return null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px',
      opacity: enabled ? 1 : 0.45,
    }}>
      {!readOnly ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
            {label}
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text-dim)' }}>
            <Toggle on={enabled} onChange={() => onToggle(sectionKey)} />
            {enabled ? 'Eingeschlossen' : 'Ausgeschlossen'}
          </label>
        </div>
      ) : (
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 12 }}>
          {label}
        </div>
      )}
      {/* Content — always visible (grayed when disabled), non-interactive when disabled or readOnly */}
      <div style={{ pointerEvents: (!enabled || readOnly) ? 'none' : 'auto' }}>
        {children}
      </div>
    </div>
  )
}
