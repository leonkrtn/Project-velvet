import { createClient } from '@/lib/supabase/server'

interface Props { params: Promise<{ eventId: string }> }

type Access = 'none' | 'read' | 'write'

function secVis(sectionPerms: Record<string, Access>, tabAccess: Access, key: string): boolean {
  return (sectionPerms[key] ?? tabAccess) !== 'none'
}

export default async function VendorUebersichtPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [tabPermRes, sectionPermsRes, eventRes, membersRes] = await Promise.all([
    supabase
      .from('dienstleister_permissions')
      .select('access')
      .eq('event_id', eventId)
      .eq('dienstleister_user_id', user?.id ?? '')
      .eq('tab_key', 'uebersicht')
      .is('item_id', null)
      .maybeSingle(),
    supabase
      .from('dienstleister_permissions')
      .select('item_id, access')
      .eq('event_id', eventId)
      .eq('dienstleister_user_id', user?.id ?? '')
      .eq('tab_key', 'uebersicht')
      .not('item_id', 'is', null),
    supabase
      .from('events')
      .select('title, date, couple_name, venue')
      .eq('id', eventId)
      .single(),
    supabase
      .from('event_members')
      .select('id, role, profiles!user_id(name, email)')
      .eq('event_id', eventId),
  ])

  const tabAccess = (tabPermRes.data?.access ?? 'none') as Access
  const event = eventRes.data
  const members = membersRes.data ?? []

  const sectionPerms: Record<string, Access> = {}
  for (const r of sectionPermsRes.data ?? []) {
    if (r.item_id) sectionPerms[r.item_id] = r.access as Access
  }

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

  const daysUntilEvent = event?.date
    ? Math.ceil((new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const memberCount = members.length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brautpaar = members.filter((m: any) => m.role === 'brautpaar')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kontakte = members.filter((m: any) => m.role === 'brautpaar' || m.role === 'trauzeuge')

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>
        Veranstaltungsübersicht
      </h1>

      {/* KPI Cards */}
      {(secVis(sectionPerms, tabAccess, 'mitglieder') || secVis(sectionPerms, tabAccess, 'countdown')) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          {secVis(sectionPerms, tabAccess, 'mitglieder') && (
            <KpiCard label="Team-Mitglieder" value={String(memberCount)} />
          )}
          {secVis(sectionPerms, tabAccess, 'countdown') && daysUntilEvent !== null && (
            <KpiCard label="Tage bis Event" value={daysUntilEvent > 0 ? String(daysUntilEvent) : 'Heute!'} />
          )}
        </div>
      )}

      {/* Event Info */}
      {secVis(sectionPerms, tabAccess, 'event') && event && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginBottom: 20,
        }}>
          <OverviewRow label="Veranstaltung" value={event.title ?? '—'} />
          <OverviewRow label="Datum" value={event.date ? new Date(event.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
          <OverviewRow label="Brautpaar" value={event.couple_name ?? '—'} />
          <OverviewRow label="Location" value={event.venue ?? '—'} />
        </div>
      )}

      {/* Kontakte */}
      {secVis(sectionPerms, tabAccess, 'kontakte') && kontakte.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Wichtige Kontakte</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {kontakte.map((m: any) => {
              const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{profile?.name ?? '—'}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.role === 'brautpaar' ? 'Brautpaar' : 'Trauzeuge'}</p>
                  </div>
                  {profile?.email && (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{profile.email}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 20px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
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
