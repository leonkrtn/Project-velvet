// app/rsvp/[token]/page.tsx
// Das frühere, eigenständige RSVP-Formular wurde durch die Hochzeitswebsite ersetzt.
// Diese Route bleibt nur als Weiterleitung bestehen, damit bereits geteilte Links/QR-Codes
// die Gäste direkt in das Website-RSVP mit vorausgefülltem persönlichem Code führen.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function RsvpRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let admin: ReturnType<typeof createAdminClient> | null = null
  try { admin = createAdminClient() } catch { admin = null }

  const { data: guest } = admin
    ? await admin.from('guests').select('event_id, short_code').eq('token', token).maybeSingle()
    : { data: null }

  if (admin && guest) {
    const { data: site } = await admin
      .from('wedding_sites')
      .select('slug')
      .eq('event_id', guest.event_id)
      .maybeSingle()
    if (site?.slug) {
      const code = guest.short_code ? `?code=${guest.short_code}` : ''
      redirect(`/wedding/${site.slug}/rsvp${code}`)
    }
  }

  // Keine veröffentlichte Website vorhanden → freundlicher Hinweis.
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', gap: '0.75rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem' }}>Einladung noch nicht verfügbar</h1>
      <p style={{ color: '#666', maxWidth: 420 }}>
        Die Hochzeitswebsite zu dieser Einladung ist derzeit nicht erreichbar. Bitte versuche es später erneut.
      </p>
      <Link href="/" style={{ color: '#9c7f4f' }}>Zur Startseite</Link>
    </div>
  )
}
