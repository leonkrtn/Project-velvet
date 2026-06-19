// app/einladung/[token]/page.tsx
// Früher: öffentliche Sammel-Link-Selbstregistrierung. Diese Funktion ist jetzt Teil der
// Hochzeitswebsite (RSVP → "Neu anmelden"). Die Route leitet nur noch dorthin weiter.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function OpenInviteRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let admin: ReturnType<typeof createAdminClient> | null = null
  try { admin = createAdminClient() } catch { admin = null }

  const { data: ev } = admin
    ? await admin.from('events').select('id').eq('open_invite_token', token).maybeSingle()
    : { data: null }

  if (admin && ev) {
    const { data: site } = await admin
      .from('wedding_sites')
      .select('slug')
      .eq('event_id', ev.id)
      .maybeSingle()
    if (site?.slug) redirect(`/wedding/${site.slug}/rsvp`)
  }

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
