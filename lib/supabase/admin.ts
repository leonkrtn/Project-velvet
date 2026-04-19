import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const key = serviceKey?.trim() ? serviceKey : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  if (!serviceKey?.trim()) {
    console.warn('[Velvet] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key (ensure public RSVP RLS policies are configured)')
  }
  return createClient(url, key)
}
