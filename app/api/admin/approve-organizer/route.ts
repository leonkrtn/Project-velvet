// app/api/admin/approve-organizer/route.ts
// Manuelle Genehmigung / Ablehnung von Veranstalter-Bewerbungen
// Geschützt durch ADMIN_SECRET Header
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  // Admin-Authentifizierung via Secret-Header
  const authHeader = request.headers.get('Authorization')
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const body = await request.json()
  const { userId, decision } = body as { userId: string; decision: 'approved' | 'rejected' }

  if (!userId || !['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'userId und decision (approved|rejected) erforderlich' }, { status: 400 })
  }

  const admin = getServiceClient()

  // organizer_applications updaten
  const { error: appErr } = await admin.from('organizer_applications').update({
    status: decision,
    reviewed_at: new Date().toISOString(),
  }).eq('user_id', userId)

  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 })

  // Bei Genehmigung: is_approved_organizer setzen
  if (decision === 'approved') {
    const { error: profErr } = await admin.from('profiles').update({
      is_approved_organizer: true,
      application_status: 'approved',
    }).eq('id', userId)

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })
  } else {
    await admin.from('profiles').update({
      application_status: 'rejected',
    }).eq('id', userId)
  }

  return NextResponse.json({ success: true, userId, decision })
}
