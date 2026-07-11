'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Compass, BookOpen, ChevronRight } from 'lucide-react'
import { VENDOR_TOUR_START_EVENT, VENDOR_AREAS, type VendorArea } from '@/lib/tour/vendor-tour-steps'

// Auswahl beim Klick auf „Hilfe": kompletter Rundgang, einzelner Bereich oder
// die durchsuchbare Hilfe-Seite. Startet die (ggf. gefilterte) Tour per
// CustomEvent mit { area } im Detail.
export default function VendorHelpMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  function startTour(area?: VendorArea) {
    onClose()
    // Nächster Tick, damit das Menü sicher geschlossen ist, bevor die Tour rendert.
    setTimeout(() => window.dispatchEvent(new CustomEvent(VENDOR_TOUR_START_EVENT, { detail: area ? { area } : {} })), 0)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,22,26,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E6EAF2' }}>
          <strong style={{ fontSize: 15.5, color: '#111827' }}>Hilfe & Erklärungen</strong>
          <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A6068', display: 'flex' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto' }}>
          <p style={{ fontSize: 13, color: '#4B5768', margin: '0 0 14px' }}>
            Möchtest du das ganze Portal kennenlernen oder gezielt einen Bereich erklärt bekommen?
          </p>

          <button onClick={() => startTour()} style={primaryRow}>
            <Compass size={18} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>Kompletter Rundgang</span>
              <span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>Alle Bereiche der Reihe nach</span>
            </span>
            <ChevronRight size={16} style={{ flexShrink: 0 }} />
          </button>

          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8', margin: '18px 0 8px' }}>
            Einzelnen Bereich erklären
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {VENDOR_AREAS.map(a => (
              <button key={a.key} onClick={() => startTour(a.key)} style={areaRow}>
                <span style={{ flex: 1, textAlign: 'left' }}>{a.label}</span>
                <ChevronRight size={15} style={{ flexShrink: 0, opacity: 0.4 }} />
              </button>
            ))}
          </div>

          <button
            onClick={() => { onClose(); router.push('/vendor/hilfe') }}
            style={{ ...areaRow, marginTop: 16, borderTop: '1px solid #E6EAF2', paddingTop: 14 }}
          >
            <BookOpen size={16} style={{ flexShrink: 0, color: '#2352C8' }} />
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, color: '#2352C8' }}>Hilfe-Seite zum Nachlesen öffnen</span>
            <ChevronRight size={15} style={{ flexShrink: 0, opacity: 0.4 }} />
          </button>
        </div>
      </div>
    </div>
  )
}

const primaryRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 14px', borderRadius: 12,
  border: 'none', cursor: 'pointer', background: '#2352C8', color: '#fff', fontFamily: 'inherit',
}
const areaRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid #E6EAF2', cursor: 'pointer', background: '#fff', color: '#111827', fontFamily: 'inherit',
  fontSize: 13.5, fontWeight: 500,
}
