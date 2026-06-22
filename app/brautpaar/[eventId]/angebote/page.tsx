export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BrautpaarAngeboteClient from './BrautpaarAngeboteClient'

const COUPLE_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

export default async function BrautpaarAngebotePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle()
  if (!member || !COUPLE_ROLES.includes(member.role)) redirect('/login')

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Angebote &amp; Verträge</h1>
        <p className="bp-page-subtitle">Angebote eurer Dienstleister prüfen, als PDF speichern und verbindlich annehmen.</p>
      </div>
      <BrautpaarAngeboteClient eventId={eventId} />
    </div>
  )
}
