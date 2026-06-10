// Server-seitige Admin-Prüfung für die Verwaltungs-API (/api/admin/*).
// Der eingeloggte Nutzer wird per Service-Role gegen profiles.is_admin geprüft.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requireAdmin(): Promise<
  | { ok: true; userId: string; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { ok: false, status: 401, error: 'Nicht authentifiziert' }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) return { ok: false, status: 403, error: 'Keine Berechtigung' }

  return { ok: true, userId: user.id, admin }
}
