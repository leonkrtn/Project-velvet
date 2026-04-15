// app/api/events/create/route.ts
// Server-only: validiert is_approved_organizer, erstellt Event als Veranstalter
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { DEFAULT_FEATURE_TOGGLES } from '@/lib/store'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createServiceClient(url, serviceKey)
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const admin = getServiceClient()

  // Prüfen ob User approved Veranstalter ist
  const { data: profile } = await admin
    .from('profiles')
    .select('is_approved_organizer')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_approved_organizer) {
    return NextResponse.json({ error: 'Nicht autorisiert — kein genehmigter Veranstalter' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const eventId = crypto.randomUUID()

  // Event erstellen
  const { error: evErr } = await admin.from('events').insert({
    id: eventId,
    couple_name: body.event?.coupleName ?? '',
    date: body.event?.date ?? '',
    venue: body.event?.venue ?? '',
    venue_address: body.event?.venueAddress ?? '',
    dresscode: body.event?.dresscode ?? '',
    children_allowed: body.event?.childrenAllowed ?? true,
    meal_options: body.event?.mealOptions ?? ['fleisch', 'fisch', 'vegetarisch', 'vegan'],
    max_begleitpersonen: body.event?.maxBegleitpersonen ?? 2,
    onboarding_complete: true,
  })
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })

  // User als Veranstalter hinzufügen
  await admin.from('event_members').insert({
    event_id: eventId,
    user_id: user.id,
    role: 'veranstalter',
  })

  // Feature-Toggles mit Defaults initialisieren
  const ftRows = Object.entries(DEFAULT_FEATURE_TOGGLES).map(([key, enabled]) => ({
    event_id: eventId, key, enabled,
  }))
  await admin.from('feature_toggles').insert(ftRows)

  // Audit-Log
  await admin.rpc('write_audit_log', {
    p_event_id: eventId,
    p_actor_id: user.id,
    p_actor_role: 'veranstalter',
    p_action: 'INSERT',
    p_table_name: 'events',
    p_record_id: eventId,
  })

  return NextResponse.json({ eventId })
}
