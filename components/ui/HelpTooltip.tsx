'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'

// Zentrale, wiederverwendbare „?"-Hilfe. Öffnet bei Hover UND bei Klick/Fokus
// (Touch- und Tastatur-tauglich). Dezentes Popover im bp-Theme.
// Verwendung: <HelpTip text="Erklärung …" /> oder <FieldLabel required help="…">Feld</FieldLabel>.

const TIP_WIDTH = 240

export function HelpTip({ text, size = 14 }: { text: string; size?: number; align?: 'left' | 'right' }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false) // per Klick/Fokus offen gehalten
  const [align, setAlign] = useState<'left' | 'right' | 'center'>('right')
  const ref = useRef<HTMLSpanElement>(null)
  const tipId = useId()
  const open = hover || pinned

  // Ausrichtung so wählen, dass das Popover nie am Viewport-Rand abgeschnitten wird.
  const positionTip = () => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const margin = 8
    // Bevorzugt rechtsbündig (Popover reicht nach links). Passt das nicht, linksbündig.
    if (r.right - TIP_WIDTH < margin && r.left + TIP_WIDTH <= vw - margin) setAlign('left')
    else if (r.right - TIP_WIDTH >= margin) setAlign('right')
    else setAlign('center')
  }

  useEffect(() => {
    if (!open) return
    positionTip()
  }, [open])

  useEffect(() => {
    if (!pinned) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setPinned(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [pinned])

  const alignStyle: React.CSSProperties =
    align === 'right' ? { right: 0 }
    : align === 'left' ? { left: 0 }
    : { left: '50%', transform: 'translateX(-50%)' }

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
      onMouseEnter={() => { positionTip(); setHover(true) }}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label="Hilfe"
        aria-describedby={open ? tipId : undefined}
        onClick={() => { positionTip(); setPinned(p => !p) }}
        onFocus={() => { positionTip(); setPinned(true) }}
        onBlur={() => setPinned(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none',
          cursor: 'pointer', padding: 2, color: open ? 'var(--bp-gold-deep)' : 'var(--bp-ink-3)', lineHeight: 0,
        }}
      >
        <HelpCircle size={size} />
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', zIndex: 60,
            width: TIP_WIDTH, maxWidth: 'calc(100vw - 16px)',
            ...alignStyle,
            background: 'var(--bp-ink)', color: '#fff', fontSize: 12.5, lineHeight: 1.5, fontWeight: 400,
            padding: '10px 12px', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.22)', textAlign: 'left',
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {text}
        </span>
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
