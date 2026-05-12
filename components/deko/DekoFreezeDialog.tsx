'use client'
import React, { useState } from 'react'
import { Lock, AlertTriangle } from 'lucide-react'

interface Props {
  onConfirm: () => Promise<void>
  onClose: () => void
  isFreezing: boolean
}

export default function DekoFreezeDialog({ onConfirm, onClose, isFreezing }: Props) {
  const [step, setStep] = useState<'warn' | 'confirm'>('warn')
  const [typed, setTyped] = useState('')
  const CONFIRMATION = 'ABSENDEN'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, padding: '28px 28px', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
        onClick={e => e.stopPropagation()}>

        {step === 'warn' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FFF3CD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} color="#856404" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Konzept einreichen</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Das kann nicht leicht rückgängig gemacht werden.</p>
              </div>
            </div>

            <div style={{ background: '#FFF8F0', border: '1px solid #F4C36A', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#7a5200' }}>
                <strong>Was bedeutet das?</strong><br />
                • Alle Bereiche werden eingefroren — kein Bearbeiten mehr möglich<br />
                • Der aktuelle Stand wird als finales Dekorationskonzept übermittelt<br />
                • Budget-Einträge werden automatisch erstellt<br />
                • Nur der Veranstalter kann den Freeze wieder aufheben
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose}
                style={{ flex: 1, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                Abbrechen
              </button>
              <button onClick={() => setStep('confirm')}
                style={{ flex: 1, padding: '10px 0', background: '#C9B99A', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
                Weiter →
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#D4EDDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Lock size={22} color="#155724" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Sicher einreichen?</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tippe <strong>{CONFIRMATION}</strong> um zu bestätigen.</p>
              </div>
            </div>

            <input
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value.toUpperCase())}
              placeholder={CONFIRMATION}
              style={{ width: '100%', padding: '10px 12px', border: `2px solid ${typed === CONFIRMATION ? '#28a745' : 'var(--border)'}`, borderRadius: 8, fontSize: 15, fontWeight: 600, letterSpacing: 2, textAlign: 'center', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16, transition: 'border-color .15s' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('warn')}
                style={{ flex: 1, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                ← Zurück
              </button>
              <button
                disabled={typed !== CONFIRMATION || isFreezing}
                onClick={onConfirm}
                style={{ flex: 1, padding: '10px 0', background: typed === CONFIRMATION ? '#28a745' : '#ccc', border: 'none', borderRadius: 8, color: '#fff', cursor: typed === CONFIRMATION ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', transition: 'background .15s' }}>
                {isFreezing ? 'Wird eingereicht…' : '🔒 Jetzt einreichen'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
