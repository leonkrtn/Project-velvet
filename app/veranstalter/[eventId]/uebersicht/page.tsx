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
  ] = await Promise.all([
    supabase.from('events').select('id, title, date, budget_total, projektphase').eq('id', eventId).single(),
    supabase.from('event_members').select('id, role').eq('event_id', eventId),
    supabase
      .from('event_members')
      .select('id, role, profiles(id, name, email, phone)')
      .eq('event_id', eventId)
      .in('role', ['brautpaar', 'trauzeuge']),
    supabase.from('invite_codes').select('id, status').eq('event_id', eventId).eq('status', 'offen'),
    supabase.from('guests').select('id, status').eq('event_id', eventId),
    supabase.from('vendors').select('id, name, status, price, category').eq('event_id', eventId),
    supabase.from('budget_items').select('id, planned, actual, payment_status').eq('event_id', eventId),
    supabase.from('organizer_todos').select('id, title, done').eq('event_id', eventId).eq('organizer_id', user.id).order('created_at'),
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
      {/* Header with phase badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>
          Übersicht
        </h1>
        <Link
          href={`/veranstalter/${eventId}/allgemein`}
          title="Projektphase bearbeiten"
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: phaseStyle.bg, color: phaseStyle.color,
            border: `1px solid ${phaseStyle.border}`, textDecoration: 'none',
            letterSpacing: '0.01em',
          }}
        >
          {phase}
        </Link>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>
        Alle wichtigen Kennzahlen auf einen Blick
      </p>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KpiCard
          icon={<Users size={20} color="var(--text-primary)" />}
          label="Mitglieder"
          value={members.length.toString()}
          sub={`${members.filter(m => m.role === 'brautpaar').length} BP · ${members.filter(m => m.role === 'trauzeuge').length} TZ · ${members.filter(m => m.role === 'dienstleister').length} DL`}
          href={`/veranstalter/${eventId}/mitglieder`}
        />
        <KpiCard
          icon={<Mail size={20} color="var(--text-primary)" />}
          label="Offene Einladungen"
          value={openInvites.toString()}
          sub="Noch nicht eingelöst"
          href={`/veranstalter/${eventId}/mitglieder`}
        />
        <KpiCard
          icon={<Calendar size={20} color="var(--text-primary)" />}
          label="Tage bis Event"
          value={daysLeft != null ? daysLeft.toString() : '—'}
          sub={event.date ? new Date(event.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Kein Datum gesetzt'}
          href={`/veranstalter/${eventId}/allgemein`}
        />
      </div>

      {/* Two section cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>

        {/* Event Card */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.1px' }}>Event</span>
            <Link href={`/veranstalter/${eventId}/allgemein`} style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', borderRadius: 6 }}>Bearbeiten →</Link>
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
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {fmtMoney(totalSpent)} ausgegeben · {budgetPercent.toFixed(0)}%
            </div>
          </div>

          <div style={{ padding: '6px 0 8px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <Link href={`/veranstalter/${eventId}/mitglieder`} style={{ textDecoration: 'none', display: 'block' }}>
              <SectionItem label="Bestätigte Dienstleister" value={confirmedVendors.toString()} clickable />
            </Link>
          </div>

          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.015)' }}>
            <Link href={`/veranstalter/${eventId}/vorschlaege`} style={{
              fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
              textDecoration: 'none', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 7,
              padding: '6px 12px', display: 'inline-block',
            }}>
              Vorschläge verwalten
            </Link>
          </div>
        </div>

        {/* Kontakt-Schnellzugriff */}
        {(brautpaar.length > 0 || trauzeugen.length > 0) && (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.1px' }}>Wichtige Kontakte</span>
            </div>

            {brautpaar.length > 0 && (
              <div style={{ padding: '14px 22px', borderBottom: trauzeugen.length > 0 ? '1px solid var(--border)' : undefined }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                  Brautpaar
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {brautpaar.map(m => (
                    <ContactRow key={m.id} profile={m.profiles} />
                  ))}
                </div>
              </div>
            )}

            {trauzeugen.length > 0 && (
              <div style={{ padding: '14px 22px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                  Trauzeugen
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {trauzeugen.map(m => (
                    <ContactRow key={m.id} profile={m.profiles} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Organizer To-Do Liste */}
      <div style={{ marginTop: 24 }}>
        <OrganizerTodoList
          eventId={eventId}
          organizerId={user.id}
          initialTodos={organizerTodos}
        />
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, href }: {
  icon: React.ReactNode; label: string; value: string; sub: string; href: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', padding: '22px 24px',
        cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 10 }}>
          {label}
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1.5px', color: 'var(--text-primary)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>{sub}</div>
      </div>
    </Link>
  )
}

function SectionItem({ label, value, accent, clickable }: {
  label: string; value: string; accent?: 'green' | 'red'; clickable?: boolean
}) {
  const color = accent === 'green' ? '#34C759' : accent === 'red' ? '#FF3B30' : 'var(--text-primary)'
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 22px', borderTop: '1px solid rgba(0,0,0,0.05)',
      cursor: clickable ? 'pointer' : undefined,
    }}>
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
        {label}
        {clickable && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>→</span>}
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
            <Phone size={12} color="var(--text-tertiary)" />
            {profile.phone}
          </a>
        )}
        <a href={`mailto:${profile.email}`} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Mail size={12} color="var(--text-tertiary)" />
          {profile.email}
        </a>
      </div>
    </div>
  )
}
