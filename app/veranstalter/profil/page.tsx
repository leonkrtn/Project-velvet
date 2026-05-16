import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfilClient from './ProfilClient'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <ProfilClient
      userId={user.id}
      initialName={profile?.name ?? ''}
      initialEmail={user.email ?? ''}
      initialAvatarUrl={(profile as { name: string | null; email: string | null; avatar_url?: string | null } | null)?.avatar_url ?? null}
    />
  )
}
