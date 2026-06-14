import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — eingehende Anfragen für den eingeloggten Dienstleister (alle Events).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const admin = createAdminClient()
  const { data: links } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
  const dlIds = (links ?? []).map(l => (l as { dienstleister_id: string }).dienstleister_id)
  if (dlIds.length === 0) return NextResponse.json({ requests: [], isVendor: false })

  const { data, error } = await admin
    .from('marketplace_requests')
    .select(`
      id, event_id, dienstleister_id, message, budget, status, conversation_id, created_at, responded_at,
      events ( title, couple_name, date, location_name, location_city ),
      requester:profiles!marketplace_requests_requested_by_fkey ( name )
    `)
    .in('dienstleister_id', dlIds)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data ?? [], isVendor: true })
}
