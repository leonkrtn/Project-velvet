// app/api/rsvp/[token]/geschenk/route.ts
// Guest gift interactions: claim, unclaim, contribute.
// Uses admin client (bypasses RLS) — token validates identity.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface GeschenkPayload {
  action: 'claim' | 'unclaim' | 'contribute'
  wish_id: string
  amount?: number
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })

  let body: GeschenkPayload
  try {
    body = await request.json() as GeschenkPayload
  } catch {
    return NextResponse.json({ error: 'Ungültiger Payload' }, { status: 400 })
  }

  const { action, wish_id } = body
  if (!action || !wish_id) return NextResponse.json({ error: 'action und wish_id erforderlich' }, { status: 400 })

  const admin = createAdminClient()

  // Verify token → guest
  const { data: guest, error: gErr } = await admin
    .from('guests')
    .select('id, event_id, token')
    .eq('token', token)
    .maybeSingle()

  if (gErr)   return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!guest) return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })

  // Verify wish belongs to same event
  const { data: wish, error: wErr } = await admin
    .from('geschenk_wuensche')
    .select('id, event_id, status, claimed_by_token, is_money_wish')
    .eq('id', wish_id)
    .maybeSingle()

  if (wErr)   return NextResponse.json({ error: wErr.message }, { status: 500 })
  if (!wish)  return NextResponse.json({ error: 'Wunsch nicht gefunden' }, { status: 404 })
  if (wish.event_id !== guest.event_id) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })

  if (action === 'claim') {
    if (wish.is_money_wish) return NextResponse.json({ error: 'Geldwunsch kann nicht reserviert werden' }, { status: 400 })
    // Atomic: only update if still available
    const { data, error } = await admin
      .from('geschenk_wuensche')
      .update({ status: 'vergeben', claimed_by_token: token })
      .eq('id', wish_id)
      .eq('status', 'verfuegbar')
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) return NextResponse.json({ error: 'Bereits vergeben' }, { status: 409 })

    return NextResponse.json({ ok: true })
  }

  if (action === 'unclaim') {
    const { error } = await admin
      .from('geschenk_wuensche')
      .update({ status: 'verfuegbar', claimed_by_token: null })
      .eq('id', wish_id)
      .eq('claimed_by_token', token)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'contribute') {
    if (!wish.is_money_wish) return NextResponse.json({ error: 'Nur für Geldwünsche' }, { status: 400 })
    const amount = Number(body.amount)
    if (isNaN(amount) || amount <= 0) return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 })

    const { error } = await admin
      .from('geschenk_beitraege')
      .upsert(
        { wish_id, guest_token: token, amount },
        { onConflict: 'wish_id,guest_token' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
