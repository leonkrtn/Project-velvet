import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CrmContactFilters {
  search?: string
  stage?: string
  source?: string
  priority?: string
  eventType?: string
  homeCity?: string
  eventCity?: string
}

async function getDlId(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_dienstleister')
    .select('dienstleister_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.dienstleister_id ?? null
}

/** Loads CRM contacts (with persons + tasks) for the vendor, applying optional filters. */
export async function loadCrmContacts(userId: string, filters: CrmContactFilters = {}): Promise<any[]> {
  const dlId = await getDlId(userId)
  if (!dlId) return []

  const { search, stage, source, priority, eventType, homeCity, eventCity } = filters

  const admin = createAdminClient()
  let q = admin
    .from('crm_contacts')
    .select('*, crm_contact_persons(id, name, email, phone, role), crm_tasks(id, title, done, due_at)')
    .eq('dienstleister_id', dlId)
    .order('lifecycle_stage', { ascending: true })
    .order('updated_at', { ascending: false })

  if (stage)     q = q.eq('lifecycle_stage', stage)
  if (source)    q = q.eq('source', source)
  if (priority)  q = q.eq('priority', priority)
  if (eventType) q = q.eq('event_type', eventType)
  if (homeCity)  q = q.ilike('home_city', `%${homeCity}%`)
  if (eventCity) q = q.ilike('location', `%${eventCity}%`)
  if (search) {
    q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}
