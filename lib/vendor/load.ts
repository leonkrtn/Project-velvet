// Server-only: laedt den vollstaendigen Fragebogen (inkl. Preisfelder) eines
// Dienstleisters. Genutzt beim Erzeugen und Neuberechnen von Angeboten.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_SETTINGS,
  type Answer, type QQuestion, type QSection, type Questionnaire, type TaxMode,
  type TravelMode, type PriceTier, type SeasonRule, type TravelZone,
} from './questionnaire'

const TAX_MODES: TaxMode[] = ['regular', 'kleinunternehmer', 'none']
const TRAVEL_MODES: TravelMode[] = ['none', 'zones', 'km', 'both']
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : [] }
function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : fallback
}

export async function loadFullQuestionnaire(
  admin: SupabaseClient,
  vendorId: string,
): Promise<Questionnaire | null> {
  const { data: row } = await admin
    .from('vendor_questionnaires')
    .select('*')
    .eq('dienstleister_id', vendorId)
    .maybeSingle()
  if (!row) return null

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

  return {
    ...DEFAULT_SETTINGS,
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
}

// Normalisiert eingehende Brautpaar-Antworten gegen den Fragebogen und baut
// die menschenlesbare Darstellung (display) fuer Zusammenfassung + PDF.
export function normalizeAnswers(q: Questionnaire, raw: Record<string, unknown>): { answers: Answer[]; missingRequired: string[] } {
  const answers: Answer[] = []
  const missingRequired: string[] = []

  for (const section of q.sections) {
    for (const question of section.questions) {
      const v = raw[question.id]
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
      if (empty) {
        if (question.required) missingRequired.push(question.label)
        continue
      }

      let display = ''
      let value: unknown = v
      switch (question.type) {
        case 'single': {
          const opt = question.options.find(o => o.id === v)
          display = opt?.label ?? String(v)
          break
        }
        case 'multi': {
          const ids = Array.isArray(v) ? v : [v]
          value = ids
          display = ids.map(id => question.options.find(o => o.id === id)?.label ?? String(id)).join(', ')
          break
        }
        case 'boolean': {
          value = v === true || v === 'true'
          display = value ? 'Ja' : 'Nein'
          break
        }
        case 'number': {
          value = num(v)
          display = String(value)
          break
        }
        default:
          display = String(v)
      }

      answers.push({
        questionId: question.id,
        sectionTitle: section.title,
        label: question.label,
        type: question.type,
        value,
        display,
      })
    }
  }

  return { answers, missingRequired }
}
