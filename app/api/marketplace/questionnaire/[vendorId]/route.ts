import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_SETTINGS, stripPricing,
  type QQuestion, type QSection, type Questionnaire,
} from '@/lib/vendor/questionnaire'

// GET — Fragebogen eines Dienstleisters fuer das Brautpaar, OHNE Preisfelder.
// Bewusst ueber Service-Role + stripPricing, damit die Kalkulation nicht leakt.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { vendorId } = await params
  const admin = createAdminClient()

  // Nur veroeffentlichte, freigegebene Marktplatz-Profile.
  const { data: vendor } = await admin
    .from('dienstleister_profiles')
    .select('id')
    .eq('id', vendorId)
    .eq('is_marketplace', true)
    .eq('published', true)
    .eq('moderation_status', 'approved')
    .maybeSingle()
  if (!vendor) return NextResponse.json({ questionnaire: null })

  const { data: row } = await admin
    .from('vendor_questionnaires')
    .select('*')
    .eq('dienstleister_id', vendorId)
    .maybeSingle()
  if (!row || !row.is_active) return NextResponse.json({ questionnaire: null })

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

  const full: Questionnaire = {
    ...DEFAULT_SETTINGS,
    id: row.id, dienstleister_id: vendorId,
    title: row.title ?? DEFAULT_SETTINGS.title,
    intro_text: row.intro_text ?? '',
    is_active: true,
    sections: assembled,
  }

  return NextResponse.json({ questionnaire: stripPricing(full) })
}
