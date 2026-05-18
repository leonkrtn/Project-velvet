import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GetraenkeTabContent from '@/components/tabs/GetraenkeTabContent'

interface Props { params: Promise<{ eventId: string }> }

export default async function BrautpaarGetraenkePage({ params }: Props) {
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

  if (!member || (member.role !== 'brautpaar' && member.role !== 'veranstalter')) {
    redirect('/login')
  }

  const { data: guestStats } = await supabase
    .from('guests')
    .select('id, status')
    .eq('event_id', eventId)

  const attending = (guestStats ?? []).filter(g => g.status === 'zugesagt').length

  return (
    <div className="bp-page">
      <GetraenkeTabContent eventId={eventId} mode="brautpaar" guestCount={attending} />
    </div>
  )
}
