// Kategorie-Startvorlagen fuer den Fragebogen-Builder. Client-safe (kein
// server-only). Der Dienstleister uebernimmt eine Vorlage als Startpunkt und
// passt sie anschliessend an; gespeichert wird erst beim Speichern im Builder.

import type { QuestionType, QuestionPricing, QuestionnaireSettings } from './questionnaire'

export interface TemplateOption { label: string; price?: number; perGuest?: boolean }
export interface TemplateQuestion {
  type: QuestionType
  label: string
  help_text?: string
  required?: boolean
  options?: TemplateOption[]
  pricing?: QuestionPricing
}
export interface TemplateSection {
  title: string
  description?: string
  questions: TemplateQuestion[]
}
export interface QuestionnaireTemplate {
  settings: Partial<QuestionnaireSettings>
  sections: TemplateSection[]
}

const fotograf: QuestionnaireTemplate = {
  settings: { title: 'Fotografie — Angebotsanfrage', base_price: 1200, min_total: 900, valid_days: 21 },
  sections: [
    {
      title: 'Umfang',
      description: 'Wie viel Begleitung wuenscht ihr euch?',
      questions: [
        { type: 'single', label: 'Gewuenschtes Paket', required: true, options: [
          { label: 'Standesamt (bis 3 Std.)', price: 0 },
          { label: 'Halber Tag (bis 6 Std.)', price: 600 },
          { label: 'Ganzer Tag (bis 12 Std.)', price: 1400 },
        ] },
        { type: 'number', label: 'Zusaetzliche Stunden', help_text: 'Ueber das Paket hinaus', pricing: { mode: 'per_unit', unitPrice: 180 } },
        { type: 'boolean', label: 'Zweiter Fotograf', pricing: { mode: 'fixed', price: 500 } },
      ],
    },
    {
      title: 'Leistungen',
      questions: [
        { type: 'boolean', label: 'Verlobungs-/Paarshooting vorab', pricing: { mode: 'fixed', price: 350 } },
        { type: 'boolean', label: 'Gedrucktes Fotoalbum', pricing: { mode: 'fixed', price: 280 } },
        { type: 'multi', label: 'Zusatzoptionen', options: [
          { label: 'Drohnenaufnahmen', price: 250 },
          { label: 'Same-Day-Edit', price: 400 },
          { label: 'Express-Lieferung (1 Woche)', price: 200 },
        ] },
      ],
    },
    {
      title: 'Details',
      questions: [
        { type: 'text', label: 'Besondere Wuensche / Momente', help_text: 'z. B. First Look, bestimmte Gruppenfotos' },
      ],
    },
  ],
}

const catering: QuestionnaireTemplate = {
  settings: { title: 'Catering — Angebotsanfrage', per_guest_price: 75, min_total: 1500, valid_days: 21 },
  sections: [
    {
      title: 'Verpflegung',
      questions: [
        { type: 'single', label: 'Art des Essens', required: true, options: [
          { label: 'Flying Buffet', price: 0 },
          { label: 'Buffet', price: 0 },
          { label: '3-Gang-Menue (Service)', price: 0 },
          { label: '4-Gang-Menue (Service)', price: 0 },
        ] },
        { type: 'number', label: 'Anzahl Kinder (ermaessigt)', pricing: { mode: 'per_unit', unitPrice: -35 } },
        { type: 'multi', label: 'Diaetische Optionen', options: [
          { label: 'Vegetarisch', price: 0 },
          { label: 'Vegan', price: 0 },
          { label: 'Glutenfrei', price: 0 },
          { label: 'Halal', price: 0 },
        ] },
      ],
    },
    {
      title: 'Getraenke & Service',
      questions: [
        { type: 'boolean', label: 'Getraenkepauschale', pricing: { mode: 'fixed', price: 0 } },
        { type: 'boolean', label: 'Servicepersonal stellen', pricing: { mode: 'fixed', price: 600 } },
        { type: 'boolean', label: 'Geschirr & Glaeser inkl.', pricing: { mode: 'fixed', price: 350 } },
      ],
    },
    {
      title: 'Details',
      questions: [
        { type: 'text', label: 'Allergien / besondere Wuensche' },
      ],
    },
  ],
}

const dj_musik: QuestionnaireTemplate = {
  settings: { title: 'DJ / Musik — Angebotsanfrage', base_price: 900, min_total: 700, valid_days: 21 },
  sections: [
    {
      title: 'Einsatz',
      questions: [
        { type: 'number', label: 'Geplante Spielstunden', help_text: 'inkl. Standardpaket 6 Std.', pricing: { mode: 'per_unit', unitPrice: 120 } },
        { type: 'boolean', label: 'Sektempfang beschallen', pricing: { mode: 'fixed', price: 200 } },
        { type: 'boolean', label: 'Freie Trauung beschallen (Technik + Mikro)', pricing: { mode: 'fixed', price: 350 } },
      ],
    },
    {
      title: 'Technik',
      questions: [
        { type: 'single', label: 'Licht', options: [
          { label: 'Standard', price: 0 },
          { label: 'Erweitert (Movingheads)', price: 300 },
          { label: 'Premium (inkl. Uplights)', price: 600 },
        ] },
        { type: 'boolean', label: 'Nebelmaschine', pricing: { mode: 'fixed', price: 80 } },
      ],
    },
    {
      title: 'Musikwunsch',
      questions: [
        { type: 'text', label: 'Lieblings-Genres / Must-plays' },
        { type: 'text', label: 'No-Gos' },
      ],
    },
  ],
}

const floristik: QuestionnaireTemplate = {
  settings: { title: 'Floristik — Angebotsanfrage', min_total: 500, valid_days: 21 },
  sections: [
    {
      title: 'Hauptelemente',
      questions: [
        { type: 'boolean', label: 'Brautstrauss', pricing: { mode: 'fixed', price: 120 } },
        { type: 'number', label: 'Anzahl Tischgestecke', pricing: { mode: 'per_unit', unitPrice: 45 } },
        { type: 'boolean', label: 'Traubogen / Altar', pricing: { mode: 'fixed', price: 350 } },
      ],
    },
    {
      title: 'Stil',
      questions: [
        { type: 'single', label: 'Stilrichtung', options: [
          { label: 'Klassisch', price: 0 },
          { label: 'Boho', price: 0 },
          { label: 'Modern / minimalistisch', price: 0 },
        ] },
        { type: 'text', label: 'Wunschfarben' },
      ],
    },
  ],
}

const generic: QuestionnaireTemplate = {
  settings: { title: 'Angebotsanfrage', valid_days: 14 },
  sections: [
    {
      title: 'Euer Bedarf',
      questions: [
        { type: 'text', label: 'Was duerfen wir fuer euch tun?', required: true },
        { type: 'number', label: 'Ungefaehre Stundenanzahl', pricing: { mode: 'per_unit', unitPrice: 0 } },
      ],
    },
    {
      title: 'Details',
      questions: [
        { type: 'text', label: 'Besondere Wuensche oder offene Fragen' },
      ],
    },
  ],
}

export const QUESTIONNAIRE_TEMPLATES: Record<string, QuestionnaireTemplate> = {
  fotograf,
  videograf: fotograf,
  catering,
  dj_musik,
  band: dj_musik,
  floristik,
  deko: floristik,
}

export function templateForCategory(category: string | null | undefined): QuestionnaireTemplate {
  if (category && QUESTIONNAIRE_TEMPLATES[category]) return QUESTIONNAIRE_TEMPLATES[category]
  return generic
}
