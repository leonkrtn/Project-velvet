import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DekoTabContent from '@/components/tabs/DekoTabContent'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function DekorationPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'veranstalter') redirect(`/veranstalter`)

  return <DekoTabContent eventId={eventId} mode="veranstalter" />
}
