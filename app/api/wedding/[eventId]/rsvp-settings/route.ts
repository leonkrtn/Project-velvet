// app/api/wedding/[eventId]/rsvp-settings/route.ts
// Speichert die funktionalen RSVP-Einstellungen, die jetzt im Hochzeitswebsite-Editor leben:
//   - rsvp_settings: Einladungstext, Frist, Telefonkontakt, Menü-/Begleitung-Anzeige
//   - events: max_begleitpersonen
//   - feature_toggles: rsvp-menu / rsvp-begleitpersonen / rsvp-musikwunsch / rsvp-geschenke / rsvp-hotel
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEventRole } from '@/lib/files/permissions'

const EDIT_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

export async function PUT(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const role = await getEventRole(supabase, user.id, eventId)
  if (!role || !EDIT_ROLES.includes(role)) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungültiger Payload' }, { status: 400 }) }

  const admin = createAdminClient()

  // 1. rsvp_settings (eine Zeile pro Event)
  const rsvpPayload = {
    event_id: eventId,
    invitation_text: String(body.invitationText ?? '').slice(0, 2000),
    rsvp_deadline: body.deadline || null,
    phone_contact: (String(body.phoneContact ?? '').trim() || null),
    show_meal_choice: body.showMealChoice !== false,
    show_plus_one: body.showPlusOne !== false,
  }
  const { data: existing } = await admin.from('rsvp_settings').select('id').eq('event_id', eventId).maybeSingle()
  const rsvpRes = existing
    ? await admin.from('rsvp_settings').update(rsvpPayload).eq('id', existing.id)
    : await admin.from('rsvp_settings').insert(rsvpPayload)
  if (rsvpRes.error) return NextResponse.json({ error: rsvpRes.error.message }, { status: 500 })

  // 2. events.max_begleitpersonen
  if (body.maxBegleitpersonen !== undefined) {
    const n = Math.max(0, Math.min(20, parseInt(String(body.maxBegleitpersonen), 10) || 0))
    await admin.from('events').update({ max_begleitpersonen: n }).eq('id', eventId)
  }

  // 3. feature_toggles
  const t = body.toggles ?? {}
  const rows = [
    { key: 'rsvp-menu', enabled: t.menu !== false },
    { key: 'rsvp-begleitpersonen', enabled: t.begleitpersonen !== false },
    { key: 'rsvp-musikwunsch', enabled: t.musikwunsch !== false },
    { key: 'rsvp-geschenke', enabled: t.geschenke !== false },
    { key: 'rsvp-hotel', enabled: t.hotel !== false },
  ].map(r => ({ event_id: eventId, key: r.key, enabled: r.enabled }))
  const tRes = await admin.from('feature_toggles').upsert(rows, { onConflict: 'event_id,key' })
  if (tRes.error) return NextResponse.json({ error: tRes.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
