import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    name?: string
    email?: string
    password?: string
    avatar_r2_key?: string
  }

  const errors: string[] = []

  // Update display name in profiles table
  if (body.name !== undefined) {
    const { error } = await supabase
      .from('profiles')
      .update({ name: body.name.trim() })
      .eq('id', user.id)
    if (error) errors.push('Name konnte nicht gespeichert werden.')
  }

  // Store R2 key for avatar (URL is generated on-demand via Worker)
  if (body.avatar_r2_key !== undefined) {
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_r2_key: body.avatar_r2_key })
      .eq('id', user.id)
    if (error) errors.push('Profilbild konnte nicht gespeichert werden.')
  }

  // Update email via Supabase Auth (sends verification email)
  if (body.email) {
    const { error } = await supabase.auth.updateUser({ email: body.email.trim().toLowerCase() })
    if (error) errors.push('E-Mail konnte nicht geändert werden: ' + error.message)
  }

  // Update password via Supabase Auth
  if (body.password) {
    if (body.password.length < 8) {
      errors.push('Passwort muss mindestens 8 Zeichen lang sein.')
    } else {
      const { error } = await supabase.auth.updateUser({ password: body.password })
      if (error) errors.push('Passwort konnte nicht geändert werden: ' + error.message)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(' ') }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
