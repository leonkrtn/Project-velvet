import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Mail, Calendar, Phone } from 'lucide-react'
import OrganizerTodoList from './OrganizerTodoList'

interface BudgetLineItem {
  id: string
  description: string | null
  category: string | null
  planned: number
  actual: number
  payment_status: string
}

interface CateringCostItem {
  id: string
  category: string | null
  price_per_person: number
}

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

// ── Margin Table ───────────────────────────────────────────────────────────

function MarginWaterfall({ einnahmen, veranstalterkosten, mitarbeiterkosten }: {
  einnahmen: number
  veranstalterkosten: number
  mitarbeiterkosten: number
}) {
  const marge = einnahmen - veranstalterkosten - mitarbeiterkosten
  const margePercent = einnahmen > 0 ? Math.round((marge / einnahmen) * 100) : 0

  const rows = [
    { label: 'Honorar (Einnahmen)', value: einnahmen,          sign: '+', color: 'var(--text-primary)' },
    { label: 'Veranstalterkosten',  value: veranstalterkosten, sign: '−', color: '#FF3B30' },
    { label: 'Mitarbeiterkosten',   value: mitarbeiterkosten,  sign: '−', color: '#FF3B30' },
  ]

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Veranstalter-Marge</span>
        {einnahmen > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{margePercent}% Marge</span>
        )}
      </div>

      {einnahmen === 0 ? (
        <div style={{ padding: '20px 22px', fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          Kein Honorar hinterlegt — Marge kann nicht berechnet werden.
        </div>
      ) : (
        <>
          {rows.map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 22px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: r.color }}>
                {r.sign} {fmtMoney(r.value)}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 22px', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Marge</span>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', color: marge >= 0 ? '#15803D' : '#FF3B30' }}>
              {fmtMoney(marge)}
            </span>
          </div>
        </>
      )}
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
    dlContactMembersRes,
    inviteCodesRes,
    guestsRes,
    vendorsRes,
    budgetItemsRes,
    todosRes,
    organizerCostsRes,
    cateringCostsRes,
    cateringPlanRes,
    staffRes,
    daysRes,
  ] = await Promise.all([
    supabase.from('events').select('id, title, date, budget_total, projektphase, organizer_fee').eq('id', eventId).single(),
    supabase.from('event_members').select('id, role').eq('event_id', eventId),
    supabase.from('event_members').select('id, role, profiles!user_id(id, name, email, phone)').eq('event_id', eventId).eq('role', 'brautpaar'),
    supabase.from('event_members').select('id, user_id, role, profiles!user_id(id, name, email, phone)').eq('event_id', eventId).eq('role', 'dienstleister').eq('show_in_contacts', true),
    supabase.from('invite_codes').select('id, status').eq('event_id', eventId).eq('status', 'offen'),
    supabase.from('guests').select('id, status').eq('event_id', eventId),
    supabase.from('vendors').select('id, name, status, price, category').eq('event_id', eventId),
    supabase.from('budget_items').select('id, description, category, planned, actual, payment_status').eq('event_id', eventId).order('created_at', { ascending: true }),
    supabase.from('organizer_todos').select('id, title, done').eq('event_id', eventId).eq('organizer_id', user.id).order('created_at'),
    supabase.from('event_organizer_costs').select('amount').eq('event_id', eventId),
    supabase.from('event_organizer_costs').select('id, category, price_per_person').eq('event_id', eventId).eq('source', 'catering').order('created_at', { ascending: true }),
    supabase.from('catering_plans').select('plan_guest_count_enabled, plan_guest_count').eq('event_id', eventId).single(),
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
  const budgetLineItems = (budgetItemsRes.data ?? []) as BudgetLineItem[]

  const contactMembers = (contactMembersRes.data ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))
  const brautpaar = contactMembers.filter(m => m.role === 'brautpaar')
  const dlContacts = (dlContactMembersRes.data ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles,
  }))

  // Margin calculation
  const einnahmen = event.organizer_fee ?? 0
  const veranstalterkosten = (organizerCostsRes.data ?? []).reduce((s, c) => s + parseFloat(String(c.amount ?? 0)), 0)

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
  const cateringCosts = (cateringCostsRes.data ?? []) as CateringCostItem[]
  const cateringPlan = cateringPlanRes.data
  const effectiveGuestCount = cateringPlan?.plan_guest_count_enabled && (cateringPlan.plan_guest_count ?? 0) > 0
    ? cateringPlan.plan_guest_count
    : guestsConfirmed
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
        <KpiCard icon={<Users size={20} color="var(--text-primary)" />} label="Beteiligte" value={members.length.toString()} sub={`${members.filter(m => m.role === 'brautpaar').length} BP · ${members.filter(m => m.role === 'dienstleister').length} DL`} href={`/veranstalter/${eventId}/mitglieder`} />
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
        </div>

        {/* Kontakt-Schnellzugriff */}
        {(brautpaar.length > 0 || dlContacts.length > 0) && (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Wichtige Kontakte</span>
            </div>
            {brautpaar.length > 0 && (
              <div style={{ padding: '14px 22px', borderBottom: dlContacts.length > 0 ? '1px solid var(--border)' : undefined }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Brautpaar</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {brautpaar.map(m => <ContactRow key={m.id} profile={m.profiles} />)}
                </div>
              </div>
            )}
            {dlContacts.length > 0 && (
              <div style={{ padding: '14px 22px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Dienstleister</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {dlContacts.map(m => <ContactRow key={m.id} profile={m.profiles} />)}
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

      {/* Kostenübersicht */}
      <div style={{ marginBottom: 24 }}>
        <KostenübersichtCard
          eventId={eventId}
          organizerFee={event.organizer_fee ?? 0}
          budgetItems={budgetLineItems}
          cateringCosts={cateringCosts}
          effectiveGuestCount={effectiveGuestCount}
        />
      </div>

      {/* Organizer To-Do Liste */}
      <OrganizerTodoList eventId={eventId} organizerId={user.id} initialTodos={organizerTodos} />
    </div>
  )
}

// ── Kostenübersicht ────────────────────────────────────────────────────────

type PaymentStatus = 'offen' | 'angezahlt' | 'bezahlt'

const STATUS_COLOR: Record<PaymentStatus, string> = {
  offen:      'var(--text-tertiary)',
  angezahlt:  '#C2410C',
  bezahlt:    '#15803D',
}

function KostenübersichtCard({ eventId, organizerFee, budgetItems, cateringCosts, effectiveGuestCount }: {
  eventId: string
  organizerFee: number
  budgetItems: BudgetLineItem[]
  cateringCosts: CateringCostItem[]
  effectiveGuestCount: number
}) {
  const cateringTotal = cateringCosts.reduce((s, c) => s + (Number(c.price_per_person) || 0), 0) * effectiveGuestCount
  const nonCateringItems = budgetItems.filter(i => i.category?.toLowerCase() !== 'catering')
  const plannedTotal = nonCateringItems.reduce((s, i) => s + (Number(i.planned) || 0), 0)
  const actualTotal  = nonCateringItems.reduce((s, i) => s + (Number(i.actual)  || 0), 0)
  const grandPlanned = plannedTotal + (organizerFee > 0 ? organizerFee : 0) + cateringTotal
  const grandActual  = actualTotal
  const hasItems = budgetItems.length > 0 || cateringCosts.length > 0 || organizerFee > 0

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Kostenübersicht (Brautpaar)</span>
      </div>

      {!hasItems ? (
        <div style={{ padding: '20px 22px', fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          Noch keine Kostenpositionen angelegt.
        </div>
      ) : (
        <>
          {/* Spaltenköpfe */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '8px 22px 6px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Position</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'right', minWidth: 90 }}>Geplant</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'right', minWidth: 90 }}>Tatsächlich</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', textAlign: 'right', minWidth: 80 }}>Status</span>
          </div>

          {/* Veranstalter-Honorar */}
          {organizerFee > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '11px 22px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>Veranstalter-Honorar</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Honorar</div>
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', minWidth: 90 }}>{fmtMoney(organizerFee)}</span>
              <span style={{ fontSize: 13.5, color: 'var(--text-tertiary)', textAlign: 'right', minWidth: 90 }}>—</span>
              <span style={{ minWidth: 80 }} />
            </div>
          )}

          {/* Catering */}
          {cateringCosts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '11px 22px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>Catering</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  {cateringCosts.length} Posten · {effectiveGuestCount} Gäste
                </div>
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', minWidth: 90 }}>{fmtMoney(cateringTotal)}</span>
              <span style={{ fontSize: 13.5, color: 'var(--text-tertiary)', textAlign: 'right', minWidth: 90 }}>—</span>
              <span style={{ minWidth: 80 }} />
            </div>
          )}

          {/* Budget-Positionen */}
          {nonCateringItems.map(item => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '11px 22px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{item.description || '—'}</div>
                {item.category && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{item.category}</div>}
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', minWidth: 90 }}>{fmtMoney(item.planned)}</span>
              <span style={{ fontSize: 13.5, color: item.actual > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', textAlign: 'right', minWidth: 90 }}>
                {item.actual > 0 ? fmtMoney(item.actual) : '—'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: STATUS_COLOR[item.payment_status as PaymentStatus] ?? 'var(--text-tertiary)', textAlign: 'right', minWidth: 80 }}>
                {{ offen: 'Offen', angezahlt: 'Angezahlt', bezahlt: 'Bezahlt' }[item.payment_status] ?? item.payment_status}
              </span>
            </div>
          ))}

          {/* Summe */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '13px 22px', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Gesamt geplant</span>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)', textAlign: 'right', minWidth: 90 }}>{fmtMoney(grandPlanned)}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: grandActual > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', textAlign: 'right', minWidth: 90 }}>
              {grandActual > 0 ? fmtMoney(grandActual) : '—'}
            </span>
            <span style={{ minWidth: 80 }} />
          </div>
        </>
      )}
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
