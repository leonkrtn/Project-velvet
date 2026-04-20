import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { code, name, email, password } = await req.json() as {
      code:     string
      name:     string
      email:    string
      password: string
    }

    if (!code?.trim() || !name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'Alle Felder sind Pflicht' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Code prüfen
    const { data: preview } = await admin.rpc('preview_vendor_signup_code', { p_code: code.trim() })
    if (!preview || preview.error) {
      return NextResponse.json({ error: preview?.error ?? 'Ungültiger Code' }, { status: 400 })
    }

    // Auth-User erstellen
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email:          email.trim(),
      password,
      email_confirm:  true,
      user_metadata:  { name: name.trim() },
    })

    if (authErr || !authData.user) {
      if (authErr?.message?.includes('already registered')) {
        return NextResponse.json({ error: 'Diese E-Mail ist bereits registriert.' }, { status: 409 })
      }
      console.error('createUser:', authErr)
      return NextResponse.json({ error: 'Account konnte nicht erstellt werden' }, { status: 500 })
    }

    // Profil-Name setzen (Trigger erstellt Profil, aber Name kommt aus metadata)
    await admin.from('profiles').update({ name: name.trim() }).eq('id', authData.user.id)

    // Code einlösen
    const { data: redeemResult } = await admin.rpc('redeem_vendor_signup_code', {
      p_code:    code.trim(),
      p_user_id: authData.user.id,
    })

    if (!redeemResult?.success) {
      // User wieder löschen wenn Code-Einlösung fehlschlägt
      await admin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'Code konnte nicht eingelöst werden' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/vendor/signup:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
