import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateSignupCode, findAuthUserByEmail, buildOtpMeta, sendSignupCodeEmail,
} from '@/lib/auth/signup-code'

export const dynamic = 'force-dynamic'

// Sendet den Registrierungs-Code erneut. Antwortet immer mit ok (kein Leak,
// ob die Adresse existiert); nur für unbestätigte User wird tatsächlich gesendet.
export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ ok: true })

  try {
    const admin = createAdminClient()
    const user = await findAuthUserByEmail(admin, email)
    if (user && !user.email_confirmed_at) {
      const code = generateSignupCode()
      await admin.auth.admin.updateUserById(user.id, {
        app_metadata: buildOtpMeta(user.app_metadata, code),
      })
      await sendSignupCodeEmail(email, code)
    }
  } catch (err) {
    console.error('[Forevr] signup-resend failed:', err)
  }
  return NextResponse.json({ ok: true })
}
