import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CateringForm from './CateringForm'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function CateringPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, meal_options, menu_type, collect_allergies, children_allowed, children_note')
    .eq('id', eventId)
    .single()

  if (!event) redirect('/veranstalter')

  const { data: cateringPlan } = await supabase
    .from('catering_plans')
    .select('*')
    .eq('event_id', eventId)
    .single()

  const [{ data: cateringCosts }, { data: guestStats }] = await Promise.all([
    supabase
      .from('event_organizer_costs')
      .select('id, category, amount, notes')
      .eq('event_id', eventId)
      .eq('source', 'catering')
      .order('created_at', { ascending: true }),
    supabase
      .from('guests')
      .select('status, meal_choice, allergy_tags')
      .eq('event_id', eventId),
  ])

  const attending = (guestStats ?? []).filter(g => g.status === 'zugesagt')
  const mealCounts: Record<string, number> = {}
  const allergyCounts: Record<string, number> = {}
  for (const g of attending) {
    if (g.meal_choice) mealCounts[g.meal_choice] = (mealCounts[g.meal_choice] ?? 0) + 1
    for (const tag of (g.allergy_tags ?? [])) {
      allergyCounts[tag] = (allergyCounts[tag] ?? 0) + 1
    }
  }

  return (
    <CateringForm
      eventId={eventId}
      initialEvent={event}
      initialPlan={cateringPlan ?? null}
      initialCosts={cateringCosts ?? []}
      confirmedGuestCount={attending.length}
      mealCounts={mealCounts}
      allergyCounts={allergyCounts}
    />
  )
}
