import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Generischer, portalübergreifender Tour-Fortschritt (Vendor, Brautpaar, …).
// GET  ?key=<tourKey>  → { done: boolean }
// POST { key: <tourKey> } → markiert die Tour für den aktuellen Nutzer als
// abgeschlossen, damit sie nicht bei jeder neuen Anmeldung (anderes Gerät/
// Browser, gelöschter localStorage) erneut automatisch startet.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('user_tour_state')
    .select('tour_key')
    .eq('user_id', user.id)
    .eq('tour_key', key)
    .maybeSingle()

  return NextResponse.json({ done: !!data })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const key = typeof body.key === 'string' && body.key ? body.key : null
  if (!key) return NextResponse.json({ error: 'key fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_tour_state')
    .upsert({ user_id: user.id, tour_key: key, completed_at: new Date().toISOString() }, { onConflict: 'user_id,tour_key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
