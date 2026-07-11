import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — zählt eine Interaktion mit einem Anbieter-Listing (cookielos, serverseitig).
// Body: { vendorId, type, meta? }. 'request' wird separat serverseitig gezählt.
const CLIENT_TYPES = ['profile_view', 'contact_email', 'contact_phone', 'website', 'social'] as const

export async function POST(req: NextRequest) {
  const { vendorId, type, meta } = await req.json().catch(() => ({})) as {
    vendorId?: string; type?: string; meta?: Record<string, unknown>
  }
  if (!vendorId || !type || !(CLIENT_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Nur eingeloggte Nutzer zählen (reduziert Bot-/Fremd-Traffic). Kein Personenbezug gespeichert.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true }) // still no error

  try {
    const admin = createAdminClient()
    await admin.from('marketplace_vendor_events').insert({
      dienstleister_id: vendorId,
      event_type: type,
      meta: meta ?? null,
    })
  } catch {
    /* Tracking darf nie einen Flow blockieren (z. B. wenn Migration noch nicht angewandt). */
  }
  return NextResponse.json({ ok: true })
}
