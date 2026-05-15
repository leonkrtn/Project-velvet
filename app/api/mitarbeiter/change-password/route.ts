import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const admin = createAdminClient()
    await admin
      .from('organizer_staff')
      .update({ must_change_password: false })
      .eq('auth_user_id', user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[mitarbeiter/change-password]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
