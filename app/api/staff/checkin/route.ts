import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — check in or check out of a shift
// Body: { shiftId: string, action: 'checkin' | 'checkout', notes?: string }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const body = await request.json()
    const { shiftId, action, notes } = body as { shiftId: string; action: 'checkin' | 'checkout'; notes?: string }

    if (!shiftId || !action) return NextResponse.json({ error: 'shiftId und action erforderlich' }, { status: 400 })

    const admin = createAdminClient()

    const { data: myStaff } = await admin
      .from('organizer_staff')
      .select('id, organizer_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (!myStaff) return NextResponse.json({ error: 'Kein Mitarbeiter-Konto' }, { status: 403 })

    const { data: shift } = await admin
      .from('personalplanung_shifts')
      .select('id, staff_id, day_id')
      .eq('id', shiftId)
      .maybeSingle()
    if (!shift || shift.staff_id !== myStaff.id) {
      return NextResponse.json({ error: 'Schicht nicht gefunden' }, { status: 404 })
    }

    // Get event_id from day
    const { data: day } = await admin
      .from('personalplanung_days')
      .select('event_id')
      .eq('id', shift.day_id)
      .maybeSingle()
    if (!day) return NextResponse.json({ error: 'Tag nicht gefunden' }, { status: 404 })

    // Find existing log for this shift
    const { data: existing } = await admin
      .from('shift_time_logs')
      .select('*')
      .eq('shift_id', shiftId)
      .eq('staff_id', myStaff.id)
      .is('actual_end', null)
      .maybeSingle()

    if (action === 'checkin') {
      if (existing) {
        return NextResponse.json({ error: 'Bereits eingestempelt' }, { status: 409 })
      }
      const { data: log, error } = await admin
        .from('shift_time_logs')
        .insert({
          shift_id: shiftId,
          staff_id: myStaff.id,
          event_id: day.event_id,
          actual_start: new Date().toISOString(),
          notes: notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ log })
    }

    if (action === 'checkout') {
      if (!existing) {
        return NextResponse.json({ error: 'Nicht eingestempelt' }, { status: 409 })
      }
      const { data: log, error } = await admin
        .from('shift_time_logs')
        .update({
          actual_end: new Date().toISOString(),
          notes: notes ?? existing.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ log })
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 })
  } catch (err) {
    console.error('[checkin]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
