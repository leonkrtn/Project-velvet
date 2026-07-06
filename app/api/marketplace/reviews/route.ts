import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — veröffentlichte Bewertungen eines Vendors + Aggregat. Query: ?vendorId=
export async function GET(req: NextRequest) {
  const vendorId = req.nextUrl.searchParams.get('vendorId')
  if (!vendorId) return NextResponse.json({ error: 'vendorId fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('marketplace_reviews')
    .select('id, author_name, rating, title, body, created_at')
    .eq('dienstleister_id', vendorId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const reviews = data ?? []
  const count = reviews.length
  const avg = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0
  return NextResponse.json({ reviews, count, avg })
}

const MAX_REVIEW_PHOTOS = 4

// POST — Bewertung abgeben (nur nach nachgewiesener Zusammenarbeit).
// Body: { vendorId, rating, title?, body?, eventId?, photoKeys?: string[] }
// photoKeys: zuvor via /api/marketplace/reviews/photo-upload hochgeladene R2-Keys;
// nur eigene Keys (Prefix review-photos/{vendorId}/{userId}/) werden übernommen.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const vendorId = body.vendorId as string
  const rating = Math.round(Number(body.rating))
  if (!vendorId || !(rating >= 1 && rating <= 5)) {
    return NextResponse.json({ error: 'vendorId und Bewertung (1–5) erforderlich' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Events des Nutzers
  const { data: memberships } = await admin
    .from('event_members').select('event_id').eq('user_id', user.id)
  const eventIds = (memberships ?? []).map(m => m.event_id as string)
  if (eventIds.length === 0) return NextResponse.json({ error: 'Keine Berechtigung zum Bewerten' }, { status: 403 })

  // Nachgewiesene Zusammenarbeit: angenommene Anfrage ODER akzeptierte Verknüpfung.
  const [{ data: req1 }, { data: req2 }] = await Promise.all([
    admin.from('marketplace_requests').select('id').eq('dienstleister_id', vendorId).eq('status', 'accepted').in('event_id', eventIds).limit(1),
    admin.from('event_dienstleister').select('id').eq('dienstleister_id', vendorId).eq('status', 'akzeptiert').in('event_id', eventIds).limit(1),
  ])
  if ((req1?.length ?? 0) === 0 && (req2?.length ?? 0) === 0) {
    return NextResponse.json({ error: 'Bewertungen sind erst nach einer Zusammenarbeit möglich' }, { status: 403 })
  }

  const { data: prof } = await admin.from('profiles').select('name').eq('id', user.id).maybeSingle()
  const authorName = prof?.name?.trim() || 'Brautpaar'

  const photoKeys = (Array.isArray(body.photoKeys) ? body.photoKeys : [])
    .filter((k): k is string => typeof k === 'string' && k.startsWith(`review-photos/${vendorId}/${user.id}/`))
    .slice(0, MAX_REVIEW_PHOTOS)

  const { error } = await admin.from('marketplace_reviews').upsert({
    dienstleister_id: vendorId,
    event_id: (body.eventId as string) || eventIds[0],
    author_user_id: user.id,
    author_name: authorName,
    rating,
    title: (body.title as string)?.trim() || '',
    body: (body.body as string)?.trim() || '',
    photo_r2_keys: photoKeys,
    status: 'published',
  }, { onConflict: 'dienstleister_id,author_user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
