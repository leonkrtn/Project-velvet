import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestUploadUrl } from '@/lib/files/worker-client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contentType } = await req.json() as { contentType: string }
  if (!contentType?.startsWith('image/')) {
    return NextResponse.json({ error: 'Nur Bilddateien erlaubt' }, { status: 400 })
  }

  // Fixed key per user — uploading again overwrites the previous avatar
  const key = `profiles/${user.id}/avatar`
  const uploadUrl = await requestUploadUrl(key, contentType)
  return NextResponse.json({ uploadUrl, key })
}
