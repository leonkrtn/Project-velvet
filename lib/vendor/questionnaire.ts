// Geteilte Typen & Helfer fuer Dienstleister-Frageboegen und Auto-Angebote.
// KEIN server-only Import: wird sowohl serverseitig (APIs, PDF) als auch im
// Builder-/Brautpaar-Client verwendet. Preisfelder duerfen jedoch NIE an das
// Brautpaar gehen — dafuer gibt es stripPricing() + die Service-Role-API.

export type QuestionType = 'text' | 'single' | 'multi' | 'number' | 'boolean' | 'date'
export type TaxMode = 'regular' | 'kleinunternehmer' | 'none'
export type TravelMode = 'none' | 'zones' | 'km' | 'both'

/** Mengenstaffel fuer den Pro-Gast-Preis (global) bzw. eine Mengen-Frage. */
export interface PriceTier {
  /** Untergrenze (inklusive). */
  min: number
  /** Obergrenze (inklusive). null = offen nach oben. */
  max: number | null
  /** Preis je Einheit (Gast bzw. Mengeneinheit) in dieser Stufe. */
  unitPrice: number
}

/** Saison-/Datumsregel: Auf-/Abschlag in einem Datumsbereich. */
export interface SeasonRule {
  id: string
  label: string
  /** 'YYYY-MM-DD' (festes Datum) oder 'MM-DD' (jaehrlich wiederkehrend). */
  from: string
  to: string
  mode: 'percent' | 'flat'
  /** percent: Prozent auf die bisherige Summe · flat: Pauschalbetrag. */
  value: number
}

/** Anfahrts-Zone nach PLZ-Praefix. */
export interface TravelZone {
  plzPrefix: string
  label: string
  price: number
}

export interface QOption {
  id: string
  label: string
  /** Aufschlag in Waehrungseinheiten, wenn diese Option gewaehlt wird. */
  price?: number
  /** Wenn true: `price` gilt pro Gast (× Gaestezahl) statt einmalig. */
  perGuest?: boolean
}

export interface QuestionPricing {
  mode?: 'none' | 'per_unit' | 'fixed'
  /** Preis je Einheit (type=number, mode=per_unit). */
  unitPrice?: number
  /** Fixer Aufschlag (type=boolean, mode=fixed, wenn Antwort = Ja). */
  price?: number
  /** boolean: `price` gilt pro Gast (× Gaestezahl) statt einmalig. */
  perGuest?: boolean
  /** number: Bezeichnung der Einheit fuer Anzeige (z. B. „Stunden", „qm"). */
  unitLabel?: string
  /** number: Eingabe-Grenzen / Schrittweite fuer das Brautpaar-Formular. */
  min?: number
  max?: number
  step?: number
  /** Erzeugte Angebotsposition(en) sind optional (Brautpaar kann ab-/zuwaehlen). */
  optional?: boolean
  /**
   * number, mode=per_unit: Mengenstaffeln. Greift statt unitPrice, wenn die
   * eingegebene Menge in eine Stufe faellt. Leer = fester unitPrice.
   */
  tiers?: PriceTier[]
}

export interface QQuestion {
  id: string
  section_id: string
  type: QuestionType
  label: string
  help_text: string
  required: boolean
  options: QOption[]
  pricing: QuestionPricing
  sort_order: number
}

export interface QSection {
  id: string
  title: string
  description: string
  sort_order: number
  questions: QQuestion[]
}

export interface QuestionnaireSettings {
  title: string
  intro_text: string
  is_active: boolean
  base_price: number
  per_guest_price: number
  min_total: number
  weekend_surcharge_pct: number
  tax_mode: TaxMode
  tax_rate: number
  currency: string
  valid_days: number
  footer_note: string
  // ── Preis-Engine (Migration 0120) ──
  /** Mengenstaffeln auf die Gaestezahl. Greift statt per_guest_price. */
  guest_tiers: PriceTier[]
  /** Saison-/Datumsregeln (Auf-/Abschlag). Zusaetzlich zum Wochenend-Aufschlag. */
  season_rules: SeasonRule[]
  travel_mode: TravelMode
  travel_zones: TravelZone[]
  travel_km_price: number
  travel_free_radius_km: number
  travel_base_postal_code: string
  /** Beratungs-Modus: kein Auto-Angebot; Anfrage oeffnet Chat + Terminvorschlag. */
  consult_mode: boolean
}

export interface Questionnaire extends QuestionnaireSettings {
  id: string
  dienstleister_id: string
  sections: QSection[]
}

export const DEFAULT_SETTINGS: QuestionnaireSettings = {
  title: 'Angebotsanfrage',
  intro_text: '',
  is_active: false,
  base_price: 0,
  per_guest_price: 0,
  min_total: 0,
  weekend_surcharge_pct: 0,
  tax_mode: 'regular',
  tax_rate: 19,
  currency: 'EUR',
  valid_days: 14,
  footer_note: 'Dieses Angebot ist freibleibend und unverbindlich.',
  guest_tiers: [],
  season_rules: [],
  travel_mode: 'none',
  travel_zones: [],
  travel_km_price: 0,
  travel_free_radius_km: 0,
  travel_base_postal_code: '',
  consult_mode: false,
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Freitext',
  single: 'Einzelauswahl',
  multi: 'Mehrfachauswahl',
  number: 'Zahl / Menge',
  boolean: 'Ja / Nein',
  date: 'Datum',
}

export const TAX_MODE_LABELS: Record<TaxMode, string> = {
  regular: 'Regelbesteuerung (USt. ausweisen)',
  kleinunternehmer: 'Kleinunternehmer (§19 UStG, keine USt.)',
  none: 'Keine USt. ausweisen',
}

// ── Antworten ────────────────────────────────────────────────────────────────
export interface Answer {
  questionId: string
  sectionTitle: string
  label: string
  type: QuestionType
  /** Rohwert: string | number | boolean | string[] (Option-IDs bei multi). */
  value: unknown
  /** Menschlich lesbare Darstellung fuer Zusammenfassung + PDF. */
  display: string
}

// Oeffentliche (preislose) Sicht fuer das Brautpaar.
export interface PublicQOption { id: string; label: string }
export interface PublicQQuestion {
  id: string
  section_id: string
  type: QuestionType
  label: string
  help_text: string
  required: boolean
  options: PublicQOption[]
  /** Nur Anzeige-/Eingabehilfen (kein Preis-Leak) fuer type=number. */
  unitLabel?: string
  min?: number
  max?: number
  step?: number
}
export interface PublicQSection {
  id: string
  title: string
  description: string
  questions: PublicQQuestion[]
}
export interface PublicQuestionnaire {
  title: string
  intro_text: string
  sections: PublicQSection[]
}

/** Entfernt jede Preisinformation aus dem Fragebogen (Brautpaar-Sicht). */
export function stripPricing(q: Questionnaire): PublicQuestionnaire {
  return {
    title: q.title,
    intro_text: q.intro_text,
    sections: q.sections.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      questions: s.questions.map(qq => ({
        id: qq.id,
        section_id: qq.section_id,
        type: qq.type,
        label: qq.label,
        help_text: qq.help_text,
        required: qq.required,
        options: qq.options.map(o => ({ id: o.id, label: o.label })),
        // Nur sichere Anzeige-/Eingabehilfen — niemals Preisfelder.
        ...(qq.type === 'number' ? {
          unitLabel: qq.pricing?.unitLabel,
          min: qq.pricing?.min,
          max: qq.pricing?.max,
          step: qq.pricing?.step,
        } : {}),
      })),
    })),
  }
}

export function formatMoney(value: number, currency = 'EUR'): string {
  const v = Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(v)
  } catch {
    // Ungueltiger Waehrungscode (Freitext-Feld) -> sichere Ersatzdarstellung.
    return `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim()
  }
}
