import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: Promise<{ staffId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { staffId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const body = await request.json()
    const { password } = body as { password: string }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: staffRow } = await admin
      .from('organizer_staff')
      .select('id, email, auth_user_id, organizer_id')
      .eq('id', staffId)
      .maybeSingle()

    if (!staffRow || staffRow.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
    if (!staffRow.email) {
      return NextResponse.json({ error: 'Mitarbeiter hat keine E-Mail-Adresse hinterlegt' }, { status: 400 })
    }

    if (staffRow.auth_user_id) {
      // Update password for existing auth user
      const { error } = await admin.auth.admin.updateUserById(staffRow.auth_user_id, { password })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await admin.from('organizer_staff').update({ must_change_password: true }).eq('id', staffId)
    } else {
      // Create new auth user
      const { data: newUser, error } = await admin.auth.admin.createUser({
        email: staffRow.email,
        password,
        email_confirm: true,
        app_metadata: { role: 'mitarbeiter', organizer_id: user.id },
      })
      if (error || !newUser.user) {
        return NextResponse.json({ error: error?.message ?? 'Fehler beim Erstellen des Kontos' }, { status: 500 })
      }
      await admin
        .from('organizer_staff')
        .update({ auth_user_id: newUser.user.id, must_change_password: true })
        .eq('id', staffId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[staff/setup-auth]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
