// POST { eventId, reason? } — kündigt zum Periodenende (Zugriff bleibt bis
// dahin); der Kündigungsgrund aus der Lightbox wird mitgespeichert.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSoloMember } from '@/lib/subscription'
import { BILLING_ENABLED } from '@/lib/billing'
import { toUserMessage } from '@/lib/errors'

export async function POST(req: Request) {
  // Gratis-Phase: kein Abo-System — Kündigung ist nicht verfügbar.
  if (!BILLING_ENABLED) return NextResponse.json({ error: 'Nicht verfügbar' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await req.json().catch(() => null) as { eventId?: string; reason?: string } | null
  if (!body?.eventId) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  if (!(await isSoloMember(body.eventId, user.id))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('event_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      cancel_reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', body.eventId)
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: toUserMessage(error, 'Die Kündigung konnte nicht abgeschlossen werden.') }, { status: 500 })
  return NextResponse.json({ ok: true })
}
