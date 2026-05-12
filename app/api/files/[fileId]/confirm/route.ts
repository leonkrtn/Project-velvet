import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: Promise<{ fileId: string }> }

export async function PATCH(_request: NextRequest, { params }: Params) {
  try {
    const { fileId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const admin = createAdminClient()

    const { data: file } = await admin
      .from('file_metadata')
      .select('id, event_id, uploaded_by, status')
      .eq('id', fileId)
      .maybeSingle()

    if (!file) return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })

    // Only the uploader can confirm their own pending upload
    if (file.uploaded_by !== user.id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    if (file.status !== 'pending') {
      return NextResponse.json({ error: 'Upload bereits bestätigt' }, { status: 400 })
    }

    const { error: updateErr } = await admin
      .from('file_metadata')
      .update({ status: 'active' })
      .eq('id', fileId)

    if (updateErr) {
      console.error('[files/confirm] DB update:', updateErr)
      return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
    }

    await admin.from('file_access_log').insert({
      file_id: fileId,
      event_id: file.event_id,
      user_id: user.id,
      action: 'confirm',
      meta: {},
    })

    return NextResponse.json({ confirmed: true })
  } catch (err) {
    console.error('[files/confirm]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
