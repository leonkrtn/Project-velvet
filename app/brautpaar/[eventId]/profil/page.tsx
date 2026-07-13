import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrautpaarProfilClient from './BrautpaarProfilClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function BrautpaarProfilPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['brautpaar', 'brautpaar_solo', 'veranstalter'].includes(member.role)) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  return (
    <BrautpaarProfilClient
      eventId={eventId}
      initialName={profile?.name ?? ''}
      initialEmail={user.email ?? ''}
    />
  )
}
