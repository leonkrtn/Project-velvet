import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET  → Löschstatus des aktuell angemeldeten Accounts (für den Login-Flow:
//         soll die "Account wiederherstellen?"-Seite gezeigt werden?).
// POST → hebt eine laufende Löschanfrage auf (deleted_at/scheduled_purge_at
//         zurücksetzen). Wird ausgelöst, wenn sich ein Nutzer mit laufender
//         Löschfrist erneut anmeldet und sich für "Wiederherstellen" entscheidet.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('deleted_at, scheduled_purge_at')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    deleted: !!data?.deleted_at,
    scheduledPurgeAt: data?.scheduled_purge_at ?? null,
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ deleted_at: null, scheduled_purge_at: null })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
