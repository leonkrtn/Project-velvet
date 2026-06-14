export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSubscriptionState } from '@/lib/subscription'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, SlidersHorizontal, Sparkles } from 'lucide-react'
import VendorInviteSection from './VendorInviteSection'
import DienstleisterTabs from './DienstleisterTabs'
import MarktplatzClient from './entdecken/MarktplatzClient'

interface Props {
  params: Promise<{ eventId: string }>
}

// Dienstleister-Bereich für ALLE Brautpaare:
//  - "Entdecken" (Marktplatz) ist für jedes Brautpaar verfügbar (ohne Pro).
//  - "Meine Dienstleister" (Einladen + Rechte) nur für Solo-Brautpaare — bei
//    Brautpaaren mit Veranstalter übernimmt das der Veranstalter im eigenen Portal.
export default async function BrautpaarDienstleisterPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) redirect('/login')
  const isSolo = member.role === 'brautpaar_solo'

  const header = (
    <div className="bp-page-header">
      <h1 className="bp-page-title">Dienstleister</h1>
      <p className="bp-page-subtitle">
        Dienstleister im Marktplatz entdecken{isSolo ? ' und eigene Dienstleister verwalten' : ''}
      </p>
    </div>
  )

  const discover = <MarktplatzClient eventId={eventId} />

  // Brautpaar MIT Veranstalter: nur Marktplatz.
  if (!isSolo) {
    return (
      <div className="bp-page">
        {header}
        <DienstleisterTabs isSolo={false} discover={discover} />
      </div>
    )
  }

  // ── Solo: Verwaltungs-Tab vorbereiten ───────────────────────────────────────
  const admin = createAdminClient()
  const { data: vendors } = await admin
    .from('event_members')
    .select('id, user_id, profiles!user_id(id, name, email)')
    .eq('event_id', eventId)
    .eq('role', 'dienstleister')

  const rows = (vendors ?? []).map(v => {
    const profile = Array.isArray(v.profiles) ? (v.profiles[0] ?? null) : v.profiles
    return { id: v.id, userId: v.user_id, name: profile?.name ?? null, email: profile?.email ?? null }
  })

  // Dienstleister-Verwaltung ist ein Pro-Feature (Marktplatz bleibt frei).
  const subscription = await getSubscriptionState(eventId)
  const gated = subscription.gated && !subscription.isPro

  const manage = gated ? (
    <div>
      <div className="bp-paywall-card" style={{ margin: 0 }}>
        <div className="bp-paywall-icon"><Sparkles size={24} /></div>
        <h2 className="bp-font-heading" style={{ fontSize: '1.45rem', margin: '0 0 0.6rem', color: 'var(--bp-ink)' }}>
          Teil von Forevr Pro
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--bp-ink-2)', margin: '0 0 1.5rem', lineHeight: 1.65 }}>
          Mit Forevr Pro ladet ihr Caterer, DJ, Florist und weitere Dienstleister direkt in eure
          Planung ein — jeder sieht genau die Module, die ihr freigebt. Upgrade jederzeit,
          eure Planung bleibt vollständig erhalten.
        </p>
        <Link
          href={`/brautpaar/${eventId}/abo`}
          style={{
            display: 'inline-block', color: '#fff', borderRadius: 999,
            padding: '0.7rem 1.7rem', textDecoration: 'none',
            fontSize: '0.875rem', fontWeight: 600,
            background: 'linear-gradient(135deg, #C9AE7D, var(--bp-gold-deep))',
            boxShadow: '0 4px 14px rgba(156,127,79,0.32)',
          }}
        >
          Auf Forevr Pro upgraden
        </Link>
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: '1.75rem', maxWidth: 460 }}>
          <p className="bp-label" style={{ marginBottom: '0.6rem' }}>Bereits verbunden</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {rows.map(v => (
              <div key={v.id} className="bp-card" style={{ padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Briefcase size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{v.name ?? v.email ?? 'Dienstleister'}</p>
                  {v.name && v.email && <p className="bp-caption" style={{ margin: 0 }}>{v.email}</p>}
                </div>
              </div>
            ))}
          </div>
          <p className="bp-caption" style={{ marginTop: '0.6rem', lineHeight: 1.5 }}>
            Eure verbundenen Dienstleister behalten ihren Zugriff. Berechtigungen ändern und
            neue Dienstleister einladen ist Teil von Forevr Pro.
          </p>
        </div>
      )}
    </div>
  ) : (
    <div>
      <VendorInviteSection eventId={eventId} />
      {rows.length === 0 ? (
        <div className="bp-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
          <Briefcase size={28} style={{ opacity: 0.35, marginBottom: 12 }} />
          <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 6px' }}>Noch keine Dienstleister verbunden</p>
          <p className="bp-caption" style={{ margin: 0 }}>
            Sobald ein eingeladener Dienstleister sich registriert hat, erscheint er hier —
            dann könnt ihr seine Zugriffsrechte festlegen.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {rows.map(v => (
            <div key={v.id} className="bp-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Briefcase size={18} style={{ flexShrink: 0, opacity: 0.6 }} />
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{v.name ?? v.email ?? 'Dienstleister'}</p>
                {v.name && v.email && <p className="bp-caption" style={{ margin: 0 }}>{v.email}</p>}
              </div>
              <Link
                href={`/brautpaar/${eventId}/dienstleister/${v.userId}`}
                className="bp-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <SlidersHorizontal size={14} />
                Berechtigungen
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="bp-page">
      {header}
      <DienstleisterTabs isSolo discover={discover} manage={manage} />
    </div>
  )
}
