import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscriptionState } from '@/lib/subscription'
import BrautpaarShell, { type ShellSubscription } from './BrautpaarShell'
import DisplayTheme from '@/components/brautpaar/DisplayTheme'
import { normalizeSettings, DEFAULT_DISPLAY_SETTINGS } from '@/lib/display-settings'
import '@/app/brautpaar/brautpaar.css'

interface Props {
  children: React.ReactNode
  params: Promise<{ eventId: string }>
}

export default async function BrautpaarLayout({ children, params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/brautpaar')

  const { data: member } = await supabase
    .from('event_members')
    .select('role, onboarding_completed_at')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single()

  if (!member || !['brautpaar', 'brautpaar_solo', 'veranstalter'].includes(member.role)) {
    redirect('/login')
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title, couple_name, date')
    .eq('id', eventId)
    .single()

  if (!event) redirect('/login')

  // Anzeigeeinstellungen (Personalisierung) laden
  const { data: ds } = await supabase
    .from('event_display_settings')
    .select('settings')
    .eq('event_id', eventId)
    .maybeSingle()
  const displaySettings = ds?.settings ? normalizeSettings(ds.settings) : DEFAULT_DISPLAY_SETTINGS

  const showWelcome =
    ['brautpaar', 'brautpaar_solo'].includes(member.role) && !member.onboarding_completed_at

  // Abo-Status: nur Solo-Events sind gegated (Trial-Zeile entsteht beim
  // ersten Portal-Besuch); veranstalter-verwaltete Events bleiben ungegated.
  let subscription: ShellSubscription | null = null
  if (member.role === 'brautpaar_solo') {
    const state = await getSubscriptionState(eventId, { lazyCreateTrial: true })
    if (state.gated) {
      subscription = {
        gated: state.gated,
        status: state.status,
        plan: state.plan,
        daysLeft: state.daysLeft,
        isPro: state.isPro,
      }
    }
  }

  return (
    <div className="bp-display-root">
      <DisplayTheme settings={displaySettings} />
      <BrautpaarShell
        eventId={eventId}
        eventTitle={event.couple_name ?? event.title ?? ''}
        eventDate={event.date ?? null}
        userId={user.id}
        showWelcome={showWelcome}
        isSolo={member.role === 'brautpaar_solo'}
        subscription={subscription}
        monogram={displaySettings.monogram}
      >
        {children}
      </BrautpaarShell>
    </div>
  )
}
