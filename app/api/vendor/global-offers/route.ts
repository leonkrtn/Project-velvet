import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadVendorGlobalOffers } from '@/lib/vendor/global-offers'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const offers = await loadVendorGlobalOffers(user.id)
  return NextResponse.json({ offers })
}
