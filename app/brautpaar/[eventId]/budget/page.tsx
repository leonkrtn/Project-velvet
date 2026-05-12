import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrautpaarBudget from './BrautpaarBudget'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function BudgetPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [eventRes, itemsRes, cateringCostsRes] = await Promise.all([
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
    supabase
      .from('event_organizer_costs')
      .select('id, category, amount, notes')
      .eq('event_id', eventId)
      .eq('source', 'catering')
      .order('created_at', { ascending: true }),
  ])

  if (!eventRes.data) redirect('/login')

  return (
    <BrautpaarBudget
      eventId={eventId}
      organizerFee={Number(eventRes.data.organizer_fee) || 0}
      organizerFeeType={eventRes.data.organizer_fee_type ?? 'fixed'}
      budgetLimit={Number(eventRes.data.budget_total) || 0}
      initialItems={itemsRes.data ?? []}
      cateringCosts={cateringCostsRes.data ?? []}
    />
  )
}
