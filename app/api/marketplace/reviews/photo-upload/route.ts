import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requestUploadUrl } from '@/lib/files/worker-client'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// POST — Presigned-PUT-URL für ein Bewertungs-Foto. Body: { vendorId, contentType }
// Gleiche Berechtigungsregel wie das Bewerten selbst: nachgewiesene Zusammenarbeit.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { vendorId?: string; contentType?: string }
  const vendorId = body.vendorId
  const contentType = body.contentType ?? ''
  if (!vendorId) return NextResponse.json({ error: 'vendorId fehlt' }, { status: 400 })
  const ext = ALLOWED_TYPES[contentType]
  if (!ext) return NextResponse.json({ error: 'Nur JPG, PNG oder WebP erlaubt' }, { status: 400 })

  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('event_members').select('event_id').eq('user_id', user.id)
  const eventIds = (memberships ?? []).map(m => m.event_id as string)
  if (eventIds.length === 0) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const [{ data: req1 }, { data: req2 }] = await Promise.all([
    admin.from('marketplace_requests').select('id').eq('dienstleister_id', vendorId).eq('status', 'accepted').in('event_id', eventIds).limit(1),
    admin.from('event_dienstleister').select('id').eq('dienstleister_id', vendorId).eq('status', 'akzeptiert').in('event_id', eventIds).limit(1),
  ])
  if ((req1?.length ?? 0) === 0 && (req2?.length ?? 0) === 0) {
    return NextResponse.json({ error: 'Fotos sind erst nach einer Zusammenarbeit möglich' }, { status: 403 })
  }

  const key = `review-photos/${vendorId}/${user.id}/${crypto.randomUUID()}.${ext}`
  try {
    const uploadUrl = await requestUploadUrl(key, contentType)
    return NextResponse.json({ key, uploadUrl })
  } catch {
    return NextResponse.json({ error: 'Upload-URL konnte nicht erstellt werden' }, { status: 500 })
  }
}
