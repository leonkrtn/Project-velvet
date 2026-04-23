import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { userId } = await req.json() as { userId: string }
  if (!userId) return NextResponse.json({ isVendor: false })

  const admin = createAdminClient()
  const { data } = await admin
    .from('vendor_signup_codes')
    .select('id')
    .eq('used_by', userId)
    .limit(1)

  return NextResponse.json({ isVendor: !!(data && data.length > 0) })
}
