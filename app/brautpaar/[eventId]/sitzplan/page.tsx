export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrautpaarSitzplanClient, { type BrautpaarSitzplanInitialConfig } from './BrautpaarSitzplanClient'
import type { RaumPoint, RaumElement, PlacedTablePreview } from '@/components/room/RaumKonfigurator'

const SIMPLE_TOGGLE_KEY = 'sitzplan-simple'

interface Props { params: Promise<{ eventId: string }> }

export default async function BrautpaarSitzplanPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: globalRow }, { data: eventRow }, { data: eventData }, { data: memberRow }, { data: tablesData }, { data: toggleRow }] = await Promise.all([
    supabase.from('organizer_room_configs').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('event_room_configs').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('events').select('couple_name').eq('id', eventId).single(),
    supabase.from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).maybeSingle(),
    supabase.from('seating_tables').select('pos_x,pos_y,rotation,shape,table_length,table_width,name').eq('event_id', eventId),
    supabase.from('feature_toggles').select('enabled').eq('event_id', eventId).eq('key', SIMPLE_TOGGLE_KEY).maybeSingle(),
  ])

  const initialEventConfig: BrautpaarSitzplanInitialConfig = eventRow
    ? { points: eventRow.points ?? [], elements: eventRow.elements ?? [], table_pool: eventRow.table_pool }
    : null

  return (
    <BrautpaarSitzplanClient
      eventId={eventId}
      userId={user.id}
      coupleName={eventData?.couple_name ?? ''}
      isSolo={memberRow?.role === 'brautpaar_solo'}
      simpleMode={toggleRow?.enabled === true}
      globalPoints={(globalRow?.points ?? []) as RaumPoint[]}
      globalElements={(globalRow?.elements ?? []) as RaumElement[]}
      initialEventConfig={initialEventConfig}
      initialPlacedTables={(tablesData ?? []) as PlacedTablePreview[]}
    />
  )
}
