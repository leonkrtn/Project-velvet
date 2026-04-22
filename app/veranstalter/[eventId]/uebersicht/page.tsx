import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Mail, Calendar, Phone } from 'lucide-react'
import OrganizerTodoList from './OrganizerTodoList'

interface Props {
  params: Promise<{ eventId: string }>
}

type Projektphase = 'Planung' | 'Finalisierung' | 'Durchführung' | 'Nachbereitung'

const PHASE_COLORS: Record<Projektphase, { bg: string; color: string; border: string }> = {
  'Planung':        { bg: '#EEF2FF', color: '#4F46E5', border: '#C7D2FE' },
  'Finalisierung':  { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  'Durchführung':   { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  'Nachbereitung':  { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

// ── Waterfall Chart ────────────────────────────────────────────────────────

interface WaterfallBar {
  label: string
  value: number
  type: 'positive' | 'negative' | 'result'
}

function MarginWaterfall({ einnahmen, veranstalterkosten, mitarbeiterkosten }: {
  einnahmen: number
  veranstalterkosten: number
  mitarbeiterkosten: number
}) {
  const marge = einnahmen - veranstalterkosten - mitarbeiterkosten
  const margePercent = einnahmen > 0 ? Math.round((marge / einnahmen) * 100) : 0

  const bars: WaterfallBar[] = [
    { label: 'Einnahmen',          value: einnahmen,          type: 'positive' },
    { label: 'Veranstalterkosten', value: veranstalterkosten, type: 'negative' },
    { label: 'Mitarbeiterkosten',  value: mitarbeiterkosten,  type: 'negative' },
    { label: 'Marge',              value: marge,              type: 'result'   },
  ]

  // SVG dimensions
  const W = 480
  const H = 240
  const padL = 10
  const padR = 10
  const padT = 30
  const padB = 50
  const chartH = H - padT - padB
  const chartW = W - padL - padR
  const barW = 72
  const gap = (chartW - bars.length * barW) / (bars.length + 1)

  // Scale: based on einnahmen as reference (max positive value)
  const refVal = Math.max(einnahmen, 1)
  function px(val: number) { return Math.abs(val) / refVal * chartH }

  const baseline = padT + chartH // y-coordinate of the zero line

  // Calculate bar positions (waterfall logic)
  type BarRect = { x: number; y: number; h: number; color: string; value: number; label: string; labelY: number }
  const rects: BarRect[] = []
  let runningTop = baseline // tracks where the "top" of remaining value is

  const COLOR_POS    = '#34C759'
  const COLOR_NEG    = '#FF3B30'
  const COLOR_RESULT_POS = '#007AFF'
  const COLOR_RESULT_NEG = '#FF3B30'

  bars.forEach((bar, i) => {
    const x = padL + gap + i * (barW + gap)

    if (bar.type === 'positive') {
      const h = Math.max(px(bar.value), 1)
      const y = baseline - h
      rects.push({ x, y, h, color: COLOR_POS, value: bar.value, label: bar.label, labelY: y - 8 })
      runningTop = y // top of this bar = starting point for next negative bar
    } else if (bar.type === 'negative') {
      const h = Math.max(px(bar.value), 1)
      const y = runningTop
      rects.push({ x, y, h, color: COLOR_NEG, value: bar.value, label: bar.label, labelY: y - 8 })
      runningTop = y + h // move down by this amount
    } else {
      // result bar: bottom-anchored
      const absH = Math.max(px(Math.abs(bar.value)), 1)
      const isNeg = bar.value < 0
      const y = isNeg ? baseline : baseline - absH
      const color = isNeg ? COLOR_RESULT_NEG : COLOR_RESULT_POS
      rects.push({ x, y, h: absH, color, value: bar.value, label: bar.label, labelY: isNeg ? baseline + 8 : y - 8 })
    }
  })

  // Connector lines between bars (dashed, at runningTop transitions)
  const connectors: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  for (let i = 0; i < rects.length - 1; i++) {
    const cur = rects[i]
    const next = rects[i + 1]
    const connectY = cur.type === 'positive' ? cur.y : cur.y + cur.h
    // Use the bottom of current bar for negative, top for positive
    const actualY = bars[i].type === 'positive'
      ? cur.y               // top of positive bar = where negative starts
      : cur.y + cur.h       // bottom of negative bar = where next starts
    connectors.push({ x1: cur.x + barW, y1: actualY, x2: next.x, y2: actualY })
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Veranstalter-Marge</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Einnahmen abzüglich aller Kosten</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: marge >= 0 ? '#007AFF' : '#FF3B30', letterSpacing: '-0.5px' }}>
            {fmtMoney(marge)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {margePercent}% Marge
          </div>
        </div>
      </div>

      {einnahmen === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          Kein Honorar hinterlegt — Marge kann nicht berechnet werden.
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 8 }}>
          {/* Baseline */}
          <line x1={padL} y1={baseline} x2={W - padR} y2={baseline} stroke="var(--border)" strokeWidth={1} />

          {/* Connector lines (dashed) */}
          {connectors.map((c, i) => (
            <line
              key={i}
              x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y1}
              stroke="#CBD5E1"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ))}

          {/* Bars */}
          {rects.map((r, i) => (
            <g key={i}>
              <rect
                x={r.x} y={r.y}
                width={barW} height={r.h}
                fill={r.color}
                rx={4}
                opacity={bars[i].type === 'result' ? 1 : 0.85}
              />
              {/* Value label above bar */}
              <text
                x={r.x + barW / 2}
                y={bars[i].type === 'negative' ? r.y - 6 : r.labelY}
                textAnchor="middle"
                style={{ fontSize: 11, fontWeight: 700, fill: r.color }}
              >
                {bars[i].type === 'negative' ? '−' : ''}{fmtMoney(Math.abs(r.value))}
              </text>
              {/* Category label below baseline */}
              <text
                x={r.x + barW / 2}
                y={baseline + 16}
                textAnchor="middle"
                style={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              >
                {r.label}
              </text>
            </g>
          ))}
        </svg>
      )}

      {/* Legend row */}
      {einnahmen > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <LegendItem color={COLOR_POS} label={`Einnahmen ${fmtMoney(einnahmen)}`} />
          <LegendItem color={COLOR_NEG} label={`Veranstalterkosten ${fmtMoney(veranstalterkosten)}`} />
          <LegendItem color={COLOR_NEG} label={`Mitarbeiterkosten ${fmtMoney(mitarbeiterkosten)}`} />
          <LegendItem color={marge >= 0 ? COLOR_RESULT_POS : COLOR_RESULT_NEG} label={`Marge ${fmtMoney(marge)}`} />
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
      {label}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function UebersichtPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    eventRes,
    membersRes,
    contactMembersRes,
    inviteCodesRes,
    guestsRes,
    vendorsRes,
    budgetItemsRes,
    todosRes,
    organizerCostsRes,
    staffRes,
    daysRes,
  ] = await Promise.all([
    supabase.from('events').select('id, title, date, budget_total, projektphase, organizer_fee').eq('id', eventId).single(),
    supabase.from('event_members').select('id, role').eq('event_id', eventId),
    supabase.from('event_members').select('id, role, profiles!user_id(id, name, email, phone)').eq('event_id', eventId).in('role', ['brautpaar', 'trauzeuge']),
    supabase.from('invite_codes').select('id, status').eq('event_id', eventId).eq('status', 'offen'),
    supabase.from('guests').select('id, status').eq('event_id', eventId),
    supabase.from('vendors').select('id, name, status, price, category').eq('event_id', eventId),
    supabase.from('budget_items').select('id, planned, actual, payment_status').eq('event_id', eventId),
    supabase.from('organizer_todos').select('id, title, done').eq('event_id', eventId).eq('organizer_id', user.id).order('created_at'),
    supabase.from('event_organizer_costs').select('amount').eq('event_id', eventId),
    supabase.from('organizer_staff').select('id, hourly_rate').eq('organizer_id', user.id),
    supabase.from('personalplanung_days').select('id').eq('event_id', eventId),
  ])

  const event = eventRes.data
  if (!event) redirect('/veranstalter')

  const members = membersRes.data ?? []
  const openInvites = inviteCodesRes.data?.length ?? 0
  const guests = guestsRes.data ?? []
  const vendors = vendorsRes.data ?? []
  const budgetItems = budgetItemsRes.data ?? []
  const organizerTodos = todosRes.data ?? []

  const contactMembers = (contactMembersRes.data ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))
  const brautpaar = contactMembers.filter(m => m.role === 'brautpaar')
  const trauzeugen = contactMembers.filter(m => m.role === 'trauzeuge')

  // Margin calculation
  const einnahmen = event.organizer_fee ?? 0
  const veranstalterkosten = (organizerCostsRes.data ?? []).reduce((s, c) => s + (c.amount ?? 0), 0)

  // Staff costs: need shifts for this event's days
  const dayIds = (daysRes.data ?? []).map(d => d.id)
  let mitarbeiterkosten = 0
  if (dayIds.length > 0 && (staffRes.data ?? []).length > 0) {
    const staffMap = Object.fromEntries((staffRes.data ?? []).map(s => [s.id, s.hourly_rate ?? 0]))
    const { data: shifts } = await supabase
      .from('personalplanung_shifts')
      .select('staff_id, start_hour, end_hour')
      .in('day_id', dayIds)
    for (const shift of shifts ?? []) {
      const hours = (shift.end_hour ?? 0) - (shift.start_hour ?? 0)
      mitarbeiterkosten += Math.max(0, hours) * (staffMap[shift.staff_id] ?? 0)
    }
  }

  // Event stats
  const daysLeft = daysUntil(event.date)
  const guestsTotal = guests.length
  const guestsConfirmed = guests.filter(g => g.status === 'zugesagt').length
  const guestsDeclined = guests.filter(g => g.status === 'abgesagt').length
  const budgetTotal = event.budget_total ?? 0
  const totalSpent = budgetItems.reduce((s, b) => s + (b.actual ?? 0), 0)
  const budgetPercent = budgetTotal > 0 ? Math.min(100, (totalSpent / budgetTotal) * 100) : 0
  const confirmedVendors = vendors.filter(v => v.status === 'bestaetigt').length

  const phase = (event.projektphase as Projektphase | null) ?? 'Planung'
  const phaseStyle = PHASE_COLORS[phase]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>Übersicht</h1>
        <Link href={`/veranstalter/${eventId}/allgemein`} title="Projektphase bearbeiten" style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: phaseStyle.bg, color: phaseStyle.color, border: `1px solid ${phaseStyle.border}`, textDecoration: 'none' }}>
          {phase}
        </Link>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>Alle wichtigen Kennzahlen auf einen Blick</p>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KpiCard icon={<Users size={20} color="var(--text-primary)" />} label="Mitglieder" value={members.length.toString()} sub={`${members.filter(m => m.role === 'brautpaar').length} BP · ${members.filter(m => m.role === 'trauzeuge').length} TZ · ${members.filter(m => m.role === 'dienstleister').length} DL`} href={`/veranstalter/${eventId}/mitglieder`} />
        <KpiCard icon={<Mail size={20} color="var(--text-primary)" />} label="Offene Einladungen" value={openInvites.toString()} sub="Noch nicht eingelöst" href={`/veranstalter/${eventId}/mitglieder`} />
        <KpiCard icon={<Calendar size={20} color="var(--text-primary)" />} label="Tage bis Event" value={daysLeft != null ? daysLeft.toString() : '—'} sub={event.date ? new Date(event.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Kein Datum gesetzt'} href={`/veranstalter/${eventId}/allgemein`} />
      </div>

      {/* Event Card + Kontakt-Schnellzugriff */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, marginBottom: 24 }}>

        {/* Event Card */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Event</span>
            <Link href={`/veranstalter/${eventId}/allgemein`} style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none', padding: '4px 8px', borderRadius: 6 }}>Bearbeiten →</Link>
          </div>
          <div style={{ padding: '6px 0 8px' }}>
            <SectionItem label="Gäste gesamt" value={guestsTotal.toString()} />
            <SectionItem label="Zusagen" value={guestsConfirmed.toString()} accent="green" />
            <SectionItem label="Absagen" value={guestsDeclined.toString()} accent="red" />
          </div>
          <div style={{ padding: '13px 22px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>Budget Brautpaar</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtMoney(budgetTotal)}</span>
            </div>
            <div style={{ height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${budgetPercent}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtMoney(totalSpent)} ausgegeben · {budgetPercent.toFixed(0)}%</div>
          </div>
          <div style={{ padding: '6px 0 8px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <Link href={`/veranstalter/${eventId}/mitglieder`} style={{ textDecoration: 'none', display: 'block' }}>
              <SectionItem label="Bestätigte Dienstleister" value={confirmedVendors.toString()} clickable />
            </Link>
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.015)' }}>
            <Link href={`/veranstalter/${eventId}/vorschlaege`} style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', display: 'inline-block' }}>
              Vorschläge verwalten
            </Link>
          </div>
        </div>

        {/* Kontakt-Schnellzugriff */}
        {(brautpaar.length > 0 || trauzeugen.length > 0) && (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Wichtige Kontakte</span>
            </div>
            {brautpaar.length > 0 && (
              <div style={{ padding: '14px 22px', borderBottom: trauzeugen.length > 0 ? '1px solid var(--border)' : undefined }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Brautpaar</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {brautpaar.map(m => <ContactRow key={m.id} profile={m.profiles} />)}
                </div>
              </div>
            )}
            {trauzeugen.length > 0 && (
              <div style={{ padding: '14px 22px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Trauzeugen</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {trauzeugen.map(m => <ContactRow key={m.id} profile={m.profiles} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Waterfall Marge */}
      <div style={{ marginBottom: 24 }}>
        <MarginWaterfall
          einnahmen={einnahmen}
          veranstalterkosten={veranstalterkosten}
          mitarbeiterkosten={mitarbeiterkosten}
        />
      </div>

      {/* Organizer To-Do Liste */}
      <OrganizerTodoList eventId={eventId} organizerId={user.id} initialTodos={organizerTodos} />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, href }: { icon: React.ReactNode; label: string; value: string; sub: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '22px 24px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
        <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1.5px', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>{sub}</div>
      </div>
    </Link>
  )
}

function SectionItem({ label, value, accent, clickable }: { label: string; value: string; accent?: 'green' | 'red'; clickable?: boolean }) {
  const color = accent === 'green' ? '#34C759' : accent === 'red' ? '#FF3B30' : 'var(--text-primary)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 22px', borderTop: '1px solid rgba(0,0,0,0.05)', cursor: clickable ? 'pointer' : undefined }}>
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
        {label}{clickable && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>→</span>}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color, letterSpacing: '-0.3px' }}>{value}</span>
    </div>
  )
}

function ContactRow({ profile }: { profile: { name: string; email: string; phone?: string | null } | null }) {
  if (!profile) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{profile.name}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {profile.phone && (
          <a href={`tel:${profile.phone}`} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Phone size={12} color="var(--text-tertiary)" />{profile.phone}
          </a>
        )}
        <a href={`mailto:${profile.email}`} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Mail size={12} color="var(--text-tertiary)" />{profile.email}
        </a>
      </div>
    </div>
  )
}
