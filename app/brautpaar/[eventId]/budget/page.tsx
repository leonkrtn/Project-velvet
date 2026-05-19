import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import BrautpaarBudget from './BrautpaarBudget'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function BudgetPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [eventRes, itemsRes, cateringCostsRes, cateringPlanRes, guestCountRes, getraenkeArtikelRes, getraenkeCocktailsRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, organizer_fee, organizer_fee_type, budget_total')
      .eq('id', eventId)
      .single(),
    supabase
      .from('budget_items')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
    admin
      .from('event_organizer_costs')
      .select('id, category, price_per_person, notes')
      .eq('event_id', eventId)
      .eq('source', 'catering')
      .order('created_at', { ascending: true }),
    admin
      .from('catering_plans')
      .select('plan_guest_count_enabled, plan_guest_count, getraenke_billing')
      .eq('event_id', eventId)
      .maybeSingle(),
    admin
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'zugesagt'),
    supabase
      .from('getraenke_artikel')
      .select('total_planned, price_per_unit')
      .eq('event_id', eventId),
    supabase
      .from('getraenke_cocktails')
      .select('planned_count, price_per_unit')
      .eq('event_id', eventId),
  ])

  if (!eventRes.data) redirect('/login')

  const confirmedCount = guestCountRes.count ?? 0
  const plan = cateringPlanRes.data
  const effectiveGuestCount = plan?.plan_guest_count_enabled && (plan.plan_guest_count ?? 0) > 0
    ? plan.plan_guest_count
    : confirmedCount

  const getränkeBilling = (plan?.getraenke_billing ?? 'honorar') as 'honorar' | 'einzeln'
  const getränkeBpTotal =
    (getraenkeArtikelRes.data ?? []).reduce((s, a) => s + (a.total_planned ?? 0) * (a.price_per_unit ?? 0), 0) +
    (getraenkeCocktailsRes.data ?? []).reduce((s, c) => s + (c.planned_count ?? 0) * (c.price_per_unit ?? 0), 0)

  return (
    <BrautpaarBudget
      eventId={eventId}
      organizerFee={Number(eventRes.data.organizer_fee) || 0}
      organizerFeeType={eventRes.data.organizer_fee_type ?? 'fixed'}
      budgetLimit={Number(eventRes.data.budget_total) || 0}
      initialItems={itemsRes.data ?? []}
      cateringCosts={cateringCostsRes.data ?? []}
      effectiveGuestCount={effectiveGuestCount}
      getränkeBilling={getränkeBilling}
      getränkeBpTotal={getränkeBpTotal}
    />
  )
}
