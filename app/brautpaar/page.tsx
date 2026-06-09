import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ensureSoloEvent, isSoloSignup } from '@/lib/brautpaar-solo'

export default async function BrautpaarRootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/brautpaar')

  // Find the brautpaar's event
  const { data: member } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', user.id)
    .in('role', ['brautpaar', 'brautpaar_solo', 'veranstalter'])
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (member?.event_id) {
    redirect(`/brautpaar/${member.event_id}/uebersicht`)
  }

  // Solo-Signup ohne Event (z. B. nach E-Mail-Bestätigung direkt hierher
  // navigiert): Event idempotent anlegen statt auszusperren.
  if (isSoloSignup(user)) {
    let eventId: string | null = null
    try {
      eventId = await ensureSoloEvent(supabase, user.user_metadata)
    } catch { /* fällt unten auf /login zurück */ }
    if (eventId) redirect(`/brautpaar/${eventId}/uebersicht`)
  }

  redirect('/login')
}
