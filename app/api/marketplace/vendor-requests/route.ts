import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET — eingehende Anfragen für den eingeloggten Dienstleister (alle Events),
// angereichert mit den Kundendaten (Event-Eckdaten, Gästezahl, Brautpaar-Kontakte).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const admin = createAdminClient()
  const { data: links } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', user.id)
  const dlIds = (links ?? []).map(l => (l as { dienstleister_id: string }).dienstleister_id)
  if (dlIds.length === 0) return NextResponse.json({ requests: [], isVendor: false })

  const { data: rows, error } = await admin
    .from('marketplace_requests')
    .select(`
      id, event_id, dienstleister_id, message, budget, status, conversation_id, created_at, responded_at,
      events ( title, couple_name, date, location_name, location_city, venue, venue_address, event_type ),
      requester:profiles!marketplace_requests_requested_by_fkey ( name, email, phone )
    `)
    .in('dienstleister_id', dlIds)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const requests = rows ?? []
  const eventIds = Array.from(new Set(requests.map((r: any) => r.event_id).filter(Boolean)))

  // Gästezahlen je Event
  const guestByEvent: Record<string, { confirmed: number; pending: number }> = {}
  if (eventIds.length) {
    const { data: gc } = await admin
      .from('v_event_guest_counts')
      .select('event_id, confirmed_guests, pending_guests, confirmed_plus_ones')
      .in('event_id', eventIds)
    for (const g of (gc ?? []) as any[]) {
      guestByEvent[g.event_id] = {
        confirmed: (g.confirmed_guests ?? 0) + (g.confirmed_plus_ones ?? 0),
        pending: g.pending_guests ?? 0,
      }
    }
  }

  // Brautpaar-Kontakte je Event
  const contactsByEvent: Record<string, { name: string | null; email: string | null; phone: string | null }[]> = {}
  if (eventIds.length) {
    const { data: mem } = await admin
      .from('event_members')
      .select('event_id, role, profiles!user_id ( name, email, phone )')
      .in('event_id', eventIds)
      .in('role', ['brautpaar', 'brautpaar_solo'])
    for (const m of (mem ?? []) as any[]) {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      if (!p) continue
      ;(contactsByEvent[m.event_id] ??= []).push({ name: p.name ?? null, email: p.email ?? null, phone: p.phone ?? null })
    }
  }

  const enriched = requests.map((r: any) => ({
    ...r,
    guest_count: guestByEvent[r.event_id] ?? null,
    couple_contacts: contactsByEvent[r.event_id] ?? [],
  }))

  return NextResponse.json({ requests: enriched, isVendor: true })
}
