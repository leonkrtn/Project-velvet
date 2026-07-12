'use client'

import React, { useMemo, useState } from 'react'
import { Search, ChevronDown, Compass, PlayCircle } from 'lucide-react'
import {
  BRAUTPAAR_AREAS, SOLO_TOUR_STEPS, type BrautpaarArea,
} from '@/lib/tour/solo-tour-steps'
import { TOUR_START_EVENT } from '@/components/tour/ProductTour'

// Durchsuchbare Hilfe-/FAQ-Seite fürs Brautpaar-Portal. Inhalte stammen aus
// denselben Tour-Schritten (keine Duplikation) — gruppiert nach Bereich, mit
// Volltextsuche. Pro Bereich lässt sich zusätzlich die geführte Erklärung
// starten (dieselbe Tour, auf den Bereich gefiltert).
export default function BrautpaarHelpClient() {
  const [q, setQ] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const query = q.trim().toLowerCase()

  const grouped = useMemo(() => {
    return BRAUTPAAR_AREAS.map(area => {
      const steps = SOLO_TOUR_STEPS.filter(s => s.area === area.key && (
        !query ||
        s.title.toLowerCase().includes(query) ||
        s.body.toLowerCase().includes(query) ||
        area.label.toLowerCase().includes(query)
      ))
      return { area, steps }
    }).filter(g => g.steps.length > 0)
  }, [query])

  function startArea(area?: BrautpaarArea) {
    window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: area ? { area } : {} }))
  }

  return (
    <div className="bp-page">
      <div
        className="bp-page-header"
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}
      >
        <div>
          <h1 className="bp-page-title">Hilfe &amp; FAQ</h1>
          <p className="bp-page-subtitle">Alle Funktionen erklärt. Sucht einen Begriff oder startet die geführte Erklärung.</p>
        </div>
        <button type="button" className="bp-btn bp-btn-primary" onClick={() => startArea()}>
          <Compass size={16} /> Kompletter Rundgang
        </button>
      </div>

      {/* Suche */}
      <div style={{ position: 'relative', maxWidth: 460, marginBottom: '1.5rem' }}>
        <Search
          size={16}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--bp-ink-3)', pointerEvents: 'none' }}
        />
        <input
          className="bp-input"
          style={{ paddingLeft: 36 }}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Suchen … (z. B. Gäste, Budget, Sitzplan, Playlist)"
          aria-label="Hilfe durchsuchen"
        />
      </div>

      {grouped.length === 0 && (
        <p style={{ color: 'var(--bp-ink-3)', fontSize: '0.9375rem' }}>
          Keine Treffer für &quot;{q}&quot;.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {grouped.map(({ area, steps }) => (
          <section key={area.key}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <h2 className="bp-section-title" style={{ margin: 0 }}>{area.label}</h2>
              <button type="button" className="bp-btn bp-btn-ghost" onClick={() => startArea(area.key)}>
                <PlayCircle size={14} /> Bereich erklären
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((s, i) => {
                const key = `${area.key}-${i}`
                const open = openKey === key || !!query
                return (
                  <div key={key} className="bp-card" style={{ overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setOpenKey(open && !query ? null : key)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--bp-ink)' }}
                    >
                      {s.title}
                      <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--bp-ink-3)' }} />
                    </button>
                    {open && (
                      <p style={{ margin: 0, padding: '0 16px 14px', fontSize: '0.875rem', color: 'var(--bp-ink-2)', lineHeight: 1.6 }}>{s.body}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
