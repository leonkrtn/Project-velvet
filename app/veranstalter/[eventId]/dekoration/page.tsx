import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DekoPageClient from '@/components/deko/DekoPageClient'
import type { DekoArea, DekoCanvas, DekoItem, DekoCatalogItem, DekoFlatRate } from '@/lib/deko/types'

interface Props { params: Promise<{ eventId: string }> }

export default async function DekorationPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).single()
  if (!member || member.role !== 'veranstalter') redirect('/veranstalter')

  const { data: profile } = await supabase
    .from('profiles').select('display_name').eq('id', user.id).single()

  return <DekoPageInner eventId={eventId} userId={user.id} userName={profile?.display_name ?? 'Veranstalter'} role="veranstalter" />
}

async function DekoPageInner({ eventId, userId, userName, role }: { eventId: string; userId: string; userName: string; role: 'veranstalter' | 'brautpaar' | 'dienstleister' | 'trauzeuge' }) {
  const supabase = await createClient()

  const [
    { data: areasRaw },
    { data: canvasesRaw },
    { data: catalog },
    { data: flatRates },
  ] = await Promise.all([
    supabase.from('deko_areas').select('*').eq('event_id', eventId).order('sort_order'),
    supabase.from('deko_canvases').select('*').eq('event_id', eventId).order('sort_order'),
    supabase.from('deko_catalog_items').select('*').eq('event_id', eventId).order('name'),
    supabase.from('deko_flat_rates').select('*').eq('event_id', eventId),
  ])

  const canvases = (canvasesRaw ?? []) as DekoCanvas[]
  const areas: DekoArea[] = (areasRaw ?? []).map(a => ({
    ...a,
    canvases: canvases.filter(c => c.area_id === a.id),
  }))
  const moodboards = canvases.filter(c => c.canvas_type === 'moodboard')

  // Load items for all canvases
  const canvasIds = canvases.map(c => c.id)
  let itemsByCanvas: Record<string, DekoItem[]> = {}
  if (canvasIds.length > 0) {
    const { data: items } = await supabase
      .from('deko_items').select('*').in('canvas_id', canvasIds)
    for (const item of items ?? []) {
      if (!itemsByCanvas[item.canvas_id]) itemsByCanvas[item.canvas_id] = []
      itemsByCanvas[item.canvas_id].push(item as DekoItem)
    }
  }

  const mainCanvases = areas.flatMap(a => (a.canvases ?? []).filter(c => c.canvas_type === 'main'))
  const allFrozen = mainCanvases.length > 0 && mainCanvases.every(c => c.is_frozen)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>Dekoration</h1>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <DekoPageClient
          eventId={eventId}
          role={role}
          userId={userId}
          userName={userName}
          initialAreas={areas}
          initialMoodboards={moodboards}
          initialCatalog={(catalog ?? []) as DekoCatalogItem[]}
          initialFlatRates={(flatRates ?? []) as DekoFlatRate[]}
          initialItemsByCanvas={itemsByCanvas}
          allFrozen={allFrozen}
          isVeranstalter={role === 'veranstalter'}
        />
      </div>
    </div>
  )
}
