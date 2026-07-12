'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { SOLO_TOUR_STEPS, type TourStep } from '@/lib/tour/solo-tour-steps'
import { createClient } from '@/lib/supabase/client'

interface Props {
  eventId: string
  /** Welche Module sind freigeschaltet? Nur diese werden getourt. */
  available: Record<string, boolean>
}

// Event-Name zum manuellen (Neu-)Start über die Hilfe-Schaltfläche.
export const TOUR_START_EVENT = 'fv-solo-tour-start'

const CARD_W = 340
const POLL_MS = 120
const MAX_TRIES = 45    // ~5,4 s warten, bis ein Zielelement erscheint
const ACTION_POLL_MS = 1500   // Takt der Eintrags-Erkennung bei Anlege-Schritten

// Status eines begleiteten Anlege-Schritts:
//  none     – kein Anlege-Schritt
//  waiting  – wartet auf den ersten Eintrag
//  pre      – schon vorhanden (z. B. bei erneutem Tour-Start) → kein Auto-Weiter
//  new      – soeben angelegt → Auto-Weiter
type ActionState = 'none' | 'waiting' | 'pre' | 'new'

export default function ProductTour({ eventId, available }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Bereichsfilter für „einzelnen Bereich erklären" (aus der Hilfe-Seite via
  // CustomEvent-Detail { area }). null = kompletter Rundgang.
  const [areaFilter, setAreaFilter] = useState<string | null>(null)

  const steps = useMemo(
    () => SOLO_TOUR_STEPS.filter(
      s => available[s.module] === true && (!areaFilter || s.area === areaFilter),
    ),
    [available, areaFilter],
  )

  const doneKey = `fv-solo-tour:${eventId}`
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  // True, sobald die endgültige Karten-/Spotlight-Position für den aktuellen
  // Schritt feststeht. Erst dann wird die Karte gerendert + eingeblendet.
  const [positioned, setPositioned] = useState(false)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [actionState, setActionState] = useState<ActionState>('none')
  // Tatsächlich gerenderte Kartenhöhe (statt fester Schätzung) — damit die
  // Karte nie unten aus dem Bild ragt und abgeschnitten wird.
  const cardRef = useRef<HTMLDivElement>(null)
  const [measuredH, setMeasuredH] = useState(0)

  const step: TourStep | null = active ? steps[index] ?? null : null
  // Primitive Ableitungen für stabile Effekt-Abhängigkeiten (das step-Objekt
  // wechselt bei jedem Render die Identität, da `available` neu erzeugt wird).
  const stepModule = step?.module
  const stepTarget = step?.target
  const stepArea = step?.action?.area
  const isAction = !!stepArea
  const stepAppear = step?.advanceOnAppear
  const stepDisappear = step?.advanceOnDisappear
  // „Interaktiv": Seite bleibt bedienbar (Feld-Begleitung / Anlegen).
  const interactiveStep = isAction || step?.interactive === true || !!stepAppear || !!stepDisappear
  // „Selbst weiterschaltend": Fortschritt hängt an echter Aktion → kein Weiter-Button.
  const selfDrives = isAction || !!stepAppear || !!stepDisappear

  useEffect(() => {
    setMounted(true)
    setViewport({ w: window.innerWidth, h: window.innerHeight })
  }, [])

  const start = useCallback((area?: string | null) => {
    setAreaFilter(area ?? null)
    setIndex(0)
    setActive(true)
  }, [])

  // „Beenden" — Tour für JETZT schließen (nur diese Sitzung). Der sessionStorage-
  // „seen"-Marker verhindert einen erneuten Auto-Start in dieser Sitzung; in einer
  // neuen Browser-Sitzung kann die Tour wieder erscheinen.
  const finish = useCallback(() => {
    setActive(false)
    setRect(null)
    setAreaFilter(null)
  }, [])

  // „Nicht mehr anzeigen" bzw. vollständig durchlaufen — dauerhaft merken, dass
  // die Tour erledigt ist (kein Auto-Start mehr). Manuell über die Hilfe bleibt
  // sie jederzeit startbar.
  const dismissForever = useCallback(() => {
    setActive(false)
    setRect(null)
    setAreaFilter(null)
    try { localStorage.setItem(doneKey, 'done') } catch { /* ignore */ }
  }, [doneKey])

  const advance = useCallback(() => {
    setIndex(i => {
      if (i >= steps.length - 1) { dismissForever(); return i }
      return i + 1
    })
  }, [steps.length, dismissForever])

  // Manueller Start über die Hilfe-Seite. Optional mit { area } im Detail →
  // nur die Schritte dieses Bereichs (sonst kompletter Rundgang).
  useEffect(() => {
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent).detail as { area?: string } | undefined
      start(detail?.area ?? null)
    }
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

  // Bei jedem Schrittwechsel die Position zurücksetzen, BEVOR der Browser zeichnet
  // (useLayoutEffect) — so wird die Karte nie kurz an der alten/zentrierten Stelle
  // gezeigt. Sie bleibt verborgen, bis `positioned` für den neuen Schritt feststeht.
  useLayoutEffect(() => {
    if (!active) return
    setPositioned(false)
    setRect(null)
  }, [active, index])

  // Bei Schrittwechsel ggf. zur Zielroute navigieren. Das eigentliche Hervorheben
  // (Ring direkt am Zielelement) übernimmt der Loop weiter unten — hier nur Routing
  // sowie das Einblenden der Karte für interaktive bzw. zentrierte (zielfreie) Schritte.
  useEffect(() => {
    if (!active || !stepModule) return
    let cancelled = false
    const timers: number[] = []
    const targetRoute = `/brautpaar/${eventId}/${stepModule}`
    const onRoute = () =>
      window.location.pathname === targetRoute ||
      window.location.pathname.startsWith(`${targetRoute}/`)

    if (!onRoute()) router.push(targetRoute)
    if (interactiveStep) setPositioned(true)

    // Zielfreie Schritte: zentrierte Karte, sobald die Route steht.
    if (!stepTarget) {
      let tries = 0
      const wait = () => {
        if (cancelled) return
        if (onRoute()) { setRect(null); setPositioned(true); return }
        if (tries++ < MAX_TRIES) timers.push(window.setTimeout(wait, POLL_MS))
        else setPositioned(true)
      }
      timers.push(window.setTimeout(wait, POLL_MS))
    }
    return () => { cancelled = true; timers.forEach(t => window.clearTimeout(t)) }
  }, [active, index, stepModule, stepTarget, interactiveStep, eventId, router])

  // Begleitetes Anlegen: Baseline ermitteln und auf den ersten Eintrag warten.
  useEffect(() => {
    if (!active || !stepArea) { setActionState('none'); return }
    let cancelled = false
    let timer: number | undefined
    setActionState('waiting')

    const countRows = async (): Promise<number> => {
      const { count } = await supabase
        .from(stepArea)
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
      return count ?? 0
    }

    ;(async () => {
      let baseline = 0
      try { baseline = await countRows() } catch { /* ignore */ }
      if (cancelled) return
      if (baseline > 0) { setActionState('pre'); return }   // schon vorhanden
      const poll = async () => {
        if (cancelled) return
        let c = baseline
        try { c = await countRows() } catch { /* ignore */ }
        if (cancelled) return
        if (c > baseline) setActionState('new')
        else timer = window.setTimeout(poll, ACTION_POLL_MS)
      }
      timer = window.setTimeout(poll, ACTION_POLL_MS)
    })()

    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [active, index, stepArea, eventId, supabase])

  // Nach erkanntem Neu-Eintrag automatisch zum nächsten Schritt.
  useEffect(() => {
    if (actionState !== 'new') return
    const t = window.setTimeout(() => advance(), 1400)
    return () => window.clearTimeout(t)
  }, [actionState, advance])

  // DOM-basiertes Auto-Weiter: erkennt, wenn ein Menü/Feld auf- bzw. zugeht.
  //  • advanceOnAppear   → weiter, sobald das Element erscheint (Formular geöffnet).
  //  • advanceOnDisappear → weiter, sobald es wieder verschwindet (gespeichert).
  useEffect(() => {
    if (!active || (!stepAppear && !stepDisappear)) return
    let cancelled = false
    let timer: number | undefined
    let seenPresent = false
    const poll = () => {
      if (cancelled) return
      if (stepAppear && document.querySelector(`[data-tour="${stepAppear}"]`)) {
        advance(); return
      }
      if (stepDisappear) {
        const el = document.querySelector(`[data-tour="${stepDisappear}"]`)
        if (el) seenPresent = true
        else if (seenPresent) { advance(); return }
      }
      timer = window.setTimeout(poll, POLL_MS)
    }
    timer = window.setTimeout(poll, POLL_MS)
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [active, index, stepAppear, stepDisappear, advance])

  // Während der Tour die Einblende-Animationen der Übersicht (.bp-reveal sowie
  // die Hero-„rise") sofort auf den Endzustand setzen. CSS-`transform` verschiebt
  // nur die sichtbare Darstellung, nicht die Layout-Box — sonst würde das anhand
  // der Layout-Box gezeichnete Spotlight neben dem noch animierten Inhalt liegen
  // („Boxen passen nicht"). Spiegelt die prefers-reduced-motion-Regeln.
  useEffect(() => {
    if (!active) return
    const style = document.createElement('style')
    style.setAttribute('data-fv-tour', 'reveal-settle')
    style.textContent =
      '.bp-mag .bp-reveal{opacity:1!important;transform:none!important;transition:none!important;}' +
      '.bp-mag-hero-inner>*{animation:none!important;opacity:1!important;transform:none!important;}'
    document.head.appendChild(style)
    return () => { style.remove() }
  }, [active])

  // Viewport-Maße aktuell halten (für die Karten-Positionierung).
  useEffect(() => {
    if (!active) return
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active])

  // KERN DER LÖSUNG — „nur eine Box": Statt einen separaten Rahmen an den
  // gemessenen Koordinaten zu zeichnen (zweite Box, die danebenliegen kann),
  // wird der Ring (und die Abdunklung) DIREKT auf das Zielelement gelegt. Der
  // Rahmen IST damit das Element selbst und kann prinzipiell nie verrutschen.
  // Ein Loop sorgt dafür, dass das Highlight stets am aktuellen Element hängt
  // (auch nach Re-Mounts) und pflegt nebenbei `rect` für die Karten-Position.
  useEffect(() => {
    if (!active || !stepTarget) return
    let raf = 0
    let cancelled = false
    let node: HTMLElement | null = null
    let saved: { position: string; zIndex: string; borderRadius: string; boxShadow: string; transition: string } | null = null

    // Interaktiver Schritt: nur Ring (Seite bleibt sicht- und bedienbar).
    // Erklär-Schritt: Ring + Abdunklung der Umgebung (riesiger box-shadow).
    const ring = interactiveStep
      ? '0 0 0 3px rgba(156,127,79,0.95), 0 0 0 6px rgba(156,127,79,0.22)'
      : '0 0 0 3px #9C7F4F, 0 0 0 9999px rgba(31,26,22,0.55)'

    const same = (a: DOMRect, b: DOMRect) =>
      Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 &&
      Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5

    // Sichtbare Hervorhebung setzen (idempotent) — wird bei Bedarf jeden Frame
    // erneut gesetzt, falls ein React-Re-Render das inline-style zurücksetzt.
    const paint = (el: HTMLElement) => {
      const cs = getComputedStyle(el)
      if (cs.position === 'static') el.style.position = 'relative'
      el.style.zIndex = '3500'           // über Inhalt/Sidebar, unter der Tour-Karte (4000)
      if (cs.borderRadius === '0px') el.style.borderRadius = '12px'
      el.style.boxShadow = ring
      el.style.transition = 'box-shadow 0.2s ease'
    }
    const restore = () => {
      if (node && saved) {
        node.style.position = saved.position
        node.style.zIndex = saved.zIndex
        node.style.borderRadius = saved.borderRadius
        node.style.boxShadow = saved.boxShadow
        node.style.transition = saved.transition
      }
      node = null; saved = null
    }

    const loop = () => {
      if (cancelled) return
      const el = document.querySelector<HTMLElement>(`[data-tour="${stepTarget}"]`)
      if (el) {
        if (el !== node) {
          restore()
          // Originalwerte EINMAL sichern (vor dem Übermalen).
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
          paint(el)   // React hat das inline-style überschrieben → neu setzen
        }
        const r = el.getBoundingClientRect()
        setRect(prev => (prev && same(prev, r) ? prev : r))
      }
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => { cancelled = true; window.cancelAnimationFrame(raf); restore() }
  }, [active, stepTarget, index, interactiveStep])

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

  // Echte Kartenhöhe vor dem Paint messen (inkl. späterer Inhalts-/Resize-
  // Änderungen via ResizeObserver), damit die Positionierung mit der
  // tatsächlichen Höhe rechnen kann.
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
  const actionSatisfied = actionState === 'pre' || actionState === 'new'
  const next = () => { if (isLast) dismissForever(); else setIndex(i => i + 1) }
  const back = () => setIndex(i => Math.max(0, i - 1))

  const { w: vw, h: vh } = viewport

  // Karten-Position berechnen. Höhe: gemessen (sobald verfügbar), sonst Schätzung.
  const CARD_EST_H = interactiveStep ? 240 : 200
  const cardH = measuredH || CARD_EST_H
  let cardTop: number, cardLeft: number
  if (interactiveStep) {
    // Interaktive Schritte: Karte unten zentriert — stört das echte Formular nicht.
    cardLeft = Math.max(12, (vw - CARD_W) / 2)
    cardTop = vh - cardH - 24
  } else if (rect) {
    cardLeft = Math.min(Math.max(12, rect.left), vw - CARD_W - 12)
    if (rect.bottom + cardH + 16 < vh) {
      cardTop = rect.bottom + 14
    } else if (rect.top - cardH - 16 > 0) {
      cardTop = rect.top - cardH - 14
    } else {
      cardTop = (vh - cardH) / 2
      cardLeft = (vw - CARD_W) / 2
    }
  } else {
    cardTop = (vh - cardH) / 2
    cardLeft = (vw - CARD_W) / 2
  }
  // Immer vollständig im sichtbaren Bereich halten: Ober- und Unterkante mit
  // 12px Rand begrenzen, damit die Karte nie oben oder unten abgeschnitten wird.
  cardTop = Math.max(12, Math.min(cardTop, vh - cardH - 12))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, pointerEvents: 'none' }} aria-live="polite" role="dialog" aria-label="Produkt-Tour">
      <style>{`@keyframes fvTourIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes fvTourFadeIn{from{opacity:0}to{opacity:1}}`}</style>
      {/* Hintergrund / Klick-Schutz.
          • Anlege-/Feld-Schritt (interactiveStep): KEIN Overlay — die Seite bleibt
            voll bedienbar; das Element trägt nur einen Ring.
          • Erklär-Schritt: transparenter, ganzflächiger Klick-Fänger. Die sichtbare
            Abdunklung erzeugt der riesige box-shadow direkt am Zielelement, sodass
            es genau EINE hervorgehobene Box gibt — das Element selbst.
          • Solange noch kein Ziel hervorgehoben ist (rect null): echtes Abdunkeln. */}
      {!interactiveStep && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', inset: 0,
            background: rect ? 'transparent' : 'rgba(31,26,22,0.55)',
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* Erklär-/Anlege-Karte — erst rendern, wenn die Zielposition feststeht, und
          dann sanft an Ort und Stelle einblenden (kein „Sprung aus der Mitte"). */}
      {positioned && (
      <div
        ref={cardRef}
        key={index}
        style={{
          position: 'fixed',
          animation: 'fvTourIn 0.28s ease both',
          top: cardTop,
          left: cardLeft,
          width: CARD_W,
          maxWidth: 'calc(100vw - 24px)',
          // Sicherheitsnetz für sehr kleine Displays: nie höher als der
          // sichtbare Bereich; überzähliger Inhalt scrollt innerhalb der Karte.
          maxHeight: 'calc(100dvh - 24px)',
          overflowY: 'auto',
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

        {/* Status-Zeile beim begleiteten Anlegen */}
        {isAction && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: '0.8125rem', fontWeight: 600 }}>
            {actionState === 'waiting' && (
              <>
                <Loader2 size={15} className="animate-spin" style={{ color: 'var(--bp-gold, #9C7F4F)' }} />
                <span style={{ color: 'var(--bp-ink-3, #9b9085)' }}>Warte auf euren ersten Eintrag…</span>
              </>
            )}
            {actionSatisfied && (
              <>
                <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: '50%', background: '#2f8f5b', color: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} />
                </span>
                <span style={{ color: '#2f8f5b' }}>
                  {actionState === 'new' ? 'Eintrag erstellt!' : 'Schon vorhanden'}
                </span>
              </>
            )}
          </div>
        )}

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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          {/* Zwei getrennte Abschluss-Optionen:
              • „Beenden" schließt die Tour nur für jetzt (kann später wieder starten).
              • „Nicht mehr anzeigen" merkt dauerhaft, dass die Tour erledigt ist. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={finish}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--bp-ink-2, #5d564d)', fontFamily: 'inherit', padding: '6px 2px' }}
            >
              Beenden
            </button>
            <button
              type="button"
              onClick={dismissForever}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--bp-ink-3, #9b9085)', fontFamily: 'inherit', padding: '6px 2px' }}
            >
              Nicht mehr anzeigen
            </button>
          </div>
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
            {/* Bei rein DOM-getriebenen Schritten (advanceOnAppear/Disappear) treibt
                die echte Aktion den Fortschritt — dann statt „Weiter" nur „Überspringen". */}
            {selfDrives && !isAction ? (
              <button
                type="button"
                onClick={advance}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 999, border: '1px solid var(--bp-line, #e7e0d6)', background: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--bp-ink-2, #5d564d)', fontFamily: 'inherit' }}
              >
                Überspringen <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                disabled={isAction && !actionSatisfied}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 999, border: 'none',
                  background: isAction && !actionSatisfied ? 'var(--bp-line, #e7e0d6)' : 'var(--bp-gold, #9C7F4F)',
                  color: isAction && !actionSatisfied ? 'var(--bp-ink-3, #9b9085)' : '#fff',
                  cursor: isAction && !actionSatisfied ? 'default' : 'pointer',
                  fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                {isLast ? (<><Check size={15} /> Fertig</>) : (<>Weiter <ChevronRight size={15} /></>)}
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
