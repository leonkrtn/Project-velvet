// Serverseitiges Anlegen eines Anfrageformulars aus der Kategorie-Vorlage.
// Garantiert, dass jeder Marktplatz-Dienstleister immer ein (aktives) Formular
// hat — angelegt bei Profil-Erstellung und faul nachgezogen, falls es fehlt.
// Bestehende Formulare werden NIE überschrieben.

import type { SupabaseClient } from '@supabase/supabase-js'
import { templateForCategory } from '@/lib/vendor/questionnaire-templates'
import { DEFAULT_SETTINGS } from '@/lib/vendor/questionnaire'

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`)

/**
 * Legt das Formular nur an, wenn noch keins existiert. Best effort — wirft nie.
 * `category` optional: wird beim Seeding aus dem Profil nachgeladen, falls nicht übergeben.
 */
export async function ensureQuestionnaire(admin: SupabaseClient, vendorId: string, category?: string | null): Promise<void> {
  try {
    const { data: existing } = await admin
      .from('vendor_questionnaires')
      .select('id')
      .eq('dienstleister_id', vendorId)
      .maybeSingle()
    if (existing) return
    let cat = category
    if (cat === undefined) {
      const { data: prof } = await admin.from('dienstleister_profiles').select('category').eq('id', vendorId).maybeSingle()
      cat = (prof?.category as string) ?? 'sonstiges'
    }
    await seedQuestionnaire(admin, vendorId, cat)
  } catch {
    /* Formular-Seed darf App-Flows nie blockieren. */
  }
}

/** Erzeugt Formular + Abschnitte + Fragen aus der Kategorie-Vorlage (aktiv). */
export async function seedQuestionnaire(admin: SupabaseClient, vendorId: string, category: string | null | undefined): Promise<void> {
  const tpl = templateForCategory(category)
  const s = { ...DEFAULT_SETTINGS, ...tpl.settings }

  const { data: saved } = await admin
    .from('vendor_questionnaires')
    .upsert({
      dienstleister_id: vendorId,
      title: s.title,
      intro_text: s.intro_text ?? '',
      is_active: true, // sofort aktiv — Formular ist garantiert vorhanden
      base_price: s.base_price ?? 0,
      per_guest_price: s.per_guest_price ?? 0,
      min_total: s.min_total ?? 0,
      weekend_surcharge_pct: s.weekend_surcharge_pct ?? 0,
      tax_mode: s.tax_mode ?? 'regular',
      tax_rate: s.tax_rate ?? 19,
      currency: s.currency ?? 'EUR',
      valid_days: s.valid_days ?? 14,
      footer_note: s.footer_note ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'dienstleister_id' })
    .select('id')
    .single()
  if (!saved) return
  const qId = saved.id as string

  for (let si = 0; si < tpl.sections.length; si++) {
    const sec = tpl.sections[si]
    const { data: secRow } = await admin
      .from('vendor_questionnaire_sections')
      .insert({ questionnaire_id: qId, title: sec.title, description: sec.description ?? '', sort_order: si })
      .select('id')
      .single()
    if (!secRow) continue

    const rows = sec.questions.map((q, qi) => ({
      questionnaire_id: qId,
      section_id: secRow.id as string,
      type: q.type,
      label: q.label,
      help_text: q.help_text ?? '',
      required: !!q.required,
      options: (q.options ?? []).map(o => ({ id: uid(), label: o.label, price: o.price ?? 0, perGuest: !!o.perGuest })),
      pricing: q.pricing ?? {},
      sort_order: qi,
    }))
    if (rows.length) await admin.from('vendor_questionnaire_questions').insert(rows)
  }
}
