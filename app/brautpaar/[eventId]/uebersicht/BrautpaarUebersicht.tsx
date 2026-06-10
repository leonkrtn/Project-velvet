'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Users, LayoutGrid, Calendar, UtensilsCrossed, Palette, Music,
  Wallet, CheckSquare, ArrowRight, Square, Check, Send, UserPlus, CalendarHeart,
} from 'lucide-react'

interface NextTask {
  id: string
  title: string
}

interface Props {
  eventId: string
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
  budgetTotal: number
  budgetPaid: number
  tasksDone: number
  tasksTotal: number
  nextTasks: NextTask[]
  seatedCount: number
  songCount: number
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(amount)
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero({ eventId, coupleName, eventTitle, eventDate, venueName, daysLeft }: {
  eventId: string
  coupleName: string
  eventTitle: string
  eventDate: string | null
  venueName: string
  daysLeft: number | null
}) {
  return (
    <div
      className="bp-gold-card bp-mb-6"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1.5rem', flexWrap: 'wrap', padding: '2rem',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p className="bp-label" style={{ marginBottom: '0.625rem' }}>Willkommen zurück</p>
        <h1 style={{
          fontFamily: 'Cormorant Garamond, Georgia, serif', fontWeight: 600,
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1.1,
          color: 'var(--bp-ink)', margin: 0, letterSpacing: '-0.01em',
        }}>
          {coupleName || eventTitle}
        </h1>
        <p className="bp-body" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          {eventDate ? formatDate(eventDate) : null}
          {eventDate && venueName ? ' · ' : null}
          {venueName || null}
          {!eventDate && !venueName && 'Eure Hochzeitsplanung'}
        </p>
        {!eventDate && (
          <Link
            href={`/brautpaar/${eventId}/allgemein`}
            className="bp-btn bp-btn-primary bp-btn-sm"
            style={{ marginTop: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <CalendarHeart size={14} /> Hochzeitsdatum festlegen
          </Link>
        )}
      </div>

      {daysLeft !== null && (
        <div style={{
          textAlign: 'center', paddingLeft: '1.5rem',
          borderLeft: '1px solid var(--bp-rule-gold)', flexShrink: 0,
        }}>
          <div style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif', fontWeight: 600,
            fontSize: '3.25rem', lineHeight: 1, color: 'var(--bp-gold-deep)',
          }}>
            {daysLeft > 0 ? daysLeft : daysLeft === 0 ? '♥' : Math.abs(daysLeft)}
          </div>
          <div className="bp-stat-label" style={{ marginTop: '0.375rem' }}>
            {daysLeft > 0 ? (daysLeft === 1 ? 'Tag bis zur Hochzeit' : 'Tage bis zur Hochzeit')
              : daysLeft === 0 ? 'Heute ist euer großer Tag!'
              : 'Tage seit der Hochzeit'}
          </div>
        </div>
      )}
    </div>
  )
}

// ── "Als Nächstes": Aufgaben + Gäste-Status ─────────────────────────────────

function NextTasksCard({ eventId, initialTasks, tasksDone, tasksTotal }: {
  eventId: string
  initialTasks: NextTask[]
  tasksDone: number
  tasksTotal: number
}) {
  const [tasks, setTasks] = useState(initialTasks)
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
    <div className="bp-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="bp-card-header">
        <span className="bp-section-title" style={{ margin: 0 }}>Als Nächstes</span>
        {tasksTotal > 0 && (
          <span className="bp-caption">{doneCount} / {tasksTotal} erledigt</span>
        )}
      </div>
      <div className="bp-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {tasks.length === 0 ? (
          <p className="bp-caption" style={{ margin: 0 }}>
            Keine offenen Aufgaben — ihr seid auf Kurs.
          </p>
        ) : (
          tasks.map(task => {
            const done = doneIds.has(task.id)
            return (
              <button
                key={task.id}
                onClick={() => toggle(task)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  border: `1.5px solid ${done ? 'var(--bp-gold)' : 'var(--bp-rule)'}`,
                  background: done ? 'var(--bp-gold)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {done && <Check size={12} color="#fff" strokeWidth={2.5} />}
                </span>
                <span style={{
                  fontSize: '0.9375rem',
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
          style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: '0.375rem' }}
        >
          Alle Aufgaben <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}

function GuestStatusCard({ eventId, guestTotal, guestPending, guestNotInvited, guestApprovalPending }: {
  eventId: string
  guestTotal: number
  guestPending: number
  guestNotInvited: number
  guestApprovalPending: number
}) {
  return (
    <div className="bp-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="bp-card-header">
        <span className="bp-section-title" style={{ margin: 0 }}>Gäste-Status</span>
        {guestTotal > 0 && <span className="bp-caption">{guestTotal} Gäste</span>}
      </div>
      <div className="bp-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {guestTotal === 0 ? (
          <>
            <p className="bp-caption" style={{ margin: 0 }}>
              Noch keine Gäste angelegt — startet mit eurer Gästeliste.
            </p>
            <Link
              href={`/brautpaar/${eventId}/gaeste`}
              className="bp-btn bp-btn-primary bp-btn-sm"
              style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <UserPlus size={14} /> Erste Gäste anlegen
            </Link>
          </>
        ) : (
          <>
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
                  {guestNotInvited} {guestNotInvited === 1 ? 'Gast wurde' : 'Gäste wurden'} noch nicht eingeladen
                </span>
              </div>
            )}
            {guestPending > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Square size={14} style={{ color: 'var(--bp-ink-3)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', color: 'var(--bp-ink-2)' }}>
                  {guestPending} {guestPending === 1 ? 'Antwort steht' : 'Antworten stehen'} noch aus
                </span>
              </div>
            )}
            {guestApprovalPending === 0 && guestNotInvited === 0 && guestPending === 0 && (
              <p className="bp-caption" style={{ margin: 0 }}>Alle Gäste haben geantwortet.</p>
            )}
          </>
        )}
        {guestTotal > 0 && (
          <Link
            href={`/brautpaar/${eventId}/gaeste`}
            className="bp-auth-link"
            style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: '0.375rem' }}
          >
            Zur Gästeliste <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Stat-Karten ───────────────────────────────────────────────────────────────

function StatCard({ href, icon, value, label, detail, bar }: {
  href: string
  icon: React.ReactNode
  value: React.ReactNode
  label: string
  detail?: string
  bar?: number // 0..100
}) {
  return (
    <Link href={href} className="bp-stat-card" style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div className="bp-stat-value">{value}</div>
        <span style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'var(--bp-gold-pale)', color: 'var(--bp-gold-deep)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </span>
      </div>
      <div className="bp-stat-label">{label}</div>
      {detail && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>{detail}</div>
      )}
      {bar !== undefined && (
        <div style={{ marginTop: '0.625rem', height: 4, background: 'var(--bp-rule)', borderRadius: 2 }}>
          <div style={{
            height: '100%', width: `${Math.min(Math.max(bar, 0), 100)}%`,
            background: 'var(--bp-gold)', borderRadius: 2, transition: 'width 0.4s',
          }} />
        </div>
      )}
    </Link>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function BrautpaarUebersicht({
  eventId, eventTitle, eventDate, coupleName, venueName,
  daysLeft, guestTotal, guestConfirmed, guestDeclined, guestPending,
  guestNotInvited, guestApprovalPending,
  budgetTotal, budgetPaid, tasksDone, tasksTotal, nextTasks,
  seatedCount, songCount,
}: Props) {
  const answered = guestTotal - guestPending
  const responseRate = guestTotal > 0 ? Math.round(answered / guestTotal * 100) : 0
  const budgetRate = budgetTotal > 0 ? Math.round(budgetPaid / budgetTotal * 100) : 0

  const planning = [
    {
      key: 'gaeste', label: 'Gäste', icon: <Users size={18} />,
      detail: guestTotal > 0 ? `${guestConfirmed} zugesagt · ${guestDeclined} abgesagt` : 'Gästeliste anlegen und einladen',
    },
    {
      key: 'sitzplan', label: 'Sitzplan', icon: <LayoutGrid size={18} />,
      detail: seatedCount > 0 ? `${seatedCount} ${seatedCount === 1 ? 'Platz' : 'Plätze'} vergeben` : 'Tische planen und Gäste platzieren',
    },
    {
      key: 'ablaufplan', label: 'Ablaufplan', icon: <Calendar size={18} />,
      detail: 'Den Tag im Kalender durchplanen',
    },
    {
      key: 'catering', label: 'Catering', icon: <UtensilsCrossed size={18} />,
      detail: 'Menü, Service und Essenswünsche',
    },
    {
      key: 'musik', label: 'Musik', icon: <Music size={18} />,
      detail: songCount > 0 ? `${songCount} ${songCount === 1 ? 'Song' : 'Songs'} gesammelt` : 'Wunschlieder und Playlists sammeln',
    },
    {
      key: 'dekoration', label: 'Dekoration', icon: <Palette size={18} />,
      detail: 'Moodboards und Deko-Planung',
    },
  ]

  return (
    <div className="bp-page">
      <Hero
        eventId={eventId}
        coupleName={coupleName}
        eventTitle={eventTitle}
        eventDate={eventDate}
        venueName={venueName}
        daysLeft={daysLeft}
      />

      {/* Als Nächstes */}
      <div className="bp-grid-2 bp-mb-6" style={{ alignItems: 'stretch' }}>
        <NextTasksCard
          eventId={eventId}
          initialTasks={nextTasks}
          tasksDone={tasksDone}
          tasksTotal={tasksTotal}
        />
        <GuestStatusCard
          eventId={eventId}
          guestTotal={guestTotal}
          guestPending={guestPending}
          guestNotInvited={guestNotInvited}
          guestApprovalPending={guestApprovalPending}
        />
      </div>

      {/* Stats */}
      <div className="bp-grid-4 bp-mb-8">
        <StatCard
          href={`/brautpaar/${eventId}/gaeste`}
          icon={<Users size={15} />}
          value={guestTotal}
          label="Gäste gesamt"
          detail={`${guestConfirmed} zugesagt · ${guestPending} ausstehend`}
        />
        <StatCard
          href={`/brautpaar/${eventId}/budget`}
          icon={<Wallet size={15} />}
          value={formatCurrency(budgetPaid)}
          label="Budget verplant"
          detail={budgetTotal > 0 ? `von ${formatCurrency(budgetTotal)} gesamt` : 'noch kein Budget erfasst'}
          bar={budgetTotal > 0 ? budgetRate : undefined}
        />
        <StatCard
          href={`/brautpaar/${eventId}/aufgaben`}
          icon={<CheckSquare size={15} />}
          value={<>{tasksDone}<span style={{ fontSize: '1.25rem', color: 'var(--bp-ink-3)' }}>/{tasksTotal}</span></>}
          label="Aufgaben erledigt"
          bar={tasksTotal > 0 ? Math.round(tasksDone / tasksTotal * 100) : undefined}
        />
        <StatCard
          href={`/brautpaar/${eventId}/gaeste`}
          icon={<Send size={15} />}
          value={`${responseRate}%`}
          label="Rückmeldequote"
          detail={`${answered} von ${guestTotal} geantwortet`}
          bar={guestTotal > 0 ? responseRate : undefined}
        />
      </div>

      {/* Eure Planung */}
      <div className="bp-mb-4">
        <h2 className="bp-section-title">Eure Planung</h2>
        <div className="bp-grid-3" style={{ gap: '0.75rem' }}>
          {planning.map(mod => (
            <Link
              key={mod.key}
              href={`/brautpaar/${eventId}/${mod.key}`}
              className="bp-card"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                padding: '1rem 1.125rem', textDecoration: 'none',
                transition: 'background var(--bp-transition), box-shadow var(--bp-transition)',
              }}
            >
              <span style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'var(--bp-gold-pale)', color: 'var(--bp-gold-deep)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {mod.icon}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--bp-ink)' }}>
                  {mod.label}
                </span>
                <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--bp-ink-3)', marginTop: 2 }}>
                  {mod.detail}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
