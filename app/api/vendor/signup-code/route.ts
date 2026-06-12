import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasProAccess } from '@/lib/subscription'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    // Erlaubt: freigeschaltete Veranstalter ODER Solo-Brautpaare (sie sind
    // Admin ihres eigenen Events und dürfen Dienstleister onboarden)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved_organizer')
      .eq('id', user.id)
      .single()

    if (!profile?.is_approved_organizer) {
      const { data: soloMembership } = await supabase
        .from('event_members')
        .select('id, event_id')
        .eq('user_id', user.id)
        .eq('role', 'brautpaar_solo')
        .limit(1)
        .maybeSingle()

      if (!soloMembership) {
        return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      }

      // Dienstleister onboarden ist für Solo-Paare ein Pro-Feature
      if (!(await hasProAccess(soloMembership.event_id))) {
        return NextResponse.json(
          { error: 'Dienstleister einladen ist Teil von Forevr Pro. Upgradet euren Tarif, um euer Profi-Team dazuzuholen.', code: 'PRO_REQUIRED' },
          { status: 403 },
        )
      }
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
