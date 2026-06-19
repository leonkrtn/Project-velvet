// app/api/wedding/public/[slug]/rsvp/lookup/route.ts
// Öffentlich (token-/code-basiert): Gast über seinen 4-stelligen short_code dem Event
// der Hochzeitswebsite zuordnen und den RSVP-Token zurückgeben.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  let body: { code?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Ungültiger Payload' }, { status: 400 }) }

  const code = (body.code ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    return NextResponse.json({ error: 'Bitte gib einen gültigen 4-stelligen Code ein.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: site } = await admin
    .from('wedding_sites')
    .select('event_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!site) return NextResponse.json({ error: 'Hochzeitswebsite nicht gefunden' }, { status: 404 })

  const { data: guest } = await admin
    .from('guests')
    .select('token, name')
    .eq('event_id', site.event_id)
    .eq('short_code', code)
    .maybeSingle()

  if (!guest) {
    return NextResponse.json({ error: 'Dieser Code gehört zu keiner Einladung. Bitte prüfe deine Eingabe.' }, { status: 404 })
  }

  return NextResponse.json({ token: guest.token, name: guest.name })
}
