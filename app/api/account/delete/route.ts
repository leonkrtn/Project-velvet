import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACCOUNT_DELETE_GRACE_DAYS } from '@/lib/account/delete-grace'

// Self-Service-Kontolöschung, Snapchat-Modell: sofort deaktiviert (kein Zugriff
// mehr über die App-Oberflächen), aber alle Daten bleiben erhalten, bis die
// Frist abläuft — meldet sich der Nutzer vorher wieder an, wird automatisch
// wiederhergestellt (/api/account/restore). Die endgültige, unwiderrufliche
// Löschung/Anonymisierung übernimmt der tägliche Cron-Tick (lib/account/purge.ts).
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const purgeAt = new Date(now.getTime() + ACCOUNT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000)

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ deleted_at: now.toISOString(), scheduled_purge_at: purgeAt.toISOString() })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, scheduledPurgeAt: purgeAt.toISOString() })
}
