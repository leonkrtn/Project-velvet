import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: Promise<{ swapId: string }> }

// PATCH — approve/reject/accept/cancel a swap request
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { swapId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const body = await request.json()
    const { action } = body as { action: 'approve' | 'reject' | 'accept' | 'cancel' }

    const admin = createAdminClient()
    const { data: swap } = await admin
      .from('personalplanung_shift_swaps')
      .select('*')
      .eq('id', swapId)
      .maybeSingle()
    if (!swap) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    const now = new Date().toISOString()

    if (action === 'approve' || action === 'reject') {
      // Only organizer
      if (swap.organizer_id !== user.id) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      if (action === 'approve') {
        // Swap the shift staff_id
        await admin.from('personalplanung_shifts')
          .update({ staff_id: swap.to_staff_id })
          .eq('id', swap.shift_id)
        await admin.from('personalplanung_shift_swaps')
          .update({ status: newStatus, approved_at: now })
          .eq('id', swapId)
      } else {
        await admin.from('personalplanung_shift_swaps')
          .update({ status: newStatus, responded_at: now })
          .eq('id', swapId)
      }
    } else if (action === 'accept') {
      // Target staff accepts
      const { data: myStaff } = await admin.from('organizer_staff').select('id').eq('auth_user_id', user.id).maybeSingle()
      if (!myStaff || swap.to_staff_id !== myStaff.id) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      await admin.from('personalplanung_shift_swaps').update({ status: 'accepted', responded_at: now }).eq('id', swapId)
    } else if (action === 'cancel') {
      // Requester cancels
      const { data: myStaff } = await admin.from('organizer_staff').select('id').eq('auth_user_id', user.id).maybeSingle()
      if (!myStaff || swap.from_staff_id !== myStaff.id) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      await admin.from('personalplanung_shift_swaps').update({ status: 'cancelled' }).eq('id', swapId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[staff/swaps PATCH]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
