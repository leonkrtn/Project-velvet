// app/api/geschenke/[wishId]/image-url/route.ts
// GET — returns a fresh presigned GET URL (1h TTL) for a wish's product image.
// Same pattern as app/api/files/[fileId]/download-url/route.ts. Authenticated
// members (veranstalter/brautpaar/brautpaar_solo) of the event only — guests use
// the public RSVP route instead (app/api/rsvp/[token]/route.ts), which resolves
// the URL server-side via the same Worker helper.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEventRole } from '@/lib/files/permissions'
import { requestDownloadUrl } from '@/lib/files/worker-client'

interface Params { params: Promise<{ wishId: string }> }

const READ_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { wishId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const admin = createAdminClient()
    const { data: wish } = await admin
      .from('geschenk_wuensche')
      .select('id, event_id, image_r2_key')
      .eq('id', wishId)
      .maybeSingle()

    if (!wish || !wish.image_r2_key) {
      return NextResponse.json({ error: 'Kein Bild vorhanden' }, { status: 404 })
    }

    const role = await getEventRole(supabase, user.id, wish.event_id)
    if (!role || !READ_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    }

    const imageUrl = await requestDownloadUrl(wish.image_r2_key)
    return NextResponse.json({ imageUrl })
  } catch (err) {
    console.error('[geschenke/image-url]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
