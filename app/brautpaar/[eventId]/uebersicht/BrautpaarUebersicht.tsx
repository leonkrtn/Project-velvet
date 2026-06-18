'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Users, LayoutGrid, Calendar, UtensilsCrossed, Palette, Music,
  ArrowRight, Check, Send, UserPlus, CalendarHeart, Wallet, MapPin,
} from 'lucide-react'

interface NextTask {
  id: string
  title: string
}

interface Props {
  eventId: string
  coverImageUrl: string | null
  monogram?: string
  eventTitle: string
  eventDate: string | null
  coupleName: string
  venueName: string
  daysLeft: number | null
  guestTotal: number
  guestConfirmed: number
  guestDeclined: number
  guestPending: number
  guestNotInvited: number
  guestApprovalPending: number
  budgetPlanned: number
  budgetLimit: number
  budgetItemCount: number
  tasksDone: number
  tasksTotal: number
  nextTasks: NextTask[]
  seatedCount: number
  songCount: number
  timelineCount: number
  cateringConfigured: boolean
}

const SERIF = 'Cormorant Garamond, Georgia, serif'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(amount)
}

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Count-up: eases an integer from 0 → target once, on mount.
function useCountUp(target: number, durationMs = 1100, delayMs = 0) {
  const [value, setValue] = useState(prefersReduced() ? target : 0)
  useEffect(() => {
    if (prefersReduced()) { setValue(target); return }
    let raf = 0
    let start = 0
    const tick = (t: number) => {
      if (!start) start = t + delayMs
      const elapsed = t - start
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return }
      const p = Math.min(elapsed / durationMs, 1)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, delayMs])
  return value
}

// Scroll-reveal: adds `.in` to every `.bp-reveal` inside the ref as it enters.
// Robust: reveals what's already on screen immediately, lazily reveals the rest
// on scroll, and a safety net reveals everything after a moment so content can
// never stay hidden (which on mobile would look like the page won't scroll).
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const els = Array.from(root.querySelectorAll<HTMLElement>('.bp-reveal'))
    if (prefersReduced() || typeof IntersectionObserver === 'undefined') {
      els.forEach(el => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' })
    els.forEach(el => io.observe(el))
    // Safety net: nichts darf dauerhaft unsichtbar bleiben.
    const t = setTimeout(() => els.forEach(el => el.classList.add('in')), 2500)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [])
  return ref
}

// Animated integer (lining figures applied via .bp-num in CSS).
function CountUpNum({ value, duration, delay, suffix }: { value: number; duration?: number; delay?: number; suffix?: string }) {
  const n = useCountUp(value, duration, delay)
  return <>{n}{suffix}</>
}

// ── Hero / Cover ───────────────────────────────────────────────────────────────

function Hero({ eventId, coupleName, eventTitle, eventDate, venueName, daysLeft, coverImageUrl, monogram = '' }: {
  eventId: string
  coupleName: string
  eventTitle: string
  eventDate: string | null
  venueName: string
  daysLeft: number | null
  coverImageUrl: string | null
  monogram?: string
}) {
  const heading = coupleName || eventTitle || 'Eure Hochzeit'
  const hasPhoto = !!coverImageUrl

  return (
    <header data-tour="ov-hero" className={`bp-mag-hero ${hasPhoto ? 'has-photo' : ''} bp-mb-8`}>
      {hasPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl} alt="" className="bp-mag-hero-photo bp-kenburns" />
      )}
      <div className="bp-mag-hero-veil" />

      <div className="bp-mag-hero-inner">
        <p className="bp-mag-kicker">{monogram ? `${monogram} · Hochzeitsjournal` : 'FOREVR · Hochzeitsjournal'}</p>

        <h1 className="bp-mag-title" style={{ fontFamily: SERIF }}>{heading}</h1>

        <div className="bp-mag-ornament" aria-hidden>
          <span /><CalendarHeart size={14} /><span />
        </div>

        <p className="bp-mag-meta">
          {eventDate ? formatDate(eventDate) : 'Noch kein Datum festgelegt'}
          {eventDate && venueName ? ' · ' : null}
          {eventDate ? venueName : null}
        </p>

        {daysLeft !== null ? (
          <div className="bp-mag-countdown">
            <div className="bp-mag-countdown-num bp-num" style={{ fontFamily: SERIF }}>
              {daysLeft > 0 ? <CountUpNum value={daysLeft} duration={1400} delay={260} />
                : daysLeft === 0 ? '♥' : <CountUpNum value={Math.abs(daysLeft)} duration={1400} delay={260} />}
            </div>
            <div className="bp-mag-countdown-label">
              {daysLeft > 0 ? (daysLeft === 1 ? 'Tag bis zum Ja-Wort' : 'Tage bis zum Ja-Wort')
                : daysLeft === 0 ? 'Heute ist euer großer Tag'
                : daysLeft === -1 ? 'Tag seit eurer Hochzeit' : 'Tage seit eurer Hochzeit'}
            </div>
          </div>
        ) : (
          <Link href={`/brautpaar/${eventId}/allgemein`} className="bp-btn bp-btn-primary bp-btn-sm" style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
            <CalendarHeart size={14} /> Hochzeitsdatum festlegen
          </Link>
        )}
      </div>

    </header>
  )
}

// ── Editorial-Zahlenleiste ──────────────────────────────────────────────────────

function StatFigure({ href, value, countTo, countSuffix, label, sub, bar, delay = 0 }: {
  href: string
  value?: React.ReactNode
  countTo?: number
  countSuffix?: string
  label: string
  sub?: string
  bar?: number
  delay?: number
}) {
  const [barW, setBarW] = useState(0)
  useEffect(() => {
    if (bar === undefined) return
    const id = setTimeout(() => setBarW(Math.min(Math.max(bar, 0), 100)), 250 + delay)
    return () => clearTimeout(id)
  }, [bar, delay])

  return (
    <Link href={href} className="bp-mag-figure bp-reveal" style={{ transitionDelay: `${delay}ms` }}>
      <div className="bp-mag-figure-num bp-num" style={{ fontFamily: SERIF }}>
        {countTo !== undefined
          ? <CountUpNum value={countTo} duration={1000} delay={delay + 150} suffix={countSuffix} />
          : value}
      </div>
      <div className="bp-mag-figure-label">{label}</div>
      {sub && <div className="bp-mag-figure-sub">{sub}</div>}
      {bar !== undefined && (
        <div className="bp-mag-figure-bar">
          <div style={{ width: `${barW}%` }} />
        </div>
      )}
    </Link>
  )
}

// ── "Als Nächstes": Aufgaben ─────────────────────────────────────────────────

function NextTasksCard({ eventId, initialTasks, tasksDone, tasksTotal }: {
  eventId: string
  initialTasks: NextTask[]
  tasksDone: number
  tasksTotal: number
}) {
  const [tasks] = useState(initialTasks)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [doneCount, setDoneCount] = useState(tasksDone)

  async function toggle(task: NextTask) {
    const wasDone = doneIds.has(task.id)
    setDoneIds(prev => {
      const next = new Set(prev)
      if (wasDone) next.delete(task.id); else next.add(task.id)
      return next
    })
    setDoneCount(c => c + (wasDone ? -1 : 1))
    const supabase = createClient()
    await supabase
      .from('brautpaar_tasks')
      .update({ done: !wasDone, done_at: !wasDone ? new Date().toISOString() : null })
      .eq('id', task.id)
  }

  return (
    <div className="bp-card bp-mag-block bp-reveal" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="bp-card-header">
        <span className="bp-mag-block-title" style={{ fontFamily: SERIF }}>Als Nächstes</span>
        {tasksTotal > 0 && <span className="bp-caption">{doneCount} / {tasksTotal} erledigt</span>}
      </div>
      <div className="bp-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {tasks.length === 0 ? (
          <p className="bp-caption" style={{ margin: 0 }}>Keine offenen Aufgaben — ihr seid auf Kurs.</p>
        ) : (
          tasks.map(task => {
            const done = doneIds.has(task.id)
            return (
              <button
                key={task.id}
                onClick={() => toggle(task)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                  border: `1.5px solid ${done ? 'var(--bp-gold)' : 'var(--bp-rule)'}`,
                  background: done ? 'var(--bp-gold)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {done && <Check size={13} color="#fff" strokeWidth={2.5} />}
                </span>
                <span style={{
                  fontSize: '1rem',
                  color: done ? 'var(--bp-ink-3)' : 'var(--bp-ink)',
                  textDecoration: done ? 'line-through' : 'none',
                }}>
                  {task.title}
                </span>
              </button>
            )
          })
        )}
        <Link
          href={`/brautpaar/${eventId}/aufgaben`}
          className="bp-auth-link"
          style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: '0.5rem' }}
        >
          Alle Aufgaben <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}

function GuestStatusCard({ eventId, guestTotal, guestConfirmed, guestDeclined, guestPending, guestNotInvited, guestApprovalPending }: {
  eventId: string
  guestTotal: number
  guestConfirmed: number
  guestDeclined: number
  guestPending: number
  guestNotInvited: number
  guestApprovalPending: number
}) {
  return (
    <div className="bp-card bp-mag-block bp-reveal" style={{ display: 'flex', flexDirection: 'column', transitionDelay: '110ms' }}>
      <div className="bp-card-header">
        <span className="bp-mag-block-title" style={{ fontFamily: SERIF }}>Gäste-Status</span>
        {guestTotal > 0 && <span className="bp-caption">{guestTotal} Gäste</span>}
      </div>
      <div className="bp-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {guestTotal === 0 ? (
          <>
            <p className="bp-caption" style={{ margin: 0 }}>Noch keine Gäste angelegt — startet mit eurer Gästeliste.</p>
            <Link href={`/brautpaar/${eventId}/gaeste`} className="bp-btn bp-btn-primary bp-btn-sm" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              <UserPlus size={14} /> Erste Gäste anlegen
            </Link>
          </>
        ) : (
          <>
            <div className="bp-mag-guest-rows">
              <div><span className="bp-mag-guest-dot" style={{ background: 'var(--bp-gold)' }} />Zugesagt<b>{guestConfirmed}</b></div>
              <div><span className="bp-mag-guest-dot" style={{ background: 'var(--bp-rule-gold)' }} />Ausstehend<b>{guestPending}</b></div>
              <div><span className="bp-mag-guest-dot" style={{ background: 'var(--bp-ink-3)' }} />Abgesagt<b>{guestDeclined}</b></div>
            </div>
            {guestApprovalPending > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="bp-badge bp-badge-gold">{guestApprovalPending}</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--bp-ink-2)' }}>
                  neue Anmeldung{guestApprovalPending !== 1 ? 'en' : ''} warten auf Bestätigung
                </span>
              </div>
            )}
            {guestNotInvited > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={14} style={{ color: 'var(--bp-gold-deep)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', color: 'var(--bp-ink-2)' }}>
                  {guestNotInvited} {guestNotInvited === 1 ? 'Gast' : 'Gäste'} noch nicht eingeladen
                </span>
              </div>
            )}
            {guestApprovalPending === 0 && guestNotInvited === 0 && guestPending === 0 && (
              <p className="bp-caption" style={{ margin: 0 }}>Alle Gäste haben geantwortet.</p>
            )}
          </>
        )}
        {guestTotal > 0 && (
          <Link href={`/brautpaar/${eventId}/gaeste`} className="bp-auth-link" style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: '0.5rem' }}>
            Zur Gästeliste <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Roter Faden: geführter Einstieg ───────────────────────────────────────────

interface SetupStep {
  key: string
  label: string
  todo: string
  cta: string
  href: string
  icon: React.ReactNode
  done: boolean
}

// Geführter Start-Faden. Der "erledigt"-Status jedes Schritts wird aus echten
// Daten abgeleitet (nicht aus einem separaten Flag), damit der Fortschritt nie
// vom tatsächlichen Stand abweicht. Blendet sich aus, sobald alles erledigt ist
// oder das Paar ihn manuell ausblendet (reine UI-Präferenz, pro Gerät).
function RoterFaden({ eventId, steps }: { eventId: string; steps: SetupStep[] }) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    try { setHidden(localStorage.getItem(`forevr_setup_hidden_${eventId}`) === '1') } catch {}
  }, [eventId])

  const doneCount = steps.filter(s => s.done).length
  const total = steps.length
  const allDone = doneCount === total
  const activeKey = steps.find(s => !s.done)?.key ?? null

  if (hidden || allDone) return null

  function dismiss() {
    try { localStorage.setItem(`forevr_setup_hidden_${eventId}`, '1') } catch {}
    setHidden(true)
  }

  const pct = Math.round(doneCount / total * 100)

  return (
    <section data-tour="ov-faden" className="bp-card bp-faden bp-reveal bp-mb-8" aria-label="Erste Schritte">
      <div className="bp-faden-head">
        <div>
          <p className="bp-faden-kicker">Erste Schritte</p>
          <h2 className="bp-faden-title" style={{ fontFamily: SERIF }}>Euer roter Faden</h2>
        </div>
        <div className="bp-faden-progress"><span className="bp-num">{doneCount}</span> / {total}</div>
      </div>

      <div className="bp-faden-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${pct}%` }} />
      </div>

      <ol className="bp-faden-steps">
        {steps.map((step, i) => {
          const isActive = step.key === activeKey
          const stepHref = `/brautpaar/${eventId}/${step.href}`
          const cls = `bp-faden-step${step.done ? ' is-done' : ''}${isActive ? ' is-active' : ''}`
          return (
            <li key={step.key} className={cls}>
              <span className="bp-faden-num" aria-hidden>
                {step.done ? <Check size={15} strokeWidth={2.5} /> : i + 1}
              </span>
              {isActive ? (
                <div className="bp-faden-body">
                  <span className="bp-faden-label">{step.label}</span>
                  <span className="bp-faden-todo">{step.todo}</span>
                  <Link href={stepHref} className="bp-btn bp-btn-primary bp-btn-sm bp-faden-cta">
                    {step.icon} {step.cta}
                  </Link>
                </div>
              ) : (
                <Link href={stepHref} className="bp-faden-row">
                  <span className="bp-faden-label">{step.label}</span>
                  {step.done
                    ? <span className="bp-faden-status">Erledigt</span>
                    : <ArrowRight size={14} className="bp-faden-arrow" />}
                </Link>
              )}
            </li>
          )
        })}
      </ol>

      <button type="button" onClick={dismiss} className="bp-faden-dismiss">
        Einrichtung ausblenden
      </button>
    </section>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function BrautpaarUebersicht({
  eventId, coverImageUrl, monogram = '', eventTitle, eventDate, coupleName, venueName,
  daysLeft, guestTotal, guestConfirmed, guestDeclined, guestPending,
  guestNotInvited, guestApprovalPending,
  budgetPlanned, budgetLimit, budgetItemCount, tasksDone, tasksTotal, nextTasks,
  seatedCount, songCount, timelineCount, cateringConfigured,
}: Props) {
  const answered = guestTotal - guestPending
  const responseRate = guestTotal > 0 ? Math.round(answered / guestTotal * 100) : 0
  const confirmRate = guestTotal > 0 ? Math.round(guestConfirmed / guestTotal * 100) : 0
  const budgetRate = budgetLimit > 0 ? Math.round(budgetPlanned / budgetLimit * 100) : 0
  const taskRate = tasksTotal > 0 ? Math.round(tasksDone / tasksTotal * 100) : 0

  const planning = [
    { key: 'gaeste', label: 'Gäste', icon: <Users size={18} />,
      detail: guestTotal > 0 ? `${guestConfirmed} zugesagt · ${guestDeclined} abgesagt` : 'Gästeliste anlegen und einladen' },
    { key: 'sitzplan', label: 'Sitzplan', icon: <LayoutGrid size={18} />,
      detail: seatedCount > 0 ? `${seatedCount} ${seatedCount === 1 ? 'Platz' : 'Plätze'} vergeben` : 'Tische planen und Gäste platzieren' },
    { key: 'ablaufplan', label: 'Ablaufplan', icon: <Calendar size={18} />, detail: 'Den Tag im Kalender durchplanen' },
    { key: 'catering', label: 'Catering', icon: <UtensilsCrossed size={18} />, detail: 'Menü, Service und Essenswünsche' },
    { key: 'musik', label: 'Musik', icon: <Music size={18} />,
      detail: songCount > 0 ? `${songCount} ${songCount === 1 ? 'Song' : 'Songs'} gesammelt` : 'Wunschlieder und Playlists sammeln' },
    { key: 'dekoration', label: 'Dekoration', icon: <Palette size={18} />, detail: 'Moodboards und Deko-Planung' },
  ]

  // Geführter Start-Faden — Reihenfolge folgt der sinnvollen Planungslogik.
  // Jeder "done"-Status leitet sich aus echten Daten ab, sodass ein Schritt nur
  // dann als erledigt gilt, wenn er tatsächlich abgeschlossen ist.
  const setupSteps: SetupStep[] = [
    { key: 'datum', label: 'Hochzeitsdatum festlegen', href: 'allgemein', icon: <CalendarHeart size={14} />,
      todo: 'Legt euren großen Tag fest — das treibt Countdown und Planung.',
      cta: 'Datum festlegen', done: !!eventDate },
    { key: 'location', label: 'Location festlegen', href: 'allgemein', icon: <MapPin size={14} />,
      todo: 'Tragt den Veranstaltungsort ein, damit alles seinen festen Platz bekommt.',
      cta: 'Location eintragen', done: !!venueName.trim() },
    { key: 'budget', label: 'Budget-Rahmen festlegen', href: 'budget', icon: <Wallet size={14} />,
      todo: 'Steckt euren finanziellen Rahmen ab, bevor ihr ins Detail geht.',
      cta: 'Budget festlegen', done: budgetLimit > 0 },
    { key: 'gaeste', label: 'Gästeliste starten', href: 'gaeste', icon: <UserPlus size={14} />,
      todo: 'Tragt eure ersten Gäste ein — die Basis für Sitzplan und Einladungen.',
      cta: 'Gäste anlegen', done: guestTotal > 0 },
    { key: 'einladen', label: 'Gäste einladen', href: 'gaeste', icon: <Send size={14} />,
      todo: 'Verschickt eure Einladungen und sammelt Zu- und Absagen.',
      cta: 'Zur Gästeliste', done: guestTotal > 0 && guestNotInvited === 0 },
    { key: 'budgetposten', label: 'Budget-Posten anlegen', href: 'budget', icon: <Wallet size={14} />,
      todo: 'Verteilt euer Budget auf konkrete Kostenpunkte wie Location, Catering oder Deko.',
      cta: 'Posten anlegen', done: budgetItemCount > 0 },
    { key: 'ablaufplan', label: 'Ablaufplan erstellen', href: 'ablaufplan', icon: <Calendar size={14} />,
      todo: 'Plant den Tagesablauf im Kalender — von der Trauung bis zur Party.',
      cta: 'Ablauf planen', done: timelineCount > 0 },
    { key: 'catering', label: 'Catering & Menü', href: 'catering', icon: <UtensilsCrossed size={14} />,
      todo: 'Legt Menüart, Service und die Essenswünsche eurer Gäste fest.',
      cta: 'Catering planen', done: cateringConfigured },
    { key: 'sitzplan', label: 'Sitzplan gestalten', href: 'sitzplan', icon: <LayoutGrid size={14} />,
      todo: 'Plant eure Tische und platziert die Gäste per Drag-and-drop.',
      cta: 'Sitzplan öffnen', done: seatedCount > 0 },
  ]

  const rootRef = useReveal<HTMLDivElement>()

  return (
    <div className="bp-page bp-mag" ref={rootRef}>
      <Hero
        eventId={eventId}
        coupleName={coupleName}
        eventTitle={eventTitle}
        eventDate={eventDate}
        venueName={venueName}
        daysLeft={daysLeft}
        coverImageUrl={coverImageUrl}
        monogram={monogram}
      />

      <RoterFaden eventId={eventId} steps={setupSteps} />

      {/* Editorial-Zahlenleiste */}
      <section data-tour="ov-stats" className="bp-mag-stats bp-mb-8">
        <StatFigure
          href={`/brautpaar/${eventId}/gaeste`}
          countTo={guestTotal}
          label="Gäste"
          sub={guestTotal > 0 ? `${guestConfirmed} zugesagt` : 'noch keine'}
          bar={guestTotal > 0 ? confirmRate : undefined}
          delay={0}
        />
        <StatFigure
          href={`/brautpaar/${eventId}/gaeste`}
          countTo={responseRate}
          countSuffix="%"
          label="Rückmeldung"
          sub={`${answered} von ${guestTotal}`}
          bar={guestTotal > 0 ? responseRate : undefined}
          delay={90}
        />
        <StatFigure
          href={`/brautpaar/${eventId}/budget`}
          countTo={budgetLimit > 0 ? budgetRate : undefined}
          countSuffix="%"
          value={budgetLimit > 0 ? undefined : formatCurrency(budgetPlanned)}
          label="Budget verplant"
          sub={budgetLimit > 0 ? `${formatCurrency(budgetPlanned)} von ${formatCurrency(budgetLimit)}` : 'kein Limit gesetzt'}
          bar={budgetLimit > 0 ? budgetRate : undefined}
          delay={180}
        />
        <StatFigure
          href={`/brautpaar/${eventId}/aufgaben`}
          value={<>{tasksDone}<span style={{ fontSize: '0.5em', color: 'var(--bp-ink-3)' }}>/{tasksTotal}</span></>}
          label="Aufgaben"
          sub={`${taskRate}% erledigt`}
          bar={tasksTotal > 0 ? taskRate : undefined}
          delay={270}
        />
      </section>

      {/* Asymmetrischer Magazin-Block */}
      <section className="bp-mag-split bp-mb-8">
        <NextTasksCard eventId={eventId} initialTasks={nextTasks} tasksDone={tasksDone} tasksTotal={tasksTotal} />
        <GuestStatusCard
          eventId={eventId}
          guestTotal={guestTotal}
          guestConfirmed={guestConfirmed}
          guestDeclined={guestDeclined}
          guestPending={guestPending}
          guestNotInvited={guestNotInvited}
          guestApprovalPending={guestApprovalPending}
        />
      </section>

      {/* Eure Planung — Galerie */}
      <section data-tour="ov-modules">
        <div className="bp-mag-section-head bp-reveal">
          <span className="bp-mag-section-rule" />
          <h2 className="bp-mag-section-title" style={{ fontFamily: SERIF }}>Eure Planung</h2>
          <span className="bp-mag-section-rule" />
        </div>
        <div className="bp-mag-gallery">
          {planning.map((mod, i) => (
            <Link key={mod.key} href={`/brautpaar/${eventId}/${mod.key}`} className="bp-card bp-mag-gallery-card bp-reveal" style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="bp-mag-gallery-icon">{mod.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span className="bp-mag-gallery-label" style={{ fontFamily: SERIF }}>{mod.label}</span>
                <span className="bp-mag-gallery-detail">{mod.detail}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
