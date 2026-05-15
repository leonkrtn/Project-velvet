import { createClient } from '@/lib/supabase/server'
import CateringForm from '@/app/veranstalter/[eventId]/catering/CateringForm'

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

  if (!event) return null

  const { data: cateringPlan } = await supabase
    .from('catering_plans')
    .select('*')
    .eq('event_id', eventId)
    .single()

  const guestIdsRes = await supabase.from('guests').select('id').eq('event_id', eventId)
  const guestIds = (guestIdsRes.data ?? []).map(g => g.id)

  const [{ data: guestStats }, { data: begleitStats }] = await Promise.all([
    supabase
      .from('guests')
      .select('id, status, meal_choice, allergy_tags')
      .eq('event_id', eventId),
    guestIds.length > 0
      ? supabase.from('begleitpersonen').select('guest_id, meal_choice, allergy_tags').in('guest_id', guestIds)
      : Promise.resolve({ data: [] }),
  ])

  const attending = (guestStats ?? []).filter(g => g.status === 'zugesagt')
  const attendingIds = new Set(attending.map(g => g.id))
  const mealCounts: Record<string, number> = {}
  const allergyCounts: Record<string, number> = {}
  for (const g of attending) {
    if (g.meal_choice) mealCounts[g.meal_choice] = (mealCounts[g.meal_choice] ?? 0) + 1
    for (const tag of (g.allergy_tags ?? [])) {
      allergyCounts[tag] = (allergyCounts[tag] ?? 0) + 1
    }
  }
  for (const b of (begleitStats ?? []).filter(b => attendingIds.has(b.guest_id))) {
    if (b.meal_choice) mealCounts[b.meal_choice] = (mealCounts[b.meal_choice] ?? 0) + 1
    for (const tag of (b.allergy_tags ?? [])) {
      allergyCounts[tag] = (allergyCounts[tag] ?? 0) + 1
    }
  }

  return (
    <div className="bp-page">
      <CateringForm
        eventId={eventId}
        initialEvent={event}
        initialPlan={cateringPlan ?? null}
        initialCosts={[]}
        confirmedGuestCount={attending.length}
        mealCounts={mealCounts}
        allergyCounts={allergyCounts}
        hideCosts
      />
    </div>
  )
}
