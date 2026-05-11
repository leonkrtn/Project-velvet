import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrautpaarAufgaben from './BrautpaarAufgaben'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function AufgabenPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [tasksRes, eventRes] = await Promise.all([
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
  ])

  return (
    <BrautpaarAufgaben
      eventId={eventId}
      userId={user.id}
      initialTasks={tasksRes.data ?? []}
      weddingDate={eventRes.data?.date ?? null}
    />
  )
}
