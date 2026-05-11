import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BrautpaarShell from './BrautpaarShell'
import '@/app/brautpaar/brautpaar.css'

interface Props {
  children: React.ReactNode
  params: Promise<{ eventId: string }>
}

export default async function BrautpaarLayout({ children, params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/brautpaar')

  const { data: member } = await supabase
    .from('event_members')
    .select('role, onboarding_completed_at')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || (member.role !== 'brautpaar' && member.role !== 'veranstalter')) {
    redirect('/login')
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title, couple_name, date')
    .eq('id', eventId)
    .single()

  if (!event) redirect('/login')

  const showWelcome =
    member.role === 'brautpaar' && !member.onboarding_completed_at

  return (
    <BrautpaarShell
      eventId={eventId}
      eventTitle={event.couple_name ?? event.title ?? ''}
      eventDate={event.date ?? null}
      userId={user.id}
      showWelcome={showWelcome}
    >
      {children}
    </BrautpaarShell>
  )
}
