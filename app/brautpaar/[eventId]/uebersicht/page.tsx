import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrautpaarUebersicht from './BrautpaarUebersicht'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function UebersichtPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [eventRes, guestsRes, budgetRes, tasksRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, date, couple_name, venue, organizer_fee, organizer_fee_type')
      .eq('id', eventId)
      .single(),
    supabase
      .from('guests')
      .select('id, status')
      .eq('event_id', eventId),
    supabase
      .from('budget_items')
      .select('planned, actual, payment_status')
      .eq('event_id', eventId),
    supabase
      .from('brautpaar_tasks')
      .select('id, done')
      .eq('event_id', eventId),
  ])

  const event = eventRes.data
  if (!event) redirect('/login')

  const guests = guestsRes.data ?? []
  const guestTotal = guests.length
  const guestConfirmed = guests.filter(g => g.status === 'zugesagt').length
  const guestPending = guests.filter(g => g.status === 'ausstehend').length

  const budgetItems = budgetRes.data ?? []
  const budgetTotal = budgetItems.reduce((s, i) => s + (Number(i.planned) || 0), 0)
  const budgetPaid  = budgetItems.reduce((s, i) => s + (Number(i.actual) || 0), 0)

  const tasks = tasksRes.data ?? []
  const tasksDone  = tasks.filter(t => t.done).length
  const tasksTotal = tasks.length

  const daysLeft = event.date
    ? Math.ceil((new Date(event.date).getTime() - Date.now()) / 86400000)
    : null

  return (
    <BrautpaarUebersicht
      eventId={eventId}
      eventTitle={event.title ?? ''}
      eventDate={event.date ?? null}
      coupleName={event.couple_name ?? ''}
      venueName={event.venue ?? ''}
      daysLeft={daysLeft}
      guestTotal={guestTotal}
      guestConfirmed={guestConfirmed}
      guestPending={guestPending}
      budgetTotal={budgetTotal}
      budgetPaid={budgetPaid}
      tasksDone={tasksDone}
      tasksTotal={tasksTotal}
    />
  )
}
