import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved_organizer')
      .eq('id', user.id)
      .single()

    if (!profile?.is_approved_organizer) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('vendor_signup_codes')
      .insert({ created_by: user.id })
      .select('code, expires_at')
      .single()

    if (error || !data) {
      console.error('vendor_signup_codes insert:', error)
      return NextResponse.json({ error: 'Code konnte nicht erstellt werden' }, { status: 500 })
    }

    return NextResponse.json({ code: data.code, expires_at: data.expires_at })
  } catch (err) {
    console.error('POST /api/vendor/signup-code:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
