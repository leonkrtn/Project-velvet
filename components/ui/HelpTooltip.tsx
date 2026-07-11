'use client'

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'

// Zentrale, wiederverwendbare „?"-Hilfe. Öffnet bei Hover UND bei Klick/Fokus
// (Touch- und Tastatur-tauglich). Das Popover wird per Portal direkt an
// document.body gerendert (position: fixed, hoher z-index) — dadurch kann es
// von KEINEM overflow-/stacking-Container (z. B. Sidebar, Scrollbereiche)
// abgeschnitten oder überlagert werden.

const TIP_WIDTH = 260
const MARGIN = 8

export function HelpTip({ text, size = 14 }: { text: string; size?: number; align?: 'left' | 'right' }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; below: boolean } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const tipId = useId()
  const open = hover || pinned

  const position = useCallback(() => {
    const el = wrapRef.current
    if (!el || typeof window === 'undefined') return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const tipH = tipRef.current?.offsetHeight ?? 80
    // Horizontal: an der Icon-Mitte ausrichten, im Viewport clampen.
    let left = r.left + r.width / 2 - TIP_WIDTH / 2
    left = Math.max(MARGIN, Math.min(left, vw - TIP_WIDTH - MARGIN))
    // Vertikal: bevorzugt unter dem Icon; kein Platz → darüber.
    const below = r.bottom + 6 + tipH <= vh - MARGIN || r.top - 6 - tipH < MARGIN
    const top = below ? r.bottom + 6 : r.top - 6 - tipH
    setCoords({ top, left, below })
  }, [])

  // Position vor dem Paint setzen und bei Scroll/Resize aktualisieren, solange offen.
  useLayoutEffect(() => {
    if (!open) { setCoords(null); return }
    position()
    const onMove = () => position()
    window.addEventListener('scroll', onMove, true) // capture: auch Scroll in Containern
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, position])

  useEffect(() => {
    if (!pinned) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      if (tipRef.current?.contains(e.target as Node)) return
      setPinned(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [pinned])

  return (
    <span
      ref={wrapRef}
      style={{ display: 'inline-flex', flexShrink: 0 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label="Hilfe"
        aria-describedby={open ? tipId : undefined}
        onClick={() => setPinned(p => !p)}
        onFocus={() => setPinned(true)}
        onBlur={() => setPinned(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none',
          cursor: 'pointer', padding: 2, color: open ? 'var(--bp-gold-deep, #9C7F4F)' : 'var(--bp-ink-3, #94A3B8)', lineHeight: 0,
        }}
      >
        <HelpCircle size={size} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <span
          ref={tipRef}
          id={tipId}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            width: TIP_WIDTH, maxWidth: 'calc(100vw - 16px)',
            zIndex: 10000,
            visibility: coords ? 'visible' : 'hidden',
            background: '#1f2430', color: '#fff', fontSize: 12.5, lineHeight: 1.5, fontWeight: 400,
            padding: '10px 12px', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.28)', textAlign: 'left',
            fontFamily: "'DM Sans', system-ui, sans-serif", pointerEvents: 'none',
          }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  )
}

// Pflicht-Markierung: einheitliches goldenes Sternchen.
export function RequiredMark() {
  return <span aria-hidden="true" style={{ color: 'var(--bp-gold-deep, #b08d57)', marginLeft: 2 }}>*</span>
}

// Beschriftung mit optionalem Pflicht-Sternchen und optionaler „?"-Hilfe.
export function FieldLabel({
  children, required, help, style,
}: { children: React.ReactNode; required?: boolean; help?: string; style?: React.CSSProperties }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      <span>{children}{required && <RequiredMark />}</span>
      {help && <HelpTip text={help} />}
    </span>
  )
}
