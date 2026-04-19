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
      <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 28, fontWeight: 600, marginBottom: 6 }}>
        Übersicht
      </h1>
      <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 32 }}>
        Alle wichtigen Kennzahlen auf einen Blick
      </p>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiCard
          icon={<Users size={20} color="var(--gold)" />}
          label="Mitglieder"
          value={members.length.toString()}
          sub={`${members.filter(m => m.role === 'brautpaar').length} BP · ${members.filter(m => m.role === 'trauzeuge').length} TZ · ${members.filter(m => m.role === 'dienstleister').length} DL`}
          href={`/veranstalter/${eventId}/mitglieder`}
        />
        <KpiCard
          icon={<Mail size={20} color="var(--gold)" />}
          label="Offene Einladungen"
          value={openInvites.toString()}
          sub="Noch nicht eingelöst"
          href={`/veranstalter/${eventId}/mitglieder`}
        />
        <KpiCard
          icon={<Calendar size={20} color="var(--gold)" />}
          label="Tage bis Event"
          value={daysLeft != null ? daysLeft.toString() : '—'}
          sub={event.date ? new Date(event.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Kein Datum gesetzt'}
          href={`/veranstalter/${eventId}/allgemein`}
        />
      </div>

      {/* Two section cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Event Card */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--heading-font)', fontSize: 18, fontWeight: 600 }}>Event</h2>
            <Link href={`/veranstalter/${eventId}/allgemein`} style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>Bearbeiten →</Link>
          </div>

          {/* Guests */}
          <SectionItem label="Gäste gesamt" value={guestsTotal.toString()} />
          <SectionItem label="Zusagen" value={guestsConfirmed.toString()} accent="green" />
          <SectionItem label="Absagen" value={guestsDeclined.toString()} accent="red" />

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {/* Budget progress */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-light)' }}>Budget Brautpaar</span>
              <span style={{ fontWeight: 500 }}>{fmtMoney(budgetTotal)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${budgetPercent}%`, background: 'var(--gold)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              {fmtMoney(totalSpent)} ausgegeben · {budgetPercent.toFixed(0)}%
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {/* Vendors */}
          <SectionItem label="Bestätigte Dienstleister" value={confirmedVendors.toString()} />
          <SectionItem label="Dienstleister gesamt" value={vendors.length.toString()} />

          <Link href={`/veranstalter/${eventId}/vorschlaege`} style={{
            display: 'inline-block', marginTop: 12, fontSize: 13, color: 'var(--gold)',
            textDecoration: 'none', fontWeight: 500,
          }}>
            Vorschläge verwalten →
          </Link>
        </div>

        {/* Veranstalter Card */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--heading-font)', fontSize: 18, fontWeight: 600 }}>Veranstalter</h2>
            <Link href={`/veranstalter/${eventId}/statistiken`} style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>Details →</Link>
          </div>

          {/* Spending bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-light)' }}>Ausgaben</span>
              <span style={{ fontWeight: 500 }}>{fmtMoney(totalVendorCost)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${budgetTotal > 0 ? Math.min(100, (totalVendorCost / budgetTotal) * 100) : 0}%`, background: '#007AFF', borderRadius: 3 }} />
            </div>
          </div>

          <SectionItem label="Offene Rechnungen" value={openInvoices.toString()} accent={openInvoices > 0 ? 'red' : undefined} />
          {margin != null && <SectionItem label="Veranstalter-Marge" value={fmtMoney(margin)} accent={margin >= 0 ? 'green' : 'red'} />}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {/* Open tasks */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mid)' }}>Offene Aufgaben</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{openTasks.length} offen</span>
          </div>
          {openTasks.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>Alles erledigt</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {openTasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                  <CheckSquare size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--text-dim)' }} />
                  <span style={{ color: 'var(--text-mid)' }}>{t.title ?? 'Aufgabe'}</span>
                </div>
              ))}
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {/* Quick actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
        background: 'var(--surface)', borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)', padding: '20px 22px',
        cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--r-sm)',
            background: 'var(--gold-pale)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 500 }}>{label}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--heading-font)', color: 'var(--text)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>
      </div>
    </Link>
  )
}

function SectionItem({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' }) {
  const color = accent === 'green' ? 'var(--green)' : accent === 'red' ? 'var(--red)' : 'var(--text)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--text-light)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color }}>{value}</span>
    </div>
  )
}

function QuickAction({ label, href, icon }: { label: string; href: string; icon: React.ReactNode }) {
  return (
    <Link href={href} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 12px', borderRadius: 20,
      background: 'var(--surface2)', border: '1px solid var(--border)',
      fontSize: 12, fontWeight: 500, color: 'var(--text-mid)', textDecoration: 'none',
    }}>
      {icon}{label}
    </Link>
  )
}
