import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VendorProfilClient from './VendorProfilClient'

export default async function VendorProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  return <VendorProfilClient initialName={profile?.name ?? ''} initialEmail={user.email ?? ''} />
}
