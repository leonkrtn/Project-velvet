export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SitzplanClient, { type SitzplanInitialConfig } from './SitzplanClient'
import type { RaumPoint, RaumElement, PlacedTablePreview } from '@/components/room/RaumKonfigurator'

interface Props { params: Promise<{ eventId: string }> }

export default async function SitzplanPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: globalRow }, { data: eventRow }, { data: eventData }, { data: tablesData }, { data: conceptRows }] = await Promise.all([
    supabase.from('organizer_room_configs').select('*').eq('user_id', user.id).single(),
    supabase.from('event_room_configs').select('*').eq('event_id', eventId).single(),
    supabase.from('events').select('couple_name').eq('id', eventId).single(),
    supabase.from('seating_tables').select('pos_x,pos_y,rotation,shape,table_length,table_width,name').eq('event_id', eventId),
    supabase.from('organizer_seating_concepts').select('id,name,points,elements,table_pool,placed_tables').eq('organizer_id', user.id).order('sort_order'),
  ])

  const initialEventConfig: SitzplanInitialConfig = eventRow
    ? { points: eventRow.points ?? [], elements: eventRow.elements ?? [], table_pool: eventRow.table_pool }
    : null

  return (
    <SitzplanClient
      eventId={eventId}
      userId={user.id}
      coupleName={eventData?.couple_name ?? ''}
      globalPoints={(globalRow?.points ?? []) as RaumPoint[]}
      globalElements={(globalRow?.elements ?? []) as RaumElement[]}
      initialEventConfig={initialEventConfig}
      initialPlacedTables={(tablesData ?? []) as PlacedTablePreview[]}
      initialConcepts={(conceptRows ?? []) as any}
    />
  )
}
