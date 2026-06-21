import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Konstantzeitiger Vergleich — verhindert Timing-Seitenkanäle beim Secret-Check.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab) // Dummy-Vergleich, normalisiert das Timing
    return false
  }
  return timingSafeEqual(ab, bb)
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const adminSecret = process.env.ADMIN_SECRET
  const expected = `Bearer ${adminSecret ?? ''}`
  if (!adminSecret || !safeEqual(authHeader, expected)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const body = await request.json()
  const { userId } = body as { userId: string }

  if (!userId) {
    return NextResponse.json({ error: 'userId erforderlich' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin.rpc('approve_organizer', { p_user_id: userId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, userId })
}
