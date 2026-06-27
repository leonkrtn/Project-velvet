import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireVendorOwner } from '@/lib/marketplace/owner'
import {
  DEFAULT_SETTINGS,
  type QQuestion, type QSection, type Questionnaire, type QuestionType, type TaxMode,
  type TravelMode, type PriceTier, type SeasonRule, type TravelZone,
} from '@/lib/vendor/questionnaire'

const QUESTION_TYPES: QuestionType[] = ['text', 'single', 'multi', 'number', 'boolean', 'date']
const TAX_MODES: TaxMode[] = ['regular', 'kleinunternehmer', 'none']
const TRAVEL_MODES: TravelMode[] = ['none', 'zones', 'km', 'both']

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : fallback
}
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : [] }

/** Bereinigt eingehende Mengenstaffeln. */
function cleanTiers(v: unknown): PriceTier[] {
  return arr<Record<string, unknown>>(v)
    .map(t => ({
      min: Math.max(0, num(t.min)),
      max: t.max === '' || t.max === null || t.max === undefined ? null : Math.max(0, num(t.max)),
      unitPrice: num(t.unitPrice),
    }))
    .filter(t => t.max === null || t.max >= t.min)
}

// GET — kompletter eigener Fragebogen inkl. Preisfelder.
export async function GET() {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const { data: row } = await admin
    .from('vendor_questionnaires')
    .select('*')
    .eq('dienstleister_id', vendorId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ questionnaire: { ...DEFAULT_SETTINGS, id: null, dienstleister_id: vendorId, sections: [] } })
  }

  const [{ data: sections }, { data: questions }] = await Promise.all([
    admin.from('vendor_questionnaire_sections').select('*').eq('questionnaire_id', row.id).order('sort_order'),
    admin.from('vendor_questionnaire_questions').select('*').eq('questionnaire_id', row.id).order('sort_order'),
  ])

  const bySection: Record<string, QQuestion[]> = {}
  for (const q of (questions ?? [])) {
    ;(bySection[q.section_id] ??= []).push({
      id: q.id, section_id: q.section_id, type: q.type, label: q.label,
      help_text: q.help_text ?? '', required: !!q.required,
      options: Array.isArray(q.options) ? q.options : [],
      pricing: q.pricing && typeof q.pricing === 'object' ? q.pricing : {},
      sort_order: q.sort_order ?? 0,
    })
  }

  const assembled: QSection[] = (sections ?? []).map(s => ({
    id: s.id, title: s.title ?? '', description: s.description ?? '',
    sort_order: s.sort_order ?? 0, questions: bySection[s.id] ?? [],
  }))

  const questionnaire: Questionnaire = {
    id: row.id, dienstleister_id: vendorId,
    title: row.title ?? DEFAULT_SETTINGS.title,
    intro_text: row.intro_text ?? '',
    is_active: !!row.is_active,
    base_price: num(row.base_price),
    per_guest_price: num(row.per_guest_price),
    min_total: num(row.min_total),
    weekend_surcharge_pct: num(row.weekend_surcharge_pct),
    tax_mode: TAX_MODES.includes(row.tax_mode) ? row.tax_mode : 'regular',
    tax_rate: num(row.tax_rate, 19),
    currency: row.currency ?? 'EUR',
    valid_days: Math.round(num(row.valid_days, 14)),
    footer_note: row.footer_note ?? '',
    guest_tiers: arr<PriceTier>(row.guest_tiers),
    season_rules: arr<SeasonRule>(row.season_rules),
    travel_mode: TRAVEL_MODES.includes(row.travel_mode) ? row.travel_mode : 'none',
    travel_zones: arr<TravelZone>(row.travel_zones),
    travel_km_price: num(row.travel_km_price),
    travel_free_radius_km: num(row.travel_free_radius_km),
    travel_base_postal_code: row.travel_base_postal_code ?? '',
    consult_mode: !!row.consult_mode,
    sections: assembled,
  }
  return NextResponse.json({ questionnaire })
}

// PUT — speichert Einstellungen + Abschnitte + Fragen (Replace-Strategie).
// Body: { settings: {...}, sections: [{ title, description, questions: [...] }] }
export async function PUT(req: NextRequest) {
  const auth = await requireVendorOwner()
  if (!auth.ok) return auth.res
  const { admin, vendorId } = auth.ctx

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const s = (body.settings ?? {}) as Record<string, unknown>
  const sections = Array.isArray(body.sections) ? body.sections : []

  const taxMode = TAX_MODES.includes(s.tax_mode as TaxMode) ? (s.tax_mode as TaxMode) : 'regular'
  const settingsRow = {
    dienstleister_id: vendorId,
    title: (s.title as string)?.trim() || DEFAULT_SETTINGS.title,
    intro_text: (s.intro_text as string) ?? '',
    is_active: !!s.is_active,
    base_price: Math.max(0, num(s.base_price)),
    per_guest_price: num(s.per_guest_price),
    min_total: Math.max(0, num(s.min_total)),
    weekend_surcharge_pct: Math.max(0, Math.min(100, num(s.weekend_surcharge_pct))),
    tax_mode: taxMode,
    tax_rate: Math.max(0, Math.min(100, num(s.tax_rate, 19))),
    currency: (s.currency as string)?.trim() || 'EUR',
    valid_days: Math.max(1, Math.round(num(s.valid_days, 14))),
    footer_note: (s.footer_note as string) ?? '',
    // ── Preis-Engine (0120) ──
    guest_tiers: cleanTiers(s.guest_tiers),
    season_rules: arr<Record<string, unknown>>(s.season_rules).map(r => ({
      id: (r.id as string) || randomUUID(),
      label: (r.label as string)?.trim() || '',
      from: (r.from as string) || '',
      to: (r.to as string) || '',
      mode: r.mode === 'flat' ? 'flat' : 'percent',
      value: num(r.value),
    })).filter(r => r.from && r.to),
    travel_mode: TRAVEL_MODES.includes(s.travel_mode as TravelMode) ? (s.travel_mode as TravelMode) : 'none',
    travel_zones: arr<Record<string, unknown>>(s.travel_zones).map(z => ({
      plzPrefix: String(z.plzPrefix ?? '').trim(),
      label: (z.label as string)?.trim() || '',
      price: num(z.price),
    })).filter(z => z.plzPrefix),
    travel_km_price: Math.max(0, num(s.travel_km_price)),
    travel_free_radius_km: Math.max(0, num(s.travel_free_radius_km)),
    travel_base_postal_code: String(s.travel_base_postal_code ?? '').trim(),
    consult_mode: !!s.consult_mode,
    updated_at: new Date().toISOString(),
  }

  const { data: saved, error: upErr } = await admin
    .from('vendor_questionnaires')
    .upsert(settingsRow, { onConflict: 'dienstleister_id' })
    .select('id')
    .single()
  if (upErr || !saved) return NextResponse.json({ error: upErr?.message ?? 'Speichern fehlgeschlagen' }, { status: 500 })

  const qId = saved.id as string

  // Vorhandene Abschnitte (und per Cascade die Fragen) ersetzen.
  await admin.from('vendor_questionnaire_sections').delete().eq('questionnaire_id', qId)

  for (let si = 0; si < sections.length; si++) {
    const sec = (sections[si] ?? {}) as Record<string, unknown>
    const { data: secRow, error: secErr } = await admin
      .from('vendor_questionnaire_sections')
      .insert({
        questionnaire_id: qId,
        title: (sec.title as string)?.trim() || `Abschnitt ${si + 1}`,
        description: (sec.description as string) ?? '',
        sort_order: si,
      })
      .select('id')
      .single()
    if (secErr || !secRow) continue

    const qs = Array.isArray(sec.questions) ? sec.questions : []
    const rows = qs.map((qq: Record<string, unknown>, qi: number) => {
      const type: QuestionType = QUESTION_TYPES.includes(qq.type as QuestionType) ? (qq.type as QuestionType) : 'text'
      const rawOptions = Array.isArray(qq.options) ? qq.options : []
      const options = (type === 'single' || type === 'multi')
        ? rawOptions.map((o: Record<string, unknown>) => ({
            id: (o.id as string) || randomUUID(),
            label: (o.label as string)?.trim() || 'Option',
            price: num(o.price),
            perGuest: !!o.perGuest,
          }))
        : []
      const rawPricing = (qq.pricing ?? {}) as Record<string, unknown>
      const optional = !!rawPricing.optional
      const optNum = (v: unknown): number | undefined => {
        if (v === '' || v === null || v === undefined) return undefined
        const n = num(v); return Number.isFinite(n) ? n : undefined
      }
      const pricing = type === 'number'
        ? {
            mode: 'per_unit', unitPrice: num(rawPricing.unitPrice),
            unitLabel: (rawPricing.unitLabel as string)?.trim() || undefined,
            min: optNum(rawPricing.min), max: optNum(rawPricing.max), step: optNum(rawPricing.step),
            tiers: cleanTiers(rawPricing.tiers),
            optional,
          }
        : type === 'boolean'
          ? { mode: 'fixed', price: num(rawPricing.price), perGuest: !!rawPricing.perGuest, optional }
          : (type === 'single' || type === 'multi')
            ? { optional }
            : {}
      return {
        questionnaire_id: qId,
        section_id: secRow.id,
        type,
        label: (qq.label as string)?.trim() || 'Frage',
        help_text: (qq.help_text as string) ?? '',
        required: !!qq.required,
        options,
        pricing,
        sort_order: qi,
      }
    })
    if (rows.length) await admin.from('vendor_questionnaire_questions').insert(rows)
  }

  return NextResponse.json({ success: true, id: qId })
}
