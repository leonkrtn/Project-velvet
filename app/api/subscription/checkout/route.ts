// POST { eventId, plan: 'basis' | 'pro' }
//
// SIMULIERTER Checkout: Es ist noch kein Zahlungsdienstleister angebunden.
// Diese Route setzt das Abo direkt auf aktiv. Bei Anbindung von z. B. Stripe
// wird hier stattdessen eine Checkout-Session erstellt und die Aktivierung
// in den Webhook verlagert — die Aufrufer (AboClient) bleiben unverändert.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSoloMember } from '@/lib/subscription'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await req.json().catch(() => null) as { eventId?: string; plan?: string } | null
  const eventId = body?.eventId
  const plan = body?.plan
  if (!eventId || (plan !== 'basis' && plan !== 'pro')) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  if (!(await isSoloMember(eventId, user.id))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const periodEnd = new Date(now.getTime() + 30 * 86400000).toISOString()

  const { error } = await admin.from('event_subscriptions').upsert({
    event_id: eventId,
    plan,
    status: 'active',
    current_period_end: periodEnd,
    canceled_at: null,
    updated_at: now.toISOString(),
  }, { onConflict: 'event_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, plan, currentPeriodEnd: periodEnd, simulated: true })
}
