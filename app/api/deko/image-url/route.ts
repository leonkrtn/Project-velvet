import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestDownloadUrl } from '@/lib/files/worker-client'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const r2Key = req.nextUrl.searchParams.get('r2Key')
  const eventId = req.nextUrl.searchParams.get('eventId')
  if (!r2Key || !eventId) return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })

  // Verify event membership
  const { data: member } = await supabase
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const url = await requestDownloadUrl(r2Key)
  return NextResponse.json({ url })
}
