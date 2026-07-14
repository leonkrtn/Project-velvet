import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recomputeTotals, type LineItem } from '@/lib/vendor/pricing'
import { notifyOfferDecision } from '@/lib/vendor/offer-notify'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaxMode } from '@/lib/vendor/questionnaire'
import { toUserMessage } from '@/lib/errors'

const COUPLE_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

async function loadVisible(admin: SupabaseClient, offerId: string, userId: string) {
  const { data: offer } = await admin.from('vendor_offers').select('*').eq('id', offerId).maybeSingle()
  if (!offer) return { offer: null as null }
  const { data: member } = await admin
    .from('event_members').select('role').eq('event_id', offer.event_id).eq('user_id', userId).maybeSingle()
  if (!member || !COUPLE_ROLES.includes(member.role)) return { forbidden: true as const }
  return { offer }
}

// GET — Detail (nur ab Freigabe sichtbar).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { offerId } = await params

  const admin = createAdminClient()
  const res = await loadVisible(admin, offerId, user.id)
  if ('forbidden' in res) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  if (!res.offer || res.offer.status === 'draft' || res.offer.status === 'superseded') {
    return NextResponse.json({ offer: null })
  }

  // Anbietername fuer die Anzeige.
  const { data: v } = await admin
    .from('dienstleister_profiles').select('name, company_name').eq('id', res.offer.dienstleister_id).maybeSingle()
  return NextResponse.json({ offer: { ...res.offer, vendor_name: (v?.company_name || v?.name || 'Dienstleister') } })
}

// PATCH — { action: 'accept'|'decline'|'select', acceptedByName?, agbAccepted?, selections? }
//   select: nur optionale Positionen zu-/abwaehlen (vor der Annahme).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { offerId } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = body.action as string

  const admin = createAdminClient()
  const res = await loadVisible(admin, offerId, user.id)
  if ('forbidden' in res) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const offer = res.offer
  if (!offer || offer.status === 'draft' || offer.status === 'superseded') {
    return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  }

  // Optionale Positionen anhand der Brautpaar-Auswahl aktualisieren + Totals neu.
  function applySelections(): LineItem[] {
    const items = (offer.line_items as LineItem[]) ?? []
    const sel = (body.selections ?? {}) as Record<string, boolean>
    return items.map((li, i) => li.type === 'optional' ? { ...li, selected: sel[String(i)] !== false } : li)
  }
  function totalsFor(items: LineItem[]) {
    return recomputeTotals(items, {
      taxMode: offer.tax_mode as TaxMode, taxRate: Number(offer.tax_rate ?? 0),
      currency: offer.currency ?? 'EUR', validUntil: offer.valid_until ?? null, footerNote: offer.footer_note ?? '',
    })
  }

  if (action === 'select') {
    if (offer.status !== 'released') return NextResponse.json({ error: 'Angebot ist nicht offen' }, { status: 409 })
    const t = totalsFor(applySelections())
    const { error } = await admin.from('vendor_offers').update({
      line_items: t.lineItems, subtotal: t.subtotal, tax_amount: t.taxAmount, total: t.total,
      updated_at: new Date().toISOString(),
    }).eq('id', offer.id)
    if (error) return NextResponse.json({ error: toUserMessage(error, 'Die Auswahl konnte nicht gespeichert werden.') }, { status: 500 })
    return NextResponse.json({ success: true, total: t.total })
  }

  if (action === 'accept') {
    if (offer.status !== 'released') return NextResponse.json({ error: 'Angebot ist nicht offen' }, { status: 409 })
    const name = (body.acceptedByName as string)?.trim()
    if (!name) return NextResponse.json({ error: 'Bitte gebt euren Namen zur Bestätigung an.' }, { status: 400 })
    if (offer.agb_required && body.agbAccepted !== true) {
      return NextResponse.json({ error: 'Bitte bestätigt die AGB / Stornobedingungen.' }, { status: 400 })
    }

    const t = totalsFor(applySelections())
    const now = new Date().toISOString()
    const { error } = await admin.from('vendor_offers').update({
      status: 'accepted', accepted_at: now, accepted_by_name: name, agb_accepted_at: now,
      line_items: t.lineItems, subtotal: t.subtotal, tax_amount: t.taxAmount, total: t.total,
      updated_at: now,
    }).eq('id', offer.id)
    if (error) return NextResponse.json({ error: toUserMessage(error, 'Das Angebot konnte nicht angenommen werden.') }, { status: 500 })

    await notifyOfferDecision(admin, { ...offer, total: t.total } as never, 'accepted', user.id, name)
    return NextResponse.json({ success: true })
  }

  if (action === 'decline') {
    if (offer.status !== 'released') return NextResponse.json({ error: 'Angebot ist nicht offen' }, { status: 409 })
    const { error } = await admin.from('vendor_offers')
      .update({ status: 'declined', declined_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', offer.id)
    if (error) return NextResponse.json({ error: toUserMessage(error, 'Das Angebot konnte nicht abgelehnt werden.') }, { status: 500 })
    await notifyOfferDecision(admin, offer as never, 'declined', user.id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
