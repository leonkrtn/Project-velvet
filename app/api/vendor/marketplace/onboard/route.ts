import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureQuestionnaire } from '@/lib/vendor/questionnaire-seed'

// POST — legt (idempotent) das Marktplatz-Profil für den eingeloggten
// Dienstleister an, der sich selbst registriert hat. Wird direkt nach dem
// Signup aufgerufen UND als Fallback beim Betreten des Vendor-Portals.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const admin = createAdminClient()

  // Bereits verknüpft? → bestehendes Profil zurückgeben (idempotent).
  const { data: existing } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ success: true, id: existing.dienstleister_id, created: false })
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const name = (meta.name as string)?.trim() || (user.email?.split('@')[0] ?? 'Dienstleister')
  const category = (meta.category as string)?.trim() || 'sonstiges'
  const companyName = (meta.company_name as string)?.trim() || null

  // profiles.role auf dienstleister setzen (Trigger hat die Zeile angelegt)
  await admin.from('profiles').update({ role: 'dienstleister' }).eq('id', user.id)

  const { data: vendor, error: vErr } = await admin
    .from('dienstleister_profiles')
    .insert({
      name,
      company_name: companyName,
      category,
      email: user.email ?? null,
      is_marketplace: true,
      published: false,
      moderation_status: 'draft',
      // Neue Dienstleister erhalten Anfragen standardmäßig auch per E-Mail
      // (abschaltbar unter /vendor/automatisierungen). Bestehende bleiben unberührt.
      notify_new_request_email: true,
    })
    .select('id')
    .single()
  if (vErr || !vendor) {
    return NextResponse.json({ error: vErr?.message ?? 'Profil konnte nicht erstellt werden' }, { status: 500 })
  }

  await admin.from('user_dienstleister').insert({ user_id: user.id, dienstleister_id: vendor.id })

  // Anfrageformular garantiert anlegen (aus Kategorie-Vorlage, sofort aktiv).
  await ensureQuestionnaire(admin, vendor.id, category)

  return NextResponse.json({ success: true, id: vendor.id, created: true })
}
