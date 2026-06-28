import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadFullQuestionnaire, normalizeAnswers } from '@/lib/vendor/load'
import { buildStandardInfo } from '@/lib/vendor/standard-info'
import { computeOffer } from '@/lib/vendor/pricing'
import { ensureVendorConversation } from '@/lib/vendor/ensureChat'

const REQUESTER_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

async function assertEventMember(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }
  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member || !REQUESTER_ROLES.includes(member.role)) {
    return { error: NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 }) }
  }
  return { user }
}

// GET — Anfragen eines Events (für das Brautpaar). Query: ?eventId=
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId fehlt' }, { status: 400 })
  const access = await assertEventMember(eventId)
  if (access.error) return access.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketplace_requests')
    .select('id, dienstleister_id, message, budget, status, conversation_id, created_at, responded_at, dienstleister_profiles(name, company_name, category)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

// POST — neue Anfrage an einen Vendor. Body: { eventId, dienstleisterId, message, budget? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const eventId = body.eventId as string
  const dienstleisterId = body.dienstleisterId as string
  if (!eventId || !dienstleisterId) {
    return NextResponse.json({ error: 'eventId und dienstleisterId erforderlich' }, { status: 400 })
  }
  const access = await assertEventMember(eventId)
  if (access.error) return access.error

  const admin = createAdminClient()
  // Vendor muss ein veröffentlichtes Marktplatz-Profil sein
  const { data: vendor } = await admin
    .from('dienstleister_profiles')
    .select('id')
    .eq('id', dienstleisterId)
    .eq('is_marketplace', true)
    .eq('published', true)
    .eq('moderation_status', 'approved')
    .maybeSingle()
  if (!vendor) return NextResponse.json({ error: 'Dienstleister nicht verfügbar' }, { status: 404 })

  // Bereits offene Anfrage? — Duplikate vermeiden
  const { data: existing } = await admin
    .from('marketplace_requests')
    .select('id')
    .eq('event_id', eventId)
    .eq('dienstleister_id', dienstleisterId)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Es besteht bereits eine offene Anfrage', id: existing.id }, { status: 409 })

  const budgetRaw = body.budget
  const budget = typeof budgetRaw === 'number' ? budgetRaw
    : (typeof budgetRaw === 'string' && budgetRaw.trim() ? parseFloat(budgetRaw) : null)

  // Aktiven Fragebogen laden (falls vorhanden) und Antworten normalisieren.
  // Ohne Fragebogen bleibt es bei der klassischen Freitext-Anfrage (Fallback).
  const questionnaire = await loadFullQuestionnaire(admin, dienstleisterId)
  const hasQuestionnaire = !!questionnaire && questionnaire.is_active && questionnaire.sections.length > 0
  // Beratungs-Modus: Fragebogen dient nur als Briefing, KEIN Auto-Angebot.
  const consultMode = hasQuestionnaire && questionnaire!.consult_mode === true

  const rawAnswers = (body.answers && typeof body.answers === 'object') ? body.answers as Record<string, unknown> : {}
  let normalized: ReturnType<typeof normalizeAnswers> | null = null
  if (hasQuestionnaire) {
    normalized = normalizeAnswers(questionnaire!, rawAnswers)
    if (normalized.missingRequired.length > 0) {
      return NextResponse.json(
        { error: `Bitte beantworte alle Pflichtfragen: ${normalized.missingRequired.join(', ')}` },
        { status: 400 },
      )
    }
  }

  const { data, error } = await admin
    .from('marketplace_requests')
    .insert({
      event_id: eventId,
      dienstleister_id: dienstleisterId,
      requested_by: access.user.id,
      message: (body.message as string)?.trim() || '',
      budget: Number.isFinite(budget as number) ? budget : null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-Angebot (draft) erzeugen — nur Dienstleister sieht es, bis er freigibt.
  // Im Beratungs-Modus entfaellt das; stattdessen wird direkt ein Chat eroeffnet,
  // damit der Dienstleister ein Erstgespraech / einen Termin vorschlagen kann.
  if (hasQuestionnaire && normalized && !consultMode) {
    const standardInfo = await buildStandardInfo(admin, eventId)
    if (budget != null && Number.isFinite(budget as number)) standardInfo.budget = budget as number
    const totals = computeOffer(questionnaire!, normalized.answers, standardInfo)
    const { error: offerErr } = await admin.from('vendor_offers').insert({
      request_id: data.id,
      event_id: eventId,
      dienstleister_id: dienstleisterId,
      status: 'draft',
      answers: normalized.answers,
      standard_info: standardInfo,
      line_items: totals.lineItems,
      subtotal: totals.subtotal,
      tax_mode: totals.taxMode,
      tax_rate: totals.taxRate,
      tax_amount: totals.taxAmount,
      total: totals.total,
      currency: totals.currency,
      valid_until: totals.validUntil,
      footer_note: totals.footerNote,
    })
    // Schlaegt die Angebotserstellung fehl, bleibt die Anfrage als Freitext bestehen.
    if (offerErr) console.error('vendor_offers insert failed', offerErr.message)
  }

  if (consultMode) {
    // Vendor-Auth-User ermitteln und Chat oeffnen (best effort).
    const { data: link } = await admin
      .from('user_dienstleister')
      .select('user_id')
      .eq('dienstleister_id', dienstleisterId)
      .limit(1)
      .maybeSingle()
    if (link?.user_id) {
      const convId = await ensureVendorConversation(admin, eventId, link.user_id)
      if (convId) {
        await admin.from('marketplace_requests').update({ conversation_id: convId }).eq('id', data.id)
        await admin.from('messages').insert({
          conversation_id: convId,
          event_id: eventId,
          sender_id: link.user_id,
          content: 'Vielen Dank für eure Anfrage! Für dieses Angebot vereinbaren wir am liebsten ein persönliches Erstgespräch — wir schlagen euch in Kürze einen Termin vor.',
          message_type: 'text',
        })
        await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
      }
    }
  }

  return NextResponse.json({ success: true, id: data.id, hasOffer: hasQuestionnaire && !consultMode, consult: consultMode })
}
