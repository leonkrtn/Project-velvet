import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId } = await request.json()
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  await supabase
    .from('event_members')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('role', 'brautpaar')

  return NextResponse.json({ ok: true })
}
