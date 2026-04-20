import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey?.trim()) {
    throw new Error('[Velvet] SUPABASE_SERVICE_ROLE_KEY not set — cannot create admin client')
  }
  return createClient(url, serviceKey)
}
