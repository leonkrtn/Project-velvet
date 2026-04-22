import { createClient } from '@/lib/supabase/server'
import BerechtigungenClient from './BerechtigungenClient'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function BerechtigungenPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const permRes = await supabase
    .from('brautpaar_permissions')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  return (
    <BerechtigungenClient
      eventId={eventId}
      initialPerms={permRes.data}
    />
  )
}
