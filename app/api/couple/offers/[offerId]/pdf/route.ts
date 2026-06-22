import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildOfferPdfData } from '@/lib/vendor/offer-pdf-data'
import { renderOfferPdf } from '@/lib/vendor/offer-pdf'

export const runtime = 'nodejs'

const COUPLE_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

// GET — Angebots-PDF fuer das Brautpaar (nur ab Freigabe).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { offerId } = await params

  const admin = createAdminClient()
  const { data: offer } = await admin.from('vendor_offers').select('*').eq('id', offerId).maybeSingle()
  if (!offer || ['draft', 'superseded'].includes(offer.status)) {
    return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 })
  }
  const { data: member } = await admin
    .from('event_members').select('role').eq('event_id', offer.event_id).eq('user_id', user.id).maybeSingle()
  if (!member || !COUPLE_ROLES.includes(member.role)) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const pdf = await renderOfferPdf(await buildOfferPdfData(admin, offer))
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Angebot-${offerId.slice(0, 8)}.pdf"`,
    },
  })
}
