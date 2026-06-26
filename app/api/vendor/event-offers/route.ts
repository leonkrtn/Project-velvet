import { NextRequest, NextResponse } from 'next/server'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import { loadFullQuestionnaire } from '@/lib/vendor/load'
import { buildStandardInfo } from '@/lib/vendor/standard-info'
import { computeOffer } from '@/lib/vendor/pricing'
import { DEFAULT_SETTINGS } from '@/lib/vendor/questionnaire'
import type { SupabaseClient } from '@supabase/supabase-js'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Stellt sicher, dass der eingeloggte Dienstleister Mitglied dieses Events ist.
async function assertEventVendor(admin: SupabaseClient, eventId: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data && data.role === 'dienstleister'
}

// GET ?eventId= — alle eigenen Angebote dieses Events (alle Status).
export async function GET(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId, userId } = auth.ctx
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })
  if (!(await assertEventVendor(admin, eventId, userId))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const [{ data: offers }, { data: profile }] = await Promise.all([
    admin
      .from('vendor_offers')
      .select('id, title, status, version, parent_offer_id, total, currency, valid_until, request_id, created_at, updated_at, released_at, accepted_at')
      .eq('event_id', eventId)
      .eq('dienstleister_id', vendorId)
      .order('created_at', { ascending: false }),
    admin.from('dienstleister_profiles').select('category').eq('id', vendorId).maybeSingle(),
  ])

  return NextResponse.json({ offers: offers ?? [], category: profile?.category ?? null })
}

// POST — neues Angebot anlegen.
// body: { eventId?: string|null, source: 'questionnaire'|'blank'|'duplicate', fromOfferId?, requestId?, title? }
// eventId may be null/omitted for standalone offers (not linked to an event).
export async function POST(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId, userId } = auth.ctx
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const eventId: string | null = (body.eventId as string) || null
  const source = (body.source as string) || 'blank'

  // If eventId provided, verify membership
  if (eventId && !(await assertEventVendor(admin, eventId, userId))) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  let row: Record<string, unknown> = {
    event_id: eventId,
    dienstleister_id: vendorId,
    created_by: userId,
    status: 'draft',
    request_id: (body.requestId as string) || null,
    title: (body.title as string)?.trim() || 'Angebot',
  }

  if (source === 'duplicate') {
    const fromId = body.fromOfferId as string
    const { data: src } = await admin.from('vendor_offers').select('*').eq('id', fromId).maybeSingle()
    if (!src || src.dienstleister_id !== vendorId || (eventId && src.event_id !== eventId)) {
      return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 })
    }
    row = {
      ...row,
      title: (body.title as string)?.trim() || `${src.title} (Kopie)`,
      answers: src.answers, standard_info: src.standard_info,
      line_items: src.line_items, subtotal: src.subtotal,
      tax_mode: src.tax_mode, tax_rate: src.tax_rate, tax_amount: src.tax_amount,
      total: src.total, currency: src.currency, valid_until: src.valid_until,
      footer_note: src.footer_note, vendor_notes: src.vendor_notes,
      deposit_type: src.deposit_type, deposit_value: src.deposit_value,
      deposit_due_days: src.deposit_due_days, balance_due_note: src.balance_due_note,
      payment_terms: src.payment_terms, agb_text: src.agb_text, agb_required: src.agb_required,
    }
  } else if (source === 'questionnaire') {
    const q = await loadFullQuestionnaire(admin, vendorId)
    const info = eventId ? await buildStandardInfo(admin, eventId) : {}
    if (q) {
      const totals = computeOffer(q, [], info)
      row = {
        ...row, standard_info: info,
        line_items: totals.lineItems, subtotal: totals.subtotal,
        tax_mode: totals.taxMode, tax_rate: totals.taxRate, tax_amount: totals.taxAmount,
        total: totals.total, currency: totals.currency, valid_until: totals.validUntil,
        footer_note: totals.footerNote,
      }
    } else {
      row = { ...row, standard_info: info }
    }
  } else {
    // blank
    const info = eventId ? await buildStandardInfo(admin, eventId).catch(() => ({})) : {}
    const q = await loadFullQuestionnaire(admin, vendorId).catch(() => null)
    row = {
      ...row, standard_info: info, line_items: [],
      tax_mode: q?.tax_mode ?? DEFAULT_SETTINGS.tax_mode,
      tax_rate: q?.tax_rate ?? DEFAULT_SETTINGS.tax_rate,
      currency: q?.currency ?? DEFAULT_SETTINGS.currency,
      footer_note: q?.footer_note ?? DEFAULT_SETTINGS.footer_note,
    }
  }

  const { data: created, error } = await admin.from('vendor_offers').insert(row).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: created.id, eventId })
}
