// POST { eventId, plan: 'basis' | 'pro' }
//
// SIMULIERTER Checkout: Es ist noch kein Zahlungsdienstleister angebunden.
// Diese Route setzt das Abo direkt auf aktiv. Bei Anbindung von z. B. Stripe
// wird hier stattdessen eine Checkout-Session erstellt und die Aktivierung
// in den Webhook verlagert — die Aufrufer (AboClient) bleiben unverändert.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSoloMember, PLAN_PRICES } from '@/lib/subscription'
import { BILLING_ENABLED } from '@/lib/billing'

export async function POST(req: Request) {
  // Gratis-Phase: kein Abo-System — Checkout ist nicht verfügbar.
  if (!BILLING_ENABLED) return NextResponse.json({ error: 'Nicht verfügbar' }, { status: 404 })

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

  // Angehängten Promo-Code lesen (für Rabatt + Statistik)
  const { data: existing } = await admin
    .from('event_subscriptions')
    .select('promo_code_id, promo_percent, promo_duration, promo_applies_to')
    .eq('event_id', eventId)
    .maybeSingle()

  const promoApplies = !!existing?.promo_percent &&
    (existing.promo_applies_to === 'all' || existing.promo_applies_to === plan)
  const percent = promoApplies ? Number(existing!.promo_percent) : 0
  const monthlyDiscount = +(PLAN_PRICES[plan] * percent / 100).toFixed(2)

  const patch: Record<string, unknown> = {
    event_id: eventId,
    plan,
    status: 'active',
    current_period_end: periodEnd,
    canceled_at: null,
    updated_at: now.toISOString(),
  }
  // Bei "erster Monat" ist der Rabatt nach diesem Checkout aufgebraucht — Code
  // bleibt zur Zuordnung erhalten, der Prozentsatz wird entfernt.
  if (promoApplies && existing!.promo_duration === 'first_month') {
    patch.promo_percent = null
  }

  const { error } = await admin.from('event_subscriptions').upsert(patch, { onConflict: 'event_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Statistik: Rabattwert + bezahlten Tarif auf der Einlöse-Zeile festhalten
  if (promoApplies && existing?.promo_code_id) {
    await admin.from('promo_redemptions')
      .update({ plan, discount_eur: monthlyDiscount })
      .eq('code_id', existing.promo_code_id)
      .eq('event_id', eventId)
  }

  return NextResponse.json({ ok: true, plan, currentPeriodEnd: periodEnd, simulated: true })
}
