import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findAuthUserByEmail, clearOtpMeta, SIGNUP_MAX_ATTEMPTS } from '@/lib/auth/signup-code'

export const dynamic = 'force-dynamic'

// Prüft den Registrierungs-Code und bestätigt bei Erfolg die E-Mail-Adresse
// (Admin-API). Danach kann sich der Client per Passwort einloggen.
export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'INVALID' }, { status: 400 }) }

  const email = (body.email ?? '').trim().toLowerCase()
  const code = (body.code ?? '').replace(/\s+/g, '')
  if (!email || !code) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  let admin
  try { admin = createAdminClient() } catch {
    return NextResponse.json({ error: 'SERVER' }, { status: 500 })
  }

  try {
    const user = await findAuthUserByEmail(admin, email)
    if (!user) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
    // Bereits bestätigt → idempotent Erfolg.
    if (user.email_confirmed_at) return NextResponse.json({ ok: true })

    const meta = (user.app_metadata ?? {}) as Record<string, unknown>
    const stored = meta.signup_otp as string | undefined
    const exp = meta.signup_otp_exp as string | undefined
    const att = (meta.signup_otp_att as number | undefined) ?? 0

    if (!stored) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
    if (att >= SIGNUP_MAX_ATTEMPTS) return NextResponse.json({ error: 'TOO_MANY' }, { status: 429 })
    if (exp && Date.now() > new Date(exp).getTime()) return NextResponse.json({ error: 'EXPIRED' }, { status: 400 })

    if (code !== stored) {
      await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...meta, signup_otp_att: att + 1 },
      })
      return NextResponse.json({ error: 'INVALID' }, { status: 400 })
    }

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      app_metadata: clearOtpMeta(meta),
    })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Forevr] signup-verify failed:', err)
    return NextResponse.json({ error: 'SERVER' }, { status: 500 })
  }
}
