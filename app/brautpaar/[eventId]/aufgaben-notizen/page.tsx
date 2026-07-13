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

  const [tasksRes, eventRes, notesRes] = await Promise.all([
    supabase
      .from('brautpaar_tasks')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('events')
      .select('date')
      .eq('id', eventId)
      .single(),
    supabase
      .from('brautpaar_notes')
      .select('*')
      .eq('event_id', eventId)
      .order('category')
      .order('sort_order')
      .order('created_at'),
  ])

  return (
    <AufgabenNotizenClient
      eventId={eventId}
      userId={user.id}
      initialTasks={tasksRes.data ?? []}
      initialNotes={notesRes.data ?? []}
      weddingDate={eventRes.data?.date ?? null}
      initialTab={tab === 'notizen' ? 'notizen' : 'aufgaben'}
    />
  )
}
