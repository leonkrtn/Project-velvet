import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

// Verwaltung: Veranstalter-Anfragen freischalten, Veranstalter anlegen,
// Bestand verwalten. Zugang nur mit profiles.is_admin (zusätzlich zur
// Middleware hier serverseitig geprüft).
export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin, name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) redirect('/login')

  return <AdminClient adminName={profile.name} />
}
