import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateSignupCode, findAuthUserByEmail, buildOtpMeta, sendSignupCodeEmail,
} from '@/lib/auth/signup-code'

export const dynamic = 'force-dynamic'

// Startet die Registrierung: legt (oder aktualisiert) einen unbestätigten
// Auth-User an und verschickt einen kurzen Bestätigungscode über Resend.
// Eine bereits BESTÄTIGTE E-Mail wird abgewiesen (409 EMAIL_TAKEN).
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; metadata?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'INVALID' }, { status: 400 }) }

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const metadata = body.metadata ?? {}
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: 'INVALID', message: 'E-Mail oder Passwort ungültig.' }, { status: 400 })
  }

  let admin
  try { admin = createAdminClient() } catch {
    return NextResponse.json({ error: 'SERVER', message: 'Server nicht konfiguriert.' }, { status: 500 })
  }

  const code = generateSignupCode()

  try {
    const existing = await findAuthUserByEmail(admin, email)

    if (existing) {
      // Bereits vollständig registriert → abweisen.
      if (existing.email_confirmed_at) {
        return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 409 })
      }
      // Unbestätigt → neuen Code setzen und erneut senden (idempotenter Retry).
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        user_metadata: { ...(existing.user_metadata ?? {}), ...metadata },
        app_metadata: buildOtpMeta(existing.app_metadata, code),
      })
      if (error) throw error
    } else {
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: metadata,
        app_metadata: buildOtpMeta(undefined, code),
      })
      if (error) {
        // Sicherheitsnetz: falls die E-Mail doch existiert (Profil-Lookup verfehlt).
        const msg = (error.message || '').toLowerCase()
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 409 })
        }
        throw error
      }
    }

    await sendSignupCodeEmail(email, code)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Forevr] signup-start failed:', err)
    return NextResponse.json({ error: 'SERVER', message: 'Registrierung fehlgeschlagen.' }, { status: 500 })
  }
}
