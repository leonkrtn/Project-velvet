import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadVendorRequests } from '@/lib/vendor/anfragen'

// GET — eingehende Anfragen für den eingeloggten Dienstleister (alle Events),
// angereichert mit den Kundendaten (Event-Eckdaten, Gästezahl, Brautpaar-Kontakte).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  try {
    const result = await loadVendorRequests(user.id)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const requestId = searchParams.get('id')
  if (!requestId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const admin = createAdminClient()
  const { data: links } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
  const dlIds = (links ?? []).map((l: { dienstleister_id: string }) => l.dienstleister_id)
  if (dlIds.length === 0) return NextResponse.json({ error: 'Kein Dienstleister-Profil' }, { status: 403 })

  const { error } = await admin
    .from('marketplace_requests')
    .delete()
    .eq('id', requestId)
    .in('dienstleister_id', dlIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
