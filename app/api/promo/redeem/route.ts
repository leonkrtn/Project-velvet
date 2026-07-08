// POST { eventId, code }
// Löst einen Promo-Code für ein Solo-Brautpaar-Event ein.
//   percent      → Rabatt wird ans Abo gehängt (Anzeige + Checkout), zählt als Einlösung
//   free_months  → schaltet sofort X Monate Pro-Zugang OHNE Zahlung frei
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSoloMember, PLAN_PRICES, TRIAL_DAYS } from '@/lib/subscription'
import { BILLING_ENABLED } from '@/lib/billing'

function normCode(s: string) {
  return s.trim().toUpperCase()
}

export async function POST(req: Request) {
  // Gratis-Phase: kein Abo-System — Promo-Codes sind nicht einlösbar.
  if (!BILLING_ENABLED) return NextResponse.json({ error: 'Nicht verfügbar' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await req.json().catch(() => null) as { eventId?: string; code?: string } | null
  const eventId = body?.eventId
  const codeRaw = body?.code
  if (!eventId || !codeRaw?.trim()) {
    return NextResponse.json({ error: 'Bitte einen Code eingeben.' }, { status: 400 })
  }
  if (!(await isSoloMember(eventId, user.id))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: code } = await admin
    .from('promo_codes')
    .select('*')
    .eq('code_norm', normCode(codeRaw))
    .maybeSingle()

  if (!code || !code.active) {
    return NextResponse.json({ error: 'Dieser Code ist ungültig.' }, { status: 404 })
  }
  if (code.valid_until && new Date(code.valid_until).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Dieser Code ist abgelaufen.' }, { status: 400 })
  }

  // Schon für dieses Event eingelöst?
  const { data: existing } = await admin
    .from('promo_redemptions')
    .select('id')
    .eq('code_id', code.id)
    .eq('event_id', eventId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'Dieser Code wurde bereits eingelöst.' }, { status: 409 })
  }

  // Max. Einlösungen erreicht?
  if (code.max_redemptions) {
    const { count } = await admin
      .from('promo_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('code_id', code.id)
    if ((count ?? 0) >= code.max_redemptions) {
      return NextResponse.json({ error: 'Dieser Code ist leider ausgeschöpft.' }, { status: 409 })
    }
  }

  const now = new Date()

  if (code.type === 'free_months') {
    const months = code.free_months as number
    const periodEnd = new Date(now.getTime() + months * 30 * 86400000).toISOString()
    // Sofort Pro-Zugang ohne Zahlung
    const { error: upErr } = await admin.from('event_subscriptions').upsert({
      event_id: eventId,
      plan: 'pro',
      status: 'active',
      current_period_end: periodEnd,
      canceled_at: null,
      promo_code_id: code.id,
      promo_percent: null,
      promo_duration: null,
      promo_applies_to: null,
      updated_at: now.toISOString(),
    }, { onConflict: 'event_id' })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    await admin.from('promo_redemptions').insert({
      code_id: code.id, event_id: eventId, redeemed_by: user.id,
      type: 'free_months', plan: 'pro', free_months: months,
      discount_eur: PLAN_PRICES.pro * months,
    })

    return NextResponse.json({
      ok: true, type: 'free_months', freeMonths: months,
      message: `${months} Gratismonat${months === 1 ? '' : 'e'} Forevr Pro freigeschaltet.`,
    })
  }

  // percent — Rabatt ans Abo hängen (greift beim Checkout / Preis-Anzeige).
  // Bestehendes Abo (lazy beim Portal-Besuch angelegt) nur in den Promo-Feldern
  // aktualisieren; existiert ausnahmsweise keins, eine Trial-Zeile anlegen.
  const promoFields = {
    promo_code_id: code.id,
    promo_percent: code.percent_off,
    promo_duration: code.duration,
    promo_applies_to: code.applies_to,
    updated_at: now.toISOString(),
  }
  const { data: sub } = await admin
    .from('event_subscriptions').select('event_id').eq('event_id', eventId).maybeSingle()
  if (sub) {
    await admin.from('event_subscriptions').update(promoFields).eq('event_id', eventId)
  } else {
    await admin.from('event_subscriptions').insert({
      event_id: eventId, plan: 'trial', status: 'trialing',
      trial_ends_at: new Date(now.getTime() + TRIAL_DAYS * 86400000).toISOString(),
      ...promoFields,
    })
  }

  await admin.from('promo_redemptions').insert({
    code_id: code.id, event_id: eventId, redeemed_by: user.id,
    type: 'percent', percent_off: code.percent_off, discount_eur: 0,
  })

  return NextResponse.json({
    ok: true, type: 'percent', percentOff: code.percent_off, duration: code.duration,
    message: `${code.percent_off} % Rabatt aktiviert${code.duration === 'forever' ? ' (dauerhaft)' : ' (erster Monat)'}.`,
  })
}
