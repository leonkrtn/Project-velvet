import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Markiert eine Tour serverseitig als abgeschlossen, damit sie nicht bei jeder
// neuen Anmeldung (anderes Gerät/Browser, gelöschter localStorage) erneut startet.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tourKey = typeof body.tourKey === 'string' && body.tourKey ? body.tourKey : 'vendor_quick_tour'

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_tour_state')
    .upsert({ user_id: user.id, tour_key: tourKey, completed_at: new Date().toISOString() }, { onConflict: 'user_id,tour_key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
