import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeSettings, DEFAULT_DISPLAY_SETTINGS } from '@/lib/display-settings'

const ADMIN_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

async function assertAdmin(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: member } = await supabase
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle()
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

// GET — aktuelle Anzeigeeinstellungen (mit Defaults aufgefüllt).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const access = await assertAdmin(eventId)
  if (access.error) return access.error

  const admin = createAdminClient()
  const { data } = await admin.from('event_display_settings').select('settings').eq('event_id', eventId).maybeSingle()
  return NextResponse.json({ settings: data?.settings ? normalizeSettings(data.settings) : DEFAULT_DISPLAY_SETTINGS })
}

// PATCH — Einstellungen speichern (komplettes Settings-Objekt).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const access = await assertAdmin(eventId)
  if (access.error) return access.error

  const body = await req.json().catch(() => ({}))
  const settings = normalizeSettings(body?.settings ?? body)

  const admin = createAdminClient()
  const { error } = await admin
    .from('event_display_settings')
    .upsert({ event_id: eventId, settings, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, settings })
}
