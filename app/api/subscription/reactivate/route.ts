// POST { eventId } — nimmt eine Kündigung zurück, solange die bezahlte
// Periode noch läuft (danach führt der Weg über den Checkout).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSoloMember } from '@/lib/subscription'
import { BILLING_ENABLED } from '@/lib/billing'

export async function POST(req: Request) {
  // Gratis-Phase: kein Abo-System — Reaktivierung ist nicht verfügbar.
  if (!BILLING_ENABLED) return NextResponse.json({ error: 'Nicht verfügbar' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await req.json().catch(() => null) as { eventId?: string } | null
  if (!body?.eventId) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  if (!(await isSoloMember(body.eventId, user.id))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('event_subscriptions')
    .update({ status: 'active', canceled_at: null, updated_at: new Date().toISOString() })
    .eq('event_id', body.eventId)
    .eq('status', 'canceled')
    .gt('current_period_end', new Date().toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
