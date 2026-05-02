import { createClient } from '@/lib/supabase/server'

interface Props { params: Promise<{ eventId: string }> }

export default async function VendorUebersichtPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [tabPermRes, eventRes] = await Promise.all([
    supabase
      .from('dienstleister_permissions')
      .select('access')
      .eq('event_id', eventId)
      .eq('dienstleister_user_id', user?.id ?? '')
      .eq('tab_key', 'uebersicht')
      .is('item_id', null)
      .single(),
    supabase
      .from('events')
      .select('title, date, couple_name, venue')
      .eq('id', eventId)
      .single(),
  ])

  const tabAccess = (tabPermRes.data?.access ?? 'none') as 'none' | 'read' | 'write'
  const event = eventRes.data

  if (tabAccess === 'none') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
            Kein Zugriff auf diese Übersicht
          </p>
          <p style={{ fontSize: 14 }}>
            Sie haben keine Berechtigung, diese Seite einzusehen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>
        Veranstaltungsübersicht
      </h1>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {event ? (
          <>
            <OverviewRow label="Veranstaltung" value={event.title ?? '—'} />
            <OverviewRow label="Datum" value={event.date ? new Date(event.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
            <OverviewRow label="Brautpaar" value={event.couple_name ?? '—'} />
            <OverviewRow label="Location" value={event.venue ?? '—'} />
          </>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Keine Eventdaten gefunden.</p>
        )}
      </div>
    </div>
  )
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  )
}
