import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/require-admin'
import { sendEmailChecked } from '@/lib/email/notify'
import { testMailByKey, TEST_MAILS, TEST_MAIL_CATEGORIES } from '@/lib/admin/test-mails'

// GET — Katalog der testbaren Mails (für die „Testen"-Seite).
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({
    categories: TEST_MAIL_CATEGORIES,
    mails: TEST_MAILS.map(m => ({ key: m.key, category: m.category, label: m.label, description: m.description })),
  })
}

// POST — eine Beispiel-Mail an eine Zieladresse senden. Body: { key, to }
// Reine Beispiel-Mail (Dummy-Daten) — legt keine Datensätze an.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({})) as { key?: string; to?: string }
  const to = (body.to || '').trim()
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: 'Bitte eine gültige Zieladresse angeben.' }, { status: 400 })
  }
  const def = body.key ? testMailByKey(body.key) : undefined
  if (!def) return NextResponse.json({ error: 'Unbekannte Mail.' }, { status: 404 })

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY ist nicht konfiguriert — es kann nichts versendet werden.' }, { status: 503 })
  }

  try {
    const built = await def.build()
    const result = await sendEmailChecked({ to, subject: built.subject, html: built.html, attachments: built.attachments })
    if (!result.ok) return NextResponse.json({ error: result.error ?? 'Versand fehlgeschlagen.' }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Versand fehlgeschlagen.' }, { status: 500 })
  }
}
