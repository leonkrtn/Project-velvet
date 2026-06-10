import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DekoPageClient from '@/components/deko/DekoPageClient'
import type { DekoArea, DekoCanvas, DekoItem, DekoCatalogItem, DekoFlatRate } from '@/lib/deko/types'
import { Monitor } from 'lucide-react'

interface Props { params: Promise<{ eventId: string }> }

export default async function BrautpaarDekorationPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: member }, { data: profile }] = await Promise.all([
    supabase
      .from('event_members')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles').select('name').eq('id', user.id).maybeSingle(),
  ])

  if (!member || !['brautpaar', 'brautpaar_solo', 'veranstalter'].includes(member.role)) {
    redirect('/login')
  }

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
      {/* Mobile notice — shown below 900px via CSS */}
      <div className="bp-below-desktop bp-page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <Monitor size={40} style={{ color: 'var(--bp-ink-3)' }} />
        </div>
        <h2 className="bp-h2" style={{ marginBottom: '0.5rem' }}>Nur auf dem Desktop verfügbar</h2>
        <p className="bp-body">Die Dekoration kann nur auf einem größeren Bildschirm bearbeitet werden. Bitte öffne diese Seite auf einem Laptop oder Tablet.</p>
      </div>
      {/* Full editor — hidden below 900px via CSS */}
      <div className="bp-desktop-only" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <DekoPageClient
        eventId={eventId}
        role="brautpaar"
        userId={user.id}
        userName={profile?.name ?? 'Brautpaar'}
        initialAreas={areas}
        initialMoodboards={moodboards}
        initialCatalog={(catalog ?? []) as DekoCatalogItem[]}
        initialFlatRates={(flatRates ?? []) as DekoFlatRate[]}
        initialItemsByCanvas={itemsByCanvas}
        allFrozen={allFrozen}
        isVeranstalter={member.role === 'brautpaar_solo'}
      />
      </div>
    </div>
  )
}
