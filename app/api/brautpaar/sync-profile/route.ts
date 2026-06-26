import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SoloSignupMetadata } from '@/lib/brautpaar-solo'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId, meta }: { eventId: string; meta: SoloSignupMetadata } = await req.json()
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const admin = createAdminClient()

  // Update profiles with extended contact info
  await admin.from('profiles').update({
    first_name:  meta.first_name  ?? '',
    last_name:   meta.last_name   ?? '',
    phone:       meta.phone       ?? '',
    street:      meta.street      ?? '',
    postal_code: meta.postal_code ?? '',
    city:        meta.city        ?? '',
  }).eq('id', user.id)

  // Upsert partner profile for this event
  if (meta.partner_first_name || meta.partner_last_name) {
    await admin.from('event_partner_profiles').upsert({
      event_id:   eventId,
      first_name: meta.partner_first_name ?? '',
      last_name:  meta.partner_last_name  ?? '',
      email:      meta.partner_email      ?? '',
      phone:      meta.partner_phone      ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' })
  }

  return NextResponse.json({ ok: true })
}
