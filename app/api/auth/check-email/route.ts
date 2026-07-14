import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findAuthUserByEmail } from '@/lib/auth/signup-code'

export const dynamic = 'force-dynamic'

// Leichte Verfügbarkeitsprüfung für Signup-Formulare (onBlur), damit
// EMAIL_TAKEN nicht erst nach vollständigem Ausfüllen des Formulars auffällt.
// Erzeugt anders als signup-start KEINEN Auth-User.
export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'INVALID' }, { status: 400 }) }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ taken: false })

  let admin
  try { admin = createAdminClient() } catch {
    return NextResponse.json({ taken: false })
  }

  try {
    const existing = await findAuthUserByEmail(admin, email)
    const taken = !!existing?.email_confirmed_at
    return NextResponse.json({ taken })
  } catch (err) {
    console.error('[Forevr] check-email failed:', err)
    return NextResponse.json({ taken: false })
  }
}
