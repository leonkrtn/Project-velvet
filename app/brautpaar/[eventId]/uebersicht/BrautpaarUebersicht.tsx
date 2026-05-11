'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Users, LayoutGrid, Calendar, UtensilsCrossed, Palette, Music, Cake, Camera, Wallet, CheckSquare, Settings } from 'lucide-react'

interface Props {
  eventId: string
  eventTitle: string
  eventDate: string | null
  coupleName: string
  venueName: string
  daysLeft: number | null
  guestTotal: number
  guestConfirmed: number
  guestPending: number
  budgetTotal: number
  budgetPaid: number
  tasksDone: number
  tasksTotal: number
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(amount)
}

export default function BrautpaarUebersicht({
  eventId, eventTitle, eventDate, coupleName, venueName,
  daysLeft, guestTotal, guestConfirmed, guestPending,
  budgetTotal, budgetPaid, tasksDone, tasksTotal,
}: Props) {
  const modules = [
    { key: 'gaeste',      label: 'Gäste',         icon: <Users size={18} /> },
    { key: 'sitzplan',    label: 'Sitzplan',       icon: <LayoutGrid size={18} /> },
    { key: 'ablaufplan',  label: 'Ablaufplan',     icon: <Calendar size={18} /> },
    { key: 'catering',    label: 'Catering',       icon: <UtensilsCrossed size={18} /> },
    { key: 'dekoration',  label: 'Dekoration',     icon: <Palette size={18} /> },
    { key: 'musik',       label: 'Musik',          icon: <Music size={18} /> },
    { key: 'patisserie',  label: 'Patisserie',     icon: <Cake size={18} /> },
    { key: 'medien',      label: 'Medien',         icon: <Camera size={18} /> },
    { key: 'budget',      label: 'Budget',         icon: <Wallet size={18} /> },
    { key: 'aufgaben',    label: 'Aufgaben',       icon: <CheckSquare size={18} /> },
    { key: 'allgemein',   label: 'Allgemein',      icon: <Settings size={18} /> },
  ]

  return (
    <div className="bp-page">
      {/* Header */}
      <div className="bp-page-header">
        <p className="bp-label" style={{ marginBottom: '0.5rem' }}>Willkommen zurück</p>
        <h1 className="bp-page-title">{coupleName || eventTitle}</h1>
        {venueName && (
          <p className="bp-page-subtitle">{venueName}</p>
        )}
      </div>

      {/* Countdown */}
      {daysLeft !== null && (
        <div className="bp-gold-card bp-mb-8" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <div className="bp-stat-value" style={{ fontSize: '3rem', color: 'var(--bp-gold-deep)' }}>
              {daysLeft > 0 ? daysLeft : 0}
            </div>
            <div className="bp-stat-label">
              {daysLeft > 0 ? 'Tage bis zur Hochzeit' : daysLeft === 0 ? 'Heute ist euer großer Tag!' : 'Tage seit der Hochzeit'}
            </div>
          </div>
          {eventDate && (
            <div style={{ borderLeft: '1px solid var(--bp-rule-gold)', paddingLeft: '1.5rem' }}>
              <div className="bp-label" style={{ marginBottom: '0.25rem' }}>Datum</div>
              <div className="bp-body" style={{ color: 'var(--bp-ink)', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.125rem' }}>
                {formatDate(eventDate)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="bp-grid-4 bp-mb-8">
        <div className="bp-stat-card">
          <div className="bp-stat-value">{guestTotal}</div>
          <div className="bp-stat-label">Gäste gesamt</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>
            {guestConfirmed} zugesagt · {guestPending} ausstehend
          </div>
        </div>

        <div className="bp-stat-card">
          <div className="bp-stat-value" style={{ color: 'var(--bp-gold-deep)' }}>
            {formatCurrency(budgetPaid)}
          </div>
          <div className="bp-stat-label">Budget verplant</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>
            von {formatCurrency(budgetTotal)} gesamt
          </div>
        </div>

        <div className="bp-stat-card">
          <div className="bp-stat-value">{tasksDone}<span style={{ fontSize: '1.25rem', color: 'var(--bp-ink-3)' }}>/{tasksTotal}</span></div>
          <div className="bp-stat-label">Aufgaben erledigt</div>
          {tasksTotal > 0 && (
            <div style={{ marginTop: '0.625rem', height: 4, background: 'var(--bp-rule)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${Math.round(tasksDone / tasksTotal * 100)}%`, background: 'var(--bp-gold)', borderRadius: 2, transition: 'width 0.4s' }} />
            </div>
          )}
        </div>

        <div className="bp-stat-card">
          <div className="bp-stat-value">{guestConfirmed > 0 ? Math.round(guestConfirmed / Math.max(guestTotal, 1) * 100) : 0}%</div>
          <div className="bp-stat-label">Rückmeldequote</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--bp-ink-3)' }}>
            {guestTotal - guestPending} von {guestTotal} geantwortet
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div className="bp-mb-4">
        <h2 className="bp-section-title">Module</h2>
        <div className="bp-grid-3" style={{ gap: '0.75rem' }}>
          {modules.map(mod => (
            <Link
              key={mod.key}
              href={`/brautpaar/${eventId}/${mod.key}`}
              className="bp-card"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.875rem',
                padding: '1rem 1.125rem', textDecoration: 'none',
                color: 'var(--bp-ink-2)',
                transition: 'background var(--bp-transition), box-shadow var(--bp-transition)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bp-ivory)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = ''
              }}
            >
              <span style={{ color: 'var(--bp-gold)', flexShrink: 0 }}>{mod.icon}</span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{mod.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
