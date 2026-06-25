'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { VENDOR_TOUR_STEPS, VENDOR_TOUR_START_EVENT } from '@/lib/tour/vendor-tour-steps'

const CARD_W = 340
const POLL_MS = 120
const MAX_WAIT_MS = POLL_MS * 45   // ~5.4 s warten, bis ein Zielelement erscheint

// Vendor-Route-Karte: Modul-Schlüssel → Pfad
const ROUTE_MAP: Record<string, string> = {
  ubersicht:        '/vendor/ubersicht',
  anfragen:         '/vendor/anfragen',
  angebote:         '/vendor/angebote',
  events:           '/vendor/dashboard',
  listing:          '/vendor/listing',
  'anfrage-formular': '/vendor/anfrage-formular',
}

export default function VendorTour() {
  const router = useRouter()
  const steps = VENDOR_TOUR_STEPS

  const [mounted,    setMounted]    = useState(false)
  const [active,     setActive]     = useState(false)
  const [index,      setIndex]      = useState(0)
  const [rect,       setRect]       = useState<DOMRect | null>(null)
  // true, sobald Zielposition feststeht — erst dann wird die Karte gerendert.
  const [positioned, setPositioned] = useState(false)
  const [viewport,   setViewport]   = useState({ w: 0, h: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const [measuredH, setMeasuredH] = useState(0)

  const step       = active ? steps[index] ?? null : null
  const stepModule = step?.module
  const stepTarget = step?.target
  const stepAppear = step?.advanceOnAppear
  const isInteractive = !!(step?.interactive || step?.advanceOnAppear)

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
  }, [])

  const advance = useCallback(() => {
    setIndex(i => {
      if (i >= steps.length - 1) { finish(); return i }
      return i + 1
    })
  }, [steps.length, finish])

  // Nur manueller Start über den Hilfe-Button — kein Auto-Start.
  useEffect(() => {
    const onStart = () => start()
    window.addEventListener(VENDOR_TOUR_START_EVENT, onStart)
    return () => window.removeEventListener(VENDOR_TOUR_START_EVENT, onStart)
  }, [start])

  // Position vor dem Paint zurücksetzen, damit die Karte nie kurz an der
  // alten Stelle aufblitzt.
  useLayoutEffect(() => {
    if (!active) return
    setPositioned(false)
    setRect(null)
  }, [active, index])

  // Routing + zentrierte Karte für zielfreie Schritte.
  useEffect(() => {
    if (!active || !stepModule) return
    let cancelled = false
    const timers: number[] = []
    const targetRoute = ROUTE_MAP[stepModule]

    if (targetRoute) {
      const onRoute = () =>
        window.location.pathname === targetRoute ||
        window.location.pathname.startsWith(`${targetRoute}/`)

      if (!onRoute()) router.push(targetRoute)

      // Zielfreier Schritt: zentrierte Karte, sobald die Route stimmt.
      if (!stepTarget) {
        let tries = 0
        const wait = () => {
          if (cancelled) return
          if (onRoute()) { setRect(null); setPositioned(true); return }
          if (tries++ < 45) timers.push(window.setTimeout(wait, POLL_MS))
          else setPositioned(true)
        }
        timers.push(window.setTimeout(wait, POLL_MS))
      }
    } else {
      // Kein bekannter Route-Mapping → sofort zentrierte Karte.
      if (!stepTarget) setPositioned(true)
    }

    return () => { cancelled = true; timers.forEach(t => window.clearTimeout(t)) }
  }, [active, index, stepModule, stepTarget, router])

  // Viewport-Maße aktuell halten.
  useEffect(() => {
    if (!active) return
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active])

  // KERN: Ring + Abdunklung direkt auf das Zielelement legen (keine zweite Box).
  // Fallback nach MAX_WAIT_MS: zentrierte Karte, falls das Element nicht erscheint.
  useEffect(() => {
    if (!active || !stepTarget) return
    let raf = 0
    let cancelled = false
    let node: HTMLElement | null = null
    let saved: { position: string; zIndex: string; borderRadius: string; boxShadow: string; transition: string } | null = null
    let startTime: number | null = null

    // Interaktive Schritte: subtiler Ring ohne Abdunklung.
    const ring = isInteractive
      ? '0 0 0 3px rgba(184,153,104,0.9), 0 0 0 6px rgba(184,153,104,0.18)'
      : '0 0 0 3px var(--gold, #B89968), 0 0 0 9999px rgba(31,26,22,0.55)'

    const same = (a: DOMRect, b: DOMRect) =>
      Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 &&
      Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5

    const paint = (el: HTMLElement) => {
      const cs = getComputedStyle(el)
      if (cs.position === 'static') el.style.position = 'relative'
      el.style.zIndex = '3500'
      if (cs.borderRadius === '0px') el.style.borderRadius = '12px'
      el.style.boxShadow = ring
      el.style.transition = 'box-shadow 0.2s ease'
    }
    const restore = () => {
      if (node && saved) {
        node.style.position = saved.position
        node.style.zIndex   = saved.zIndex
        node.style.borderRadius = saved.borderRadius
        node.style.boxShadow = saved.boxShadow
        node.style.transition = saved.transition
      }
      node = null; saved = null
    }

    const loop = () => {
      if (cancelled) return
      if (startTime === null) startTime = performance.now()

      const el = document.querySelector<HTMLElement>(`[data-tour="${stepTarget}"]`)
      if (el) {
        if (el !== node) {
          restore()
          saved = {
            position: el.style.position, zIndex: el.style.zIndex,
            borderRadius: el.style.borderRadius, boxShadow: el.style.boxShadow,
            transition: el.style.transition,
          }
          node = el
          paint(el)
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          setPositioned(true)
        } else if (el.style.boxShadow !== ring) {
          paint(el)
        }
        const r = el.getBoundingClientRect()
        setRect(prev => (prev && same(prev, r) ? prev : r))
      } else if (performance.now() - startTime > MAX_WAIT_MS) {
        // Element nicht gefunden → Fallback: zentrierte Karte.
        setRect(null)
        setPositioned(true)
        return
      }

      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => { cancelled = true; window.cancelAnimationFrame(raf); restore() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepTarget, index])

  // advanceOnAppear: warten bis ein Element mit dem gegebenen data-tour erscheint,
  // dann automatisch zum nächsten Schritt springen.
  useEffect(() => {
    if (!active || !stepAppear) return
    let raf = 0
    let cancelled = false

    const poll = () => {
      if (cancelled) return
      const el = document.querySelector(`[data-tour="${stepAppear}"]`)
      if (el) { advance(); return }
      raf = window.requestAnimationFrame(poll)
    }
    raf = window.requestAnimationFrame(poll)
    return () => { cancelled = true; window.cancelAnimationFrame(raf) }
  }, [active, stepAppear, index, advance])

  // Tastatursteuerung.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') advance()
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish, advance])

  // Echte Kartenhöhe messen — damit die Karte nie unten aus dem Bild ragt.
  useLayoutEffect(() => {
    if (!active) return
    const el = cardRef.current
    if (!el) return
    const measure = () => setMeasuredH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [active, index, positioned])

  if (!mounted || !active || !step) return null

  const isLast = index === steps.length - 1
  const next = () => { if (isLast) finish(); else setIndex(i => i + 1) }
  const back = () => setIndex(i => Math.max(0, i - 1))

  const { w: vw, h: vh } = viewport
  const cardH = measuredH || 200
  const GAP = 14
  let cardTop: number, cardLeft: number

  if (isInteractive) {
    // Interaktive Schritte: Karte am Rand des Viewports, nie vor dem Zielelement.
    // Ist das Ziel in der unteren Hälfte → Karte oben; sonst unten.
    const targetInLowerHalf = rect ? rect.top > vh / 2 : false
    cardTop  = targetInLowerHalf ? 24 : vh - cardH - 24
    cardLeft = (vw - CARD_W) / 2
  } else if (rect) {
    const canBelow = rect.bottom + cardH + GAP < vh
    const canAbove = rect.top - cardH - GAP > 0
    const canRight = rect.right + CARD_W + GAP + 12 < vw
    const canLeft  = rect.left - CARD_W - GAP > 12

    if (canBelow) {
      cardTop  = rect.bottom + GAP
      cardLeft = Math.min(Math.max(12, rect.left), vw - CARD_W - 12)
    } else if (canAbove) {
      cardTop  = rect.top - cardH - GAP
      cardLeft = Math.min(Math.max(12, rect.left), vw - CARD_W - 12)
    } else if (canRight) {
      cardLeft = rect.right + GAP
      cardTop  = Math.max(12, Math.min(rect.top, vh - cardH - 12))
    } else if (canLeft) {
      cardLeft = rect.left - CARD_W - GAP
      cardTop  = Math.max(12, Math.min(rect.top, vh - cardH - 12))
    } else {
      // Element füllt fast den gesamten Viewport — auf der Seite mit mehr Platz platzieren.
      const spaceBelow = vh - rect.bottom
      const spaceAbove = rect.top
      cardLeft = (vw - CARD_W) / 2
      cardTop  = spaceBelow >= spaceAbove ? rect.bottom + GAP : rect.top - cardH - GAP
    }
  } else {
    cardTop  = (vh - cardH) / 2
    cardLeft = (vw - CARD_W) / 2
  }
  cardTop = Math.max(12, Math.min(cardTop, vh - cardH - 12))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, pointerEvents: 'none' }} aria-live="polite" role="dialog" aria-label="Plattform-Tour">
      <style>{`@keyframes vdrTourIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Overlay: bei interaktiven Schritten transparent (Nutzer kann klicken).
          Bei normalen Schritten: Abdunklung kommt vom box-shadow am Zielelement,
          hier nur opaker Fänger ohne Abdunklung wenn rect gesetzt, sonst dunkler BG. */}
      {!isInteractive && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', inset: 0,
            background: rect ? 'transparent' : 'rgba(31,26,22,0.55)',
            pointerEvents: 'auto',
          }}
        />
      )}

      {positioned && (
        <div
          ref={cardRef}
          key={index}
          style={{
            position: 'fixed',
            animation: 'vdrTourIn 0.28s ease both',
            top: cardTop,
            left: cardLeft,
            width: CARD_W,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'calc(100dvh - 24px)',
            overflowY: 'auto',
            background: 'var(--surface, #fff)',
            borderRadius: 16,
            boxShadow: '0 18px 50px rgba(31,26,22,0.28)',
            border: '1px solid var(--border)',
            padding: '18px 18px 14px',
            pointerEvents: 'auto',
          }}
        >
          {/* Kopfzeile */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold, #B89968)' }}>
              Schritt {index + 1} von {steps.length}
            </span>
            <button
              type="button"
              onClick={finish}
              aria-label="Tour beenden"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 2 }}
            >
              <X size={18} />
            </button>
          </div>

          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary, #1a1a1a)', margin: '0 0 6px' }}>
            {step.title}
          </h3>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: stepAppear ? '0 0 8px' : '0 0 16px' }}>
            {step.body}
          </p>
          {stepAppear && (
            <p style={{ fontSize: '0.75rem', color: 'var(--gold, #B89968)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Die Tour springt automatisch weiter, sobald du die Aktion ausführst — oder klicke „Weiter", um zu überspringen.
            </p>
          )}

          {/* Fortschrittsbalken */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {steps.map((_, i) => (
              <span
                key={i}
                style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= index ? 'var(--gold, #B89968)' : 'var(--border)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>

          {/* Steuerung */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <button
              type="button"
              onClick={finish}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', padding: '6px 2px' }}
            >
              Tour beenden
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {index > 0 && (
                <button
                  type="button"
                  onClick={back}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit' }}
                >
                  <ChevronLeft size={15} /> Zurück
                </button>
              )}
              <button
                type="button"
                onClick={next}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 999, border: 'none',
                  background: 'var(--gold, #B89968)', color: '#fff', cursor: 'pointer',
                  fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                {isLast ? (<><Check size={15} /> Fertig</>) : (<>Weiter <ChevronRight size={15} /></>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
