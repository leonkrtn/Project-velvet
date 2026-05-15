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

  const [{ data: cateringCosts }, { data: guestStats }, { data: begleitStats }] = await Promise.all([
    supabase
      .from('event_organizer_costs')
      .select('id, category, price_per_person, notes')
      .eq('event_id', eventId)
      .eq('source', 'catering')
      .order('created_at', { ascending: true }),
    supabase
      .from('guests')
      .select('id, status, meal_choice, allergy_tags')
      .eq('event_id', eventId),
    supabase
      .from('begleitpersonen')
      .select('guest_id, meal_choice, allergy_tags')
      .in('guest_id', (await supabase.from('guests').select('id').eq('event_id', eventId).then(r => (r.data ?? []).map(g => g.id)))),
  ])

  const attending = (guestStats ?? []).filter(g => g.status === 'zugesagt')
  const attendingIds = new Set(attending.map(g => g.id))
  const attendingBegleit = (begleitStats ?? []).filter(b => attendingIds.has(b.guest_id))
  const mealCounts: Record<string, number> = {}
  const allergyCounts: Record<string, number> = {}
  for (const g of attending) {
    if (g.meal_choice) mealCounts[g.meal_choice] = (mealCounts[g.meal_choice] ?? 0) + 1
    for (const tag of (g.allergy_tags ?? [])) {
      allergyCounts[tag] = (allergyCounts[tag] ?? 0) + 1
    }
  }
  for (const b of attendingBegleit) {
    if (b.meal_choice) mealCounts[b.meal_choice] = (mealCounts[b.meal_choice] ?? 0) + 1
    for (const tag of (b.allergy_tags ?? [])) {
      allergyCounts[tag] = (allergyCounts[tag] ?? 0) + 1
    }
  }

  return (
    <CateringForm
      eventId={eventId}
      initialEvent={event}
      initialPlan={cateringPlan ?? null}
      initialCosts={cateringCosts ?? []}
      confirmedGuestCount={attending.length + attendingBegleit.length}
      mealCounts={mealCounts}
      allergyCounts={allergyCounts}
    />
  )
}
