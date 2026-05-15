import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — create a swap request (called from mitarbeiter portal)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const body = await request.json()
    const { shiftId, toStaffId, notes } = body as { shiftId: string; toStaffId?: string; notes?: string }

    const admin = createAdminClient()

    // Find the staff record for current user
    const { data: myStaff } = await admin
      .from('organizer_staff')
      .select('id, organizer_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (!myStaff) return NextResponse.json({ error: 'Kein Mitarbeiter-Konto gefunden' }, { status: 403 })

    // Verify the shift belongs to this staff member
    const { data: shift } = await admin
      .from('personalplanung_shifts')
      .select('id, staff_id, day_id')
      .eq('id', shiftId)
      .maybeSingle()
    if (!shift || shift.staff_id !== myStaff.id) {
      return NextResponse.json({ error: 'Diese Schicht gehört nicht dir' }, { status: 403 })
    }

    // Get event_id from the day
    const { data: day } = await admin
      .from('personalplanung_days')
      .select('event_id')
      .eq('id', shift.day_id)
      .maybeSingle()
    if (!day) return NextResponse.json({ error: 'Tag nicht gefunden' }, { status: 404 })

    const { data: swap, error } = await admin.from('personalplanung_shift_swaps').insert({
      shift_id: shiftId,
      from_staff_id: myStaff.id,
      to_staff_id: toStaffId ?? null,
      event_id: day.event_id,
      organizer_id: myStaff.organizer_id,
      notes: notes?.trim() || null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ swap })
  } catch (err) {
    console.error('[staff/swaps POST]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
