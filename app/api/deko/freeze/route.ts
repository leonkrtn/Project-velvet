import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { eventId, action } = await req.json() as { eventId: string; action: 'freeze' | 'unfreeze' }
  if (!eventId || !action) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  // Verify role
  const { data: member } = await supabase
    .from('event_members').select('role').eq('event_id', eventId).eq('user_id', user.id).single()

  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (action === 'unfreeze' && member.role !== 'veranstalter')
    return NextResponse.json({ error: 'Only veranstalter can unfreeze' }, { status: 403 })
  if (action === 'freeze' && !['brautpaar', 'veranstalter'].includes(member.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  if (action === 'freeze') {
    // Freeze all main canvases
    const { data: canvases } = await service
      .from('deko_canvases')
      .select('id')
      .eq('event_id', eventId)
      .eq('canvas_type', 'main')

    if (!canvases?.length) return NextResponse.json({ ok: true })

    await service.from('deko_canvases').update({
      is_frozen: true,
      frozen_at: new Date().toISOString(),
      frozen_by: user.id,
    }).in('id', canvases.map(c => c.id))

    // Build budget items from all items on frozen canvases
    const canvasIds = canvases.map(c => c.id)
    const { data: items } = await service.from('deko_items')
      .select('*').in('canvas_id', canvasIds)
      .in('type', ['article', 'fabric', 'flat_rate_article'])

    const { data: catalog } = await service.from('deko_catalog_items').select('*').eq('event_id', eventId)
    const { data: flatRates } = await service.from('deko_flat_rates').select('*').eq('event_id', eventId)

    const catMap = Object.fromEntries((catalog ?? []).map(c => [c.id, c]))
    const frMap = Object.fromEntries((flatRates ?? []).map(f => [f.id, f]))

    // Clear existing deko budget links first
    const { data: existingLinks } = await service.from('deko_budget_links').select('budget_item_id').eq('event_id', eventId)
    if (existingLinks?.length) {
      await service.from('budget_items').delete().in('id', existingLinks.map(l => l.budget_item_id))
      await service.from('deko_budget_links').delete().eq('event_id', eventId)
    }

    // Create new budget items
    const seenFlatRates = new Set<string>()
    for (const item of items ?? []) {
      let description = ''
      let amount = 0

      if (item.type === 'article') {
        const cat = catMap[item.data.catalog_item_id]
        if (!cat || cat.is_free || cat.flat_rate_id) continue
        const qty = item.data.quantity ?? 1
        amount = (cat.price_per_unit ?? 0) * qty
        if (amount <= 0) continue
        description = `${cat.name} ×${qty}`
      } else if (item.type === 'fabric') {
        const cat = catMap[item.data.catalog_item_id]
        if (!cat || cat.is_free) continue
        const meters = item.data.quantity_meters ?? 1
        amount = (cat.price_per_meter ?? 0) * meters
        if (amount <= 0) continue
        description = `${cat.name} ${meters} m`
      } else if (item.type === 'flat_rate_article') {
        if (item.data.is_free) continue
        const frId = item.data.flat_rate_id
        if (seenFlatRates.has(frId)) continue
        seenFlatRates.add(frId)
        const fr = frMap[frId]
        if (!fr) continue
        amount = fr.amount
        description = `Pauschale: ${fr.name}`
      }

      const { data: budgetItem } = await service.from('budget_items').insert({
        event_id: eventId,
        category: 'Dekoration',
        description,
        planned: amount,
        actual: 0,
        payment_status: 'offen',
        notes: JSON.stringify({ source: 'deko', item_id: item.id }),
      }).select().single()

      if (budgetItem) {
        await service.from('deko_budget_links').insert({
          event_id: eventId,
          deko_item_id: item.id,
          budget_item_id: budgetItem.id,
        })
      }
    }

    return NextResponse.json({ ok: true })
  }

  if (action === 'unfreeze') {
    // Unfreeze all canvases
    await service.from('deko_canvases').update({ is_frozen: false, frozen_at: null, frozen_by: null })
      .eq('event_id', eventId)

    // Remove budget items created by deko
    const { data: links } = await service.from('deko_budget_links').select('budget_item_id').eq('event_id', eventId)
    if (links?.length) {
      await service.from('budget_items').delete().in('id', links.map(l => l.budget_item_id))
      await service.from('deko_budget_links').delete().eq('event_id', eventId)
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
