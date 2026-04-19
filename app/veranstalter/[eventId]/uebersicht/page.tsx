import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Mail, Calendar, Euro, TrendingUp, FileText, CheckSquare, Clock } from 'lucide-react'

interface Props {
  params: Promise<{ eventId: string }>
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

  // Parallel data fetching
  const [
    eventRes,
    membersRes,
    inviteCodesRes,
    guestsRes,
    vendorsRes,
    budgetItemsRes,
    tasksRes,
  ] = await Promise.all([
    supabase.from('events').select('id, title, date, budget_total, organizer_fee').eq('id', eventId).single(),
    supabase.from('event_members').select('id, role').eq('event_id', eventId),
    supabase.from('invite_codes').select('id, status').eq('event_id', eventId).eq('status', 'offen'),
    supabase.from('guests').select('id, status').eq('event_id', eventId),
    supabase.from('vendors').select('id, name, status, price, category').eq('event_id', eventId),
    supabase.from('budget_items').select('id, planned, actual, payment_status').eq('event_id', eventId),
    supabase.from('tasks').select('id, title, done, phase').eq('event_id', eventId).eq('done', false).limit(5),
  ])

  const event = eventRes.data
  if (!event) redirect('/veranstalter')

  const members = membersRes.data ?? []
  const openInvites = inviteCodesRes.data?.length ?? 0
  const guests = guestsRes.data ?? []
  const vendors = vendorsRes.data ?? []
  const budgetItems = budgetItemsRes.data ?? []
  const openTasks = tasksRes.data ?? []

  const daysLeft = daysUntil(event.date)
  const guestsTotal = guests.length
  const guestsConfirmed = guests.filter(g => g.status === 'zugesagt').length
  const guestsDeclined = guests.filter(g => g.status === 'abgesagt').length

  const budgetTotal = event.budget_total ?? 0
  const totalSpent = budgetItems.reduce((s, b) => s + (b.actual ?? 0), 0)
  const openInvoices = budgetItems.filter(b => b.payment_status === 'offen').length
  const budgetPercent = budgetTotal > 0 ? Math.min(100, (totalSpent / budgetTotal) * 100) : 0

  const confirmedVendors = vendors.filter(v => v.status === 'bestaetigt').length
  const totalVendorCost = vendors.reduce((s, v) => s + (v.price ?? 0), 0)
  const organizerFee = event.organizer_fee ?? 0
  const margin = budgetTotal > 0 ? budgetTotal - totalVendorCost - organizerFee : null

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>
        Übersicht
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>
        Alle wichtigen Kennzahlen auf einen Blick
      </p>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

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
            <SectionItem label="Bestätigte Dienstleister" value={confirmedVendors.toString()} />
            <SectionItem label="Dienstleister gesamt" value={vendors.length.toString()} />
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

        {/* Veranstalter Card */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.1px' }}>Veranstalter</span>
            <Link href={`/veranstalter/${eventId}/statistiken`} style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none', padding: '4px 8px', borderRadius: 6 }}>Details →</Link>
          </div>

          <div style={{ padding: '13px 22px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>Ausgaben</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtMoney(totalVendorCost)}</span>
            </div>
            <div style={{ height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${budgetTotal > 0 ? Math.min(100, (totalVendorCost / budgetTotal) * 100) : 0}%`, background: '#007AFF', borderRadius: 99 }} />
            </div>
          </div>

          <div style={{ padding: '6px 0 8px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <SectionItem label="Offene Rechnungen" value={openInvoices.toString()} accent={openInvoices > 0 ? 'red' : undefined} />
            {margin != null && <SectionItem label="Veranstalter-Marge" value={fmtMoney(margin)} accent={margin >= 0 ? 'green' : 'red'} />}
          </div>

          <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 22px', cursor: 'default' }}>
              <span style={{ fontSize: 13.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF9500', display: 'inline-block', flexShrink: 0 }} />
                Offene Aufgaben
              </span>
              <span style={{
                background: '#FF9500', color: 'white', fontSize: 11, fontWeight: 600,
                padding: '1px 7px', borderRadius: 20,
              }}>{openTasks.length}</span>
            </div>
            {openTasks.length > 0 && (
              <div style={{ padding: '2px 22px 10px 50px' }}>
                {openTasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 13, color: 'var(--text-secondary)', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ width: 16, height: 16, border: '1.5px solid #C7C7CC', borderRadius: '50%', flexShrink: 0 }} />
                    {t.title ?? 'Aufgabe'}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.015)' }}>
            <QuickAction label="Ablaufplan" href={`/veranstalter/${eventId}/ablaufplan`} icon={<Clock size={13} />} />
            <QuickAction label="Statistiken" href={`/veranstalter/${eventId}/statistiken`} icon={<TrendingUp size={13} />} />
            <QuickAction label="Berechtigungen" href={`/veranstalter/${eventId}/berechtigungen`} icon={<FileText size={13} />} />
          </div>
        </div>
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

function SectionItem({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' }) {
  const color = accent === 'green' ? '#34C759' : accent === 'red' ? '#FF3B30' : 'var(--text-primary)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 22px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color, letterSpacing: '-0.3px' }}>{value}</span>
    </div>
  )
}

function QuickAction({ label, href, icon }: { label: string; href: string; icon: React.ReactNode }) {
  return (
    <Link href={href} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 12px', borderRadius: 7,
      background: 'var(--surface)', border: '1px solid var(--border)',
      fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none',
    }}>
      {icon}{label}
    </Link>
  )
}
