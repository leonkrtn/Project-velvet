// Server-only: zieht die Event-Eckdaten ("Standardinfos"), die jeder Anfrage
// automatisch beiliegen (Gaestezahl, Datum, Location, Brautpaar). Wird beim
// Erzeugen eines Angebots in vendor_offers.standard_info eingefroren.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StandardInfo } from './pricing'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function buildStandardInfo(admin: SupabaseClient, eventId: string): Promise<StandardInfo> {
  const { data: ev } = await admin
    .from('events')
    .select('title, couple_name, date, location_name, location_city, venue, venue_address, event_type')
    .eq('id', eventId)
    .maybeSingle()

  const e = (ev ?? {}) as any
  const location = e.venue
    ? [e.venue, e.venue_address].filter(Boolean).join(', ')
    : [e.location_name, e.location_city].filter(Boolean).join(', ')

  // PLZ best effort aus Adresse/Ort fuer Anfahrts-Zonen (erste 5-stellige Zahl).
  const postalSrc = [e.venue_address, e.location_city, location].filter(Boolean).join(' ')
  const postalCode = (postalSrc.match(/\b(\d{5})\b/)?.[1]) ?? null

  let guestCount: number | null = null
  const { data: gc } = await admin
    .from('v_event_guest_counts')
    .select('confirmed_guests, confirmed_plus_ones')
    .eq('event_id', eventId)
    .maybeSingle()
  if (gc) guestCount = (gc.confirmed_guests ?? 0) + (gc.confirmed_plus_ones ?? 0)

  return {
    coupleName: e.couple_name ?? e.title ?? null,
    date: e.date ?? null,
    guestCount,
    location: location || null,
    postalCode,
    eventType: e.event_type ?? null,
  }
}
