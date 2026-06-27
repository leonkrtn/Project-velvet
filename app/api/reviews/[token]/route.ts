import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Oeffentlicher Bewertungs-Flow ueber Einladungs-Token (kein Login).

async function loadInvite(admin: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await admin.from('review_invites').select('*').eq('token', token).maybeSingle()
  return data
}

// GET — Vorschau (Vendor-Name + Branding + Event), prueft Token-Status.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()
  const invite = await loadInvite(admin, token)
  if (!invite) return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })

  const [{ data: vendor }, { data: ev }] = await Promise.all([
    admin.from('dienstleister_profiles').select('company_name, name, brand_color, logo_r2_key').eq('id', invite.dienstleister_id).maybeSingle(),
    admin.from('events').select('couple_name, title, date').eq('id', invite.event_id).maybeSingle(),
  ])
  return NextResponse.json({
    used: invite.status === 'used',
    vendor: { name: vendor?.company_name || vendor?.name || 'Dienstleister', brandColor: vendor?.brand_color || null },
    event: { name: ev?.couple_name || ev?.title || '', date: ev?.date || null },
  })
}

// POST — Bewertung abgeben. Body: { rating, title?, body?, authorName? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()
  const invite = await loadInvite(admin, token)
  if (!invite) return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })
  if (invite.status === 'used') return NextResponse.json({ error: 'Diese Bewertung wurde bereits abgegeben.' }, { status: 409 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const rating = Math.round(Number(body.rating))
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: 'Bitte 1–5 Sterne wählen.' }, { status: 400 })

  const { data: ev } = await admin.from('events').select('couple_name, title').eq('id', invite.event_id).maybeSingle()
  const authorName = (body.authorName as string)?.trim() || ev?.couple_name || ev?.title || 'Brautpaar'

  const { error } = await admin.from('marketplace_reviews').insert({
    dienstleister_id: invite.dienstleister_id,
    event_id: invite.event_id,
    author_user_id: null,
    author_name: authorName,
    rating,
    title: (body.title as string)?.trim() || '',
    body: (body.body as string)?.trim() || '',
    status: 'published',
    via_token: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('review_invites').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', invite.id)
  return NextResponse.json({ success: true })
}
