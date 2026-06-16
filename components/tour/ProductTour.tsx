'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { SOLO_TOUR_STEPS, type TourStep } from '@/lib/tour/solo-tour-steps'

interface Props {
  eventId: string
  /** Welche Module sind freigeschaltet? Nur diese werden getourt. */
  available: Record<string, boolean>
}

// Event-Name zum manuellen (Neu-)Start über die Hilfe-Schaltfläche.
export const TOUR_START_EVENT = 'fv-solo-tour-start'

const PAD = 8           // Spotlight-Innenabstand um das Zielelement
const CARD_W = 340
const POLL_MS = 120
const MAX_TRIES = 45    // ~5,4 s warten, bis ein Zielelement erscheint

export default function ProductTour({ eventId, available }: Props) {
  const router = useRouter()

  const steps = useMemo(
    () => SOLO_TOUR_STEPS.filter(s => available[s.module] === true),
    [available],
  )

  const doneKey = `fv-solo-tour:${eventId}`
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  const step: TourStep | null = active ? steps[index] ?? null : null
  // Primitive Ableitungen für stabile Effekt-Abhängigkeiten (das step-Objekt
  // wechselt bei jedem Render die Identität, da `available` neu erzeugt wird).
  const stepModule = step?.module
  const stepTarget = step?.target

  useEffect(() => {
    setMounted(true)
    setViewport({ w: window.innerWidth, h: window.innerHeight })
  }, [])

  const start = useCallback(() => {
    if (steps.length === 0) return
    setIndex(0)
    setActive(true)
  }, [steps.length])

  const finish = useCallback(() => {
    setActive(false)
    setRect(null)
    try { localStorage.setItem(doneKey, 'done') } catch { /* ignore */ }
  }, [doneKey])

  // Manueller Start über die Hilfe-Schaltfläche.
  useEffect(() => {
    const onStart = () => start()
    window.addEventListener(TOUR_START_EVENT, onStart)
    return () => window.removeEventListener(TOUR_START_EVENT, onStart)
  }, [start])

  // Auto-Start für Erst-Nutzer — einmal pro Browser-Sitzung, bis die Tour
  // abgeschlossen oder übersprungen wurde.
  useEffect(() => {
    if (steps.length === 0) return
    try {
      if (localStorage.getItem(doneKey) === 'done') return
      if (sessionStorage.getItem(`${doneKey}:seen`)) return
      sessionStorage.setItem(`${doneKey}:seen`, '1')
    } catch { /* ignore */ }
    const t = window.setTimeout(() => start(), 700)
    return () => window.clearTimeout(t)
  }, [doneKey, start, steps.length])

  // Bei Schrittwechsel: ggf. zur Zielroute navigieren und das Element suchen.
  useEffect(() => {
    if (!active || !stepModule) return
    let cancelled = false
    const targetRoute = `/brautpaar/${eventId}/${stepModule}`
    const onRoute = () =>
      window.location.pathname === targetRoute ||
      window.location.pathname.startsWith(`${targetRoute}/`)

    if (!onRoute()) router.push(targetRoute)
    setRect(null)

    let tries = 0
    const tick = () => {
      if (cancelled) return
      if (onRoute()) {
        if (!stepTarget) { setRect(null); return }     // zentrierte Karte
        const el = document.querySelector<HTMLElement>(`[data-tour="${stepTarget}"]`)
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          window.setTimeout(() => {
            if (!cancelled) setRect(el.getBoundingClientRect())
          }, 280)
          return
        }
      }
      if (tries++ < MAX_TRIES) window.setTimeout(tick, POLL_MS)
      else setRect(null)                               // Fallback: zentrierte Karte
    }
    const id = window.setTimeout(tick, POLL_MS)
    return () => { cancelled = true; window.clearTimeout(id) }
  }, [active, index, stepModule, stepTarget, eventId, router])

  // Spotlight bei Scroll/Resize nachführen.
  useEffect(() => {
    if (!active) return
    const update = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      if (stepTarget) {
        const el = document.querySelector<HTMLElement>(`[data-tour="${stepTarget}"]`)
        if (el) setRect(el.getBoundingClientRect())
      }
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, stepTarget])

  // Tastatursteuerung.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(steps.length - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish, steps.length])

  if (!mounted || !active || !step) return null

  const isLast = index === steps.length - 1
  const next = () => { if (isLast) finish(); else setIndex(i => i + 1) }
  const back = () => setIndex(i => Math.max(0, i - 1))

  const { w: vw, h: vh } = viewport

  // Karten-Position berechnen: unter dem Spotlight, sonst darüber, sonst zentriert.
  let cardTop: number, cardLeft: number
  const CARD_EST_H = 200
  if (rect) {
    cardLeft = Math.min(Math.max(12, rect.left), vw - CARD_W - 12)
    if (rect.bottom + CARD_EST_H + 16 < vh) {
      cardTop = rect.bottom + 14
    } else if (rect.top - CARD_EST_H - 16 > 0) {
      cardTop = rect.top - CARD_EST_H - 14
    } else {
      cardTop = Math.max(12, (vh - CARD_EST_H) / 2)
      cardLeft = (vw - CARD_W) / 2
    }
  } else {
    cardTop = (vh - CARD_EST_H) / 2
    cardLeft = (vw - CARD_W) / 2
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000 }} aria-live="polite" role="dialog" aria-label="Produkt-Tour">
      {/* Klick-Blocker (fängt Interaktionen mit der Seite ab) */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', inset: 0,
          background: rect ? 'transparent' : 'rgba(31,26,22,0.55)',
          pointerEvents: 'auto',
        }}
      />

      {/* Spotlight: heller „Ausschnitt" via großem Box-Shadow */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(31,26,22,0.55)',
            outline: '2px solid var(--bp-gold, #9C7F4F)',
            outlineOffset: 2,
            transition: 'all 0.25s ease',
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* Erklär-Karte */}
      <div
        style={{
          position: 'fixed',
          top: cardTop,
          left: cardLeft,
          width: CARD_W,
          maxWidth: 'calc(100vw - 24px)',
          background: 'var(--bp-paper, #fff)',
          borderRadius: 16,
          boxShadow: '0 18px 50px rgba(31,26,22,0.28)',
          border: '1px solid var(--bp-line, #e7e0d6)',
          padding: '18px 18px 14px',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--bp-gold, #9C7F4F)' }}>
            Schritt {index + 1} von {steps.length}
          </span>
          <button
            type="button"
            onClick={finish}
            aria-label="Tour beenden"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bp-ink-3, #9b9085)', display: 'flex', padding: 2 }}
          >
            <X size={18} />
          </button>
        </div>

        <h3 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '1.45rem', fontWeight: 600, color: 'var(--bp-ink, #2b2620)', margin: '0 0 6px' }}>
          {step.title}
        </h3>
        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--bp-ink-2, #5d564d)', margin: '0 0 16px' }}>
          {step.body}
        </p>

        {/* Fortschrittsbalken */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {steps.map((_, i) => (
            <span
              key={i}
              style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i <= index ? 'var(--bp-gold, #9C7F4F)' : 'var(--bp-line, #e7e0d6)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button
            type="button"
            onClick={finish}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--bp-ink-3, #9b9085)', fontFamily: 'inherit', padding: '6px 2px' }}
          >
            Überspringen
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 999, border: '1px solid var(--bp-line, #e7e0d6)', background: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--bp-ink-2, #5d564d)', fontFamily: 'inherit' }}
              >
                <ChevronLeft size={15} /> Zurück
              </button>
            )}
            <button
              type="button"
              onClick={next}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 999, border: 'none', background: 'var(--bp-gold, #9C7F4F)', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'inherit' }}
            >
              {isLast ? (<><Check size={15} /> Fertig</>) : (<>Weiter <ChevronRight size={15} /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
