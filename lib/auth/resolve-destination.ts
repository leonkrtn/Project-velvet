import type { SupabaseClient, User } from '@supabase/supabase-js'
import { ensureSoloEvent, isSoloSignup } from '@/lib/brautpaar-solo'

// Bestimmt, wohin ein frisch angemeldeter Nutzer geleitet wird — geteilt
// zwischen dem Login-Formular und der Konto-Wiederherstellen-Seite (beide
// müssen nach erfolgreicher Anmeldung dieselbe Rollen-Priorität anwenden:
// Paar-Portal → Vendor-Portal → Veranstalter-Warteseite).
export async function resolveDestination(supabase: SupabaseClient, user: User, nextUrl: string | null): Promise<string> {
  if (nextUrl) return nextUrl

  let isOrganizer = user.app_metadata?.is_approved_organizer === true
  if (!isOrganizer) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved_organizer')
      .eq('id', user.id)
      .single()
    isOrganizer = profile?.is_approved_organizer === true
  }
  if (isOrganizer) return '/veranstalter/events'
  if (user.app_metadata?.role === 'mitarbeiter') return '/mitarbeiter'

  const { data: memberships } = await supabase
    .from('event_members')
    .select('event_id, role')
    .eq('user_id', user.id)
  const roles = (memberships ?? []).map(m => m.role)

  if (roles.includes('brautpaar') || roles.includes('brautpaar_solo')) return '/brautpaar'
  if (roles.includes('dienstleister')) return '/vendor/ubersicht'
  if (roles.includes('veranstalter')) return '/veranstalter/pending'

  if (isSoloSignup(user)) {
    try {
      const eventId = await ensureSoloEvent(supabase, user.user_metadata)
      await fetch('/api/brautpaar/sync-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, meta: user.user_metadata }),
      }).catch(() => {})
      return `/brautpaar/${eventId}/uebersicht`
    } catch {
      return '/signup'
    }
  }

  const { data: staffRow } = await supabase
    .from('organizer_staff')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (staffRow) return '/mitarbeiter'

  const { data: vsc } = await supabase
    .from('vendor_signup_codes')
    .select('id')
    .eq('used_by', user.id)
    .limit(1)
  if (vsc && vsc.length > 0) return '/vendor/ubersicht'
  if (user.user_metadata?.signup_role === 'dienstleister') return '/vendor/listing'

  return '/signup'
}
