import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!link) return NextResponse.json({ offers: [] })

  const { data: offers } = await admin
    .from('vendor_offers')
    .select('id, title, status, version, total, currency, valid_until, request_id, created_at, updated_at, released_at, accepted_at, event_id, events(title, date, couple_name)')
    .eq('dienstleister_id', link.dienstleister_id)
    .neq('status', 'superseded')
    .order('updated_at', { ascending: false })

  return NextResponse.json({ offers: offers ?? [] })
}
