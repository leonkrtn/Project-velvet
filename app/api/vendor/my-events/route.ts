import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — alle Events, in denen der eingeloggte Dienstleister Mitglied ist.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: members } = await admin
    .from('event_members')
    .select('event_id, events(id, title, date, couple_name)')
    .eq('user_id', user.id)
    .eq('role', 'dienstleister')
    .order('created_at', { ascending: false })

  const events = (members ?? []).map(m => {
    const ev = Array.isArray(m.events) ? m.events[0] : m.events as { id: string; title: string | null; date: string | null; couple_name: string | null } | null
    return {
      id: m.event_id as string,
      title: ev?.title ?? null,
      date: ev?.date ?? null,
      couple_name: ev?.couple_name ?? null,
    }
  })

  return NextResponse.json({ events })
}
