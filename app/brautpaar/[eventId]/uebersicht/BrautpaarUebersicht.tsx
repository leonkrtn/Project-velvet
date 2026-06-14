'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Users, LayoutGrid, Calendar, UtensilsCrossed, Palette, Music,
  ArrowRight, Check, Send, UserPlus, CalendarHeart,
  ImagePlus, Loader2,
} from 'lucide-react'

interface NextTask {
  id: string
  title: string
}

interface Props {
  eventId: string
  coverImageUrl: string | null
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
  tasksDone: number
  tasksTotal: number
  nextTasks: NextTask[]
  seatedCount: number
  songCount: number
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

// ── Hero / Cover ───────────────────────────────────────────────────────────────

function Hero({ eventId, coupleName, eventTitle, eventDate, venueName, daysLeft, coverImageUrl }: {
  eventId: string
  coupleName: string
  eventTitle: string
  eventDate: string | null
  venueName: string
  daysLeft: number | null
  coverImageUrl: string | null
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Bitte ein Bild auswählen.'); return }
    setError(null)
    setUploading(true)
    try {
      const reqRes = await fetch(`/api/events/${eventId}/cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      })
      if (!reqRes.ok) throw new Error('upload-url')
      const { uploadUrl, key } = await reqRes.json() as { uploadUrl: string; key: string }

      const putRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!putRes.ok) throw new Error('put')

      const saveRes = await fetch(`/api/events/${eventId}/cover`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_image_r2_key: key }),
      })
      if (!saveRes.ok) throw new Error('save')
      router.refresh()
    } catch {
      setError('Titelbild konnte nicht hochgeladen werden.')
    } finally {
      setUploading(false)
    }
  }

  const heading = coupleName || eventTitle || 'Eure Hochzeit'
  const hasPhoto = !!coverImageUrl

  return (
    <header className={`bp-mag-hero ${hasPhoto ? 'has-photo' : ''} bp-mb-8`}>
      {hasPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl} alt="" className="bp-mag-hero-photo" />
      )}
      <div className="bp-mag-hero-veil" />

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      <button
        type="button"
        className="bp-mag-hero-cover-btn"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title={hasPhoto ? 'Titelbild ändern' : 'Titelbild hinzufügen'}
      >
        {uploading ? <Loader2 size={14} className="bp-spin" /> : <ImagePlus size={14} />}
        <span>{hasPhoto ? 'Titelbild ändern' : 'Titelbild'}</span>
      </button>

      <div className="bp-mag-hero-inner">
        <p className="bp-mag-kicker">FOREVR · Hochzeitsjournal</p>

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
            <div className="bp-mag-countdown-num" style={{ fontFamily: SERIF }}>
              {daysLeft > 0 ? daysLeft : daysLeft === 0 ? '♥' : Math.abs(daysLeft)}
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

      {error && <p className="bp-mag-hero-error">{error}</p>}
    </header>
  )
}

// ── Editorial-Zahlenleiste ──────────────────────────────────────────────────────

function StatFigure({ href, value, label, sub, bar }: {
  href: string
  value: React.ReactNode
  label: string
  sub?: string
  bar?: number
}) {
  return (
    <Link href={href} className="bp-mag-figure">
      <div className="bp-mag-figure-num" style={{ fontFamily: SERIF }}>{value}</div>
      <div className="bp-mag-figure-label">{label}</div>
      {sub && <div className="bp-mag-figure-sub">{sub}</div>}
      {bar !== undefined && (
        <div className="bp-mag-figure-bar">
          <div style={{ width: `${Math.min(Math.max(bar, 0), 100)}%` }} />
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
    <div className="bp-card bp-mag-block" style={{ display: 'flex', flexDirection: 'column' }}>
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
    <div className="bp-card bp-mag-block" style={{ display: 'flex', flexDirection: 'column' }}>
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

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function BrautpaarUebersicht({
  eventId, coverImageUrl, eventTitle, eventDate, coupleName, venueName,
  daysLeft, guestTotal, guestConfirmed, guestDeclined, guestPending,
  guestNotInvited, guestApprovalPending,
  budgetPlanned, budgetLimit, tasksDone, tasksTotal, nextTasks,
  seatedCount, songCount,
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

  return (
    <div className="bp-page bp-mag">
      <Hero
        eventId={eventId}
        coupleName={coupleName}
        eventTitle={eventTitle}
        eventDate={eventDate}
        venueName={venueName}
        daysLeft={daysLeft}
        coverImageUrl={coverImageUrl}
      />

      {/* Editorial-Zahlenleiste */}
      <section className="bp-mag-stats bp-mb-8">
        <StatFigure
          href={`/brautpaar/${eventId}/gaeste`}
          value={guestTotal}
          label="Gäste"
          sub={guestTotal > 0 ? `${guestConfirmed} zugesagt` : 'noch keine'}
          bar={guestTotal > 0 ? confirmRate : undefined}
        />
        <StatFigure
          href={`/brautpaar/${eventId}/gaeste`}
          value={`${responseRate}%`}
          label="Rückmeldung"
          sub={`${answered} von ${guestTotal}`}
          bar={guestTotal > 0 ? responseRate : undefined}
        />
        <StatFigure
          href={`/brautpaar/${eventId}/budget`}
          value={budgetLimit > 0 ? `${budgetRate}%` : formatCurrency(budgetPlanned)}
          label="Budget verplant"
          sub={budgetLimit > 0 ? `${formatCurrency(budgetPlanned)} von ${formatCurrency(budgetLimit)}` : 'kein Limit gesetzt'}
          bar={budgetLimit > 0 ? budgetRate : undefined}
        />
        <StatFigure
          href={`/brautpaar/${eventId}/aufgaben`}
          value={<>{tasksDone}<span style={{ fontSize: '0.5em', color: 'var(--bp-ink-3)' }}>/{tasksTotal}</span></>}
          label="Aufgaben"
          sub={`${taskRate}% erledigt`}
          bar={tasksTotal > 0 ? taskRate : undefined}
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
      <section>
        <div className="bp-mag-section-head">
          <span className="bp-mag-section-rule" />
          <h2 className="bp-mag-section-title" style={{ fontFamily: SERIF }}>Eure Planung</h2>
          <span className="bp-mag-section-rule" />
        </div>
        <div className="bp-mag-gallery">
          {planning.map(mod => (
            <Link key={mod.key} href={`/brautpaar/${eventId}/${mod.key}`} className="bp-card bp-mag-gallery-card">
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
