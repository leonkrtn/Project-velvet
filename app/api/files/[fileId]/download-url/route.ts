import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canReadFiles } from '@/lib/files/permissions'
import { requestDownloadUrl } from '@/lib/files/worker-client'
import type { FileModule } from '@/lib/files/types'

interface Params { params: Promise<{ fileId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { fileId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const admin = createAdminClient()

    const { data: file } = await admin
      .from('file_metadata')
      .select('id, event_id, r2_key, original_name, module, status')
      .eq('id', fileId)
      .maybeSingle()

    if (!file || file.status !== 'active') {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })
    }

    // Permission check — same rules as RLS but server-enforced before generating signed URL
    const allowed = await canReadFiles(supabase, user.id, file.event_id, file.module as FileModule)
    if (!allowed) {
      return NextResponse.json({ error: 'Kein Zugriff auf diese Datei' }, { status: 403 })
    }

    // Generate a fresh presigned GET URL (1-hour TTL) — called on every download click
    const downloadUrl = await requestDownloadUrl(file.r2_key, file.original_name)

    // Audit log
    await admin.from('file_access_log').insert({
      file_id: fileId,
      event_id: file.event_id,
      user_id: user.id,
      action: 'download',
      meta: { filename: file.original_name },
    })

    return NextResponse.json({ downloadUrl })
  } catch (err) {
    console.error('[files/download-url]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
