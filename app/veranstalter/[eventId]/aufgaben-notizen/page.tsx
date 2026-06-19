import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AufgabenNotizenClient from './AufgabenNotizenClient'

interface Props {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function AufgabenNotizenPage({ params, searchParams }: Props) {
  const { eventId } = await params
  const { tab } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: todos } = await supabase
    .from('organizer_todos')
    .select('id, title, done')
    .eq('event_id', eventId)
    .eq('organizer_id', user.id)
    .order('created_at')

  return (
    <AufgabenNotizenClient
      eventId={eventId}
      organizerId={user.id}
      initialTodos={todos ?? []}
      initialTab={tab === 'notizen' ? 'notizen' : 'aufgaben'}
    />
  )
}
