'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import type { SaveStatus as Status } from '@/hooks/useAutoSave'

/**
 * Einheitlicher Auto-Save-Toast für die ganze App.
 *
 * Rendert eine kleine, unten mittig fixierte Pill (im Stil der schwebenden
 * „Ungespeicherte Änderungen"-Leiste im Anbieter-Profil): blendet kurz mit
 * Animation ein („Speichert…" → „Gespeichert" mit Häkchen) und verschwindet
 * von selbst wieder. Bei 'idle' wird nichts angezeigt; die Position im
 * JSX-Baum ist egal, da die Pill fixed positioniert ist.
 */
export function SaveStatus({ status }: { status: Status }) {
  const [visible, setVisible] = useState(status !== 'idle')
  const [leaving, setLeaving] = useState(false)
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  // Letzten sichtbaren Status merken, damit die Ausblend-Animation
  // noch den richtigen Inhalt zeigt, wenn der Status schon 'idle' ist.
  const lastRef = useRef<Exclude<Status, 'idle'>>('saved')
  if (status !== 'idle') lastRef.current = status

  useEffect(() => {
    if (status !== 'idle') {
      setVisible(true)
      setLeaving(false)
      return
    }
    if (!visibleRef.current) return
    setLeaving(true)
    const t = setTimeout(() => { setVisible(false); setLeaving(false) }, 220)
    return () => clearTimeout(t)
  }, [status])

  if (!visible) return null

  const shown = status === 'idle' ? lastRef.current : status
  const isError = shown === 'error'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        zIndex: 90,
        pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px', borderRadius: 999, whiteSpace: 'nowrap',
        background: isError ? '#B91C1C' : '#1D1D1F', color: '#fff',
        fontSize: 13, fontWeight: 600,
        boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
        animation: leaving
          ? 'fvr-savetoast-out 220ms ease-in forwards'
          : 'fvr-savetoast-in 200ms cubic-bezier(0.32, 0.72, 0.35, 1.15) both',
      }}
    >
      {shown === 'saving' && (
        <>
          <Loader2 size={14} style={{ animation: 'fvr-savetoast-spin 1s linear infinite', color: 'rgba(255,255,255,0.75)' }} />
          Speichert…
        </>
      )}
      {shown === 'saved' && (
        <>
          <Check size={15} strokeWidth={3} style={{ color: '#4ADE80', animation: 'fvr-savetoast-pop 280ms cubic-bezier(0.32, 0.72, 0.35, 1.4) both' }} />
          Gespeichert
        </>
      )}
      {isError && (
        <>
          <AlertCircle size={15} />
          Fehler beim Speichern
        </>
      )}
      <style>{`
        @keyframes fvr-savetoast-in {
          from { opacity: 0; transform: translate(-50%, 10px) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes fvr-savetoast-out {
          from { opacity: 1; transform: translate(-50%, 0) scale(1); }
          to   { opacity: 0; transform: translate(-50%, 10px) scale(0.95); }
        }
        @keyframes fvr-savetoast-pop {
          from { transform: scale(0); }
          60%  { transform: scale(1.25); }
          to   { transform: scale(1); }
        }
        @keyframes fvr-savetoast-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default SaveStatus
