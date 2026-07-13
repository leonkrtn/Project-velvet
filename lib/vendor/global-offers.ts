import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Loads all (non-superseded) offers for the vendor, newest first. */
export async function loadVendorGlobalOffers(userId: string): Promise<any[]> {
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!link) return []

  const { data: offers } = await admin
    .from('vendor_offers')
    .select('id, title, status, version, total, currency, valid_until, request_id, created_at, updated_at, released_at, accepted_at, event_id, events(title, date, couple_name)')
    .eq('dienstleister_id', link.dienstleister_id)
    .neq('status', 'superseded')
    .order('updated_at', { ascending: false })

  return offers ?? []
}
