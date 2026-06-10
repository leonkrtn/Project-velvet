export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, SlidersHorizontal } from 'lucide-react'
import VendorInviteSection from './VendorInviteSection'

interface Props {
  params: Promise<{ eventId: string }>
}

// Dienstleister-Verwaltung für Solo-Brautpaare: ohne Veranstalter sind sie
// selbst dafür zuständig, eingeladenen Dienstleistern Tab-Rechte zu geben.
// Brautpaare MIT Veranstalter werden zur Übersicht umgeleitet — dort macht
// das der Veranstalter über sein Portal.
export default async function BrautpaarDienstleisterPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) redirect('/login')
  if (member.role !== 'brautpaar_solo') redirect(`/brautpaar/${eventId}/uebersicht`)

  const admin = createAdminClient()
  const { data: vendors } = await admin
    .from('event_members')
    .select('id, user_id, profiles!user_id(id, name, email)')
    .eq('event_id', eventId)
    .eq('role', 'dienstleister')

  const rows = (vendors ?? []).map(v => {
    const profile = Array.isArray(v.profiles) ? (v.profiles[0] ?? null) : v.profiles
    return { id: v.id, userId: v.user_id, name: profile?.name ?? null, email: profile?.email ?? null }
  })

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Dienstleister</h1>
        <p className="bp-page-subtitle">
          Eure Dienstleister und ihre Zugriffsrechte auf die Planungsmodule
        </p>
      </div>

      <VendorInviteSection eventId={eventId} />

      {rows.length === 0 ? (
        <div className="bp-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
          <Briefcase size={28} style={{ opacity: 0.35, marginBottom: 12 }} />
          <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 6px' }}>Noch keine Dienstleister verbunden</p>
          <p className="bp-caption" style={{ margin: 0 }}>
            Sobald ein eingeladener Dienstleister sich registriert hat, erscheint er hier —
            dann könnt ihr seine Zugriffsrechte festlegen.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {rows.map(v => (
            <div key={v.id} className="bp-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Briefcase size={18} style={{ flexShrink: 0, opacity: 0.6 }} />
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{v.name ?? v.email ?? 'Dienstleister'}</p>
                {v.name && v.email && <p className="bp-caption" style={{ margin: 0 }}>{v.email}</p>}
              </div>
              <Link
                href={`/brautpaar/${eventId}/dienstleister/${v.userId}`}
                className="bp-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <SlidersHorizontal size={14} />
                Berechtigungen
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
