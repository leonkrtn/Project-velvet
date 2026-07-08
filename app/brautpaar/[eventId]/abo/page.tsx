import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscriptionState } from '@/lib/subscription'
import { BILLING_ENABLED } from '@/lib/billing'
import AboClient from './AboClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function AboPage({ params }: Props) {
  const { eventId } = await params

  // Gratis-Phase: keine Tarifauswahl — die Abo-Seite existiert nicht.
  if (!BILLING_ENABLED) redirect(`/brautpaar/${eventId}/uebersicht`)

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'brautpaar_solo') redirect(`/brautpaar/${eventId}/uebersicht`)

  const state = await getSubscriptionState(eventId, { lazyCreateTrial: true })

  return (
    <AboClient
      eventId={eventId}
      initialState={{
        plan: state.plan,
        status: state.status,
        trialEndsAt: state.trialEndsAt,
        currentPeriodEnd: state.currentPeriodEnd,
        daysLeft: state.daysLeft,
        isPro: state.isPro,
        promo: state.promo,
      }}
    />
  )
}
