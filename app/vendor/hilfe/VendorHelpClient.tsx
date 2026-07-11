'use client'

import React, { useMemo, useState } from 'react'
import { Search, ChevronDown, Compass, PlayCircle } from 'lucide-react'
import {
  VENDOR_AREAS, VENDOR_TOUR_STEPS, VENDOR_TOUR_START_EVENT, type VendorArea,
} from '@/lib/tour/vendor-tour-steps'

// Durchsuchbare Hilfe-Seite. Inhalte stammen aus denselben Tour-Schritten
// (keine Duplikation) — gruppiert nach Bereich, mit Volltextsuche. Pro Bereich
// lässt sich zusätzlich die geführte Erklärung starten.
export default function VendorHelpClient() {
  const [q, setQ] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const query = q.trim().toLowerCase()

  const grouped = useMemo(() => {
    return VENDOR_AREAS.map(area => {
      const steps = VENDOR_TOUR_STEPS.filter(s => s.area === area.key && (
        !query || s.title.toLowerCase().includes(query) || s.body.toLowerCase().includes(query) || area.label.toLowerCase().includes(query)
      ))
      return { area, steps }
    }).filter(g => g.steps.length > 0)
  }, [query])

  function startArea(area?: VendorArea) {
    window.dispatchEvent(new CustomEvent(VENDOR_TOUR_START_EVENT, { detail: area ? { area } : {} }))
  }

  return (
    <div className="vnd-page-outer" style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>
      <div className="vnd-page-card" style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>Hilfe</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', margin: '6px 0 0' }}>
              Alle Funktionen erklärt. Suche einen Begriff oder starte die geführte Erklärung.
            </p>
          </div>
          <button onClick={() => startArea()} style={btnDark}>
            <Compass size={16} /> Kompletter Rundgang
          </button>
        </div>

        {/* Suche */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Suchen … (z. B. Kalender, PDF, Anzahlung, Import)"
            style={{ width: '100%', height: 44, padding: '0 14px 0 38px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: 'var(--text)' }}
          />
        </div>

        {grouped.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>{`Keine Treffer für „${q}".`}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grouped.map(({ area, steps }) => (
            <section key={area.key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{area.label}</h2>
                <button onClick={() => startArea(area.key)} style={btnGhost}>
                  <PlayCircle size={14} /> Bereich erklären
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.map((s, i) => {
                  const key = `${area.key}-${i}`
                  const open = openKey === key || !!query
                  return (
                    <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
                      <button
                        onClick={() => setOpenKey(open && !query ? null : key)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}
                      >
                        {s.title}
                        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--text-dim)' }} />
                      </button>
                      {open && (
                        <p style={{ margin: 0, padding: '0 16px 14px', fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>{s.body}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

const btnDark: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 18px', borderRadius: 10,
  fontSize: 13.5, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: 'inherit',
}
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 8,
  fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', fontFamily: 'inherit',
}
