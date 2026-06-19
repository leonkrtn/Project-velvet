// app/api/wedding/[eventId]/publish/route.ts
// Veröffentlicht den aktuellen Entwurf: kopiert draft_content → published_content,
// setzt status='published'. Erfordert einen gesetzten Slug.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEventRole } from '@/lib/files/permissions'
import { normalizeContent } from '@/lib/wedding/content'

const EDIT_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

export async function POST(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const role = await getEventRole(supabase, user.id, eventId)
  if (!role || !EDIT_ROLES.includes(role)) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const admin = createAdminClient()
  const { data: site } = await admin.from('wedding_sites').select('*').eq('event_id', eventId).maybeSingle()
  if (!site) return NextResponse.json({ error: 'Keine Website vorhanden' }, { status: 404 })
  if (!site.slug) return NextResponse.json({ error: 'Bitte zuerst einen Link (Slug) festlegen.', field: 'slug' }, { status: 400 })

  const { data: ev } = await admin.from('events').select('couple_name, title').eq('id', eventId).maybeSingle()
  const coupleName = (ev?.couple_name?.trim()) || (ev?.title?.trim()) || ''
  const published = normalizeContent(site.draft_content, coupleName)

  const { error } = await admin
    .from('wedding_sites')
    .update({ published_content: published, status: 'published', is_online: true, published_at: new Date().toISOString() })
    .eq('event_id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, slug: site.slug, url: `/wedding/${site.slug}` })
}
