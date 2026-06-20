import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CateringGetraenkeClient from './CateringGetraenkeClient'

interface Props {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function BrautpaarCateringGetraenkePage({ params, searchParams }: Props) {
  const { eventId } = await params
  const { tab } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['brautpaar', 'brautpaar_solo', 'veranstalter'].includes(member.role)) {
    redirect('/login')
  }

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
    .maybeSingle()

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
    <CateringGetraenkeClient
      eventId={eventId}
      initialEvent={event}
      initialPlan={cateringPlan ?? null}
      confirmedGuestCount={attending.length}
      mealCounts={mealCounts}
      allergyCounts={allergyCounts}
      getraenkeGuestCount={attending.length}
      initialTab={tab === 'getraenke' ? 'getraenke' : 'catering'}
    />
  )
}
