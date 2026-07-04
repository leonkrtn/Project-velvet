export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSubscriptionState } from '@/lib/subscription'
import { ensureVendorConversation, backfillVendorChatParticipants } from '@/lib/vendor/ensureChat'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, SlidersHorizontal, Sparkles } from 'lucide-react'
import VendorInviteSection from './VendorInviteSection'
import DienstleisterTabs from './DienstleisterTabs'
import MarktplatzClient from './entdecken/MarktplatzClient'
import AktiveDienstleisterClient, { type ActiveVendor } from './AktiveDienstleisterClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  params: Promise<{ eventId: string }>
}

// Dienstleister-Bereich für ALLE Brautpaare:
//  - "Entdecken" (Marktplatz) — jedes Brautpaar.
//  - "Aktive Dienstleister" — aktuelle Zusammenarbeit + Chat, jedes Brautpaar.
//  - "Meine Dienstleister" (Einladen + Datenfreigaben) nur für Solo-Brautpaare.
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

  // ── Aktive Dienstleister (für alle Brautpaare) ──────────────────────────────
  const admin = createAdminClient()
  // Bestehende Vendor-Chats für die ganze Brautpaar-/Veranstalter-Seite sichtbar machen.
  await backfillVendorChatParticipants(admin, eventId)

  const { data: dlMembers } = await admin
    .from('event_members')
    .select('user_id, profiles!user_id(id, name, email, phone)')
    .eq('event_id', eventId)
    .eq('role', 'dienstleister')

  const dlUserIds = (dlMembers ?? []).map((m: any) => m.user_id)
  const firmByUser: Record<string, any> = {}
  if (dlUserIds.length) {
    const { data: uds } = await admin
      .from('user_dienstleister')
      .select('user_id, dienstleister_profiles ( company_name, category, website, description )')
      .in('user_id', dlUserIds)
    for (const ud of (uds ?? []) as any[]) {
      const dp = Array.isArray(ud.dienstleister_profiles) ? ud.dienstleister_profiles[0] : ud.dienstleister_profiles
      if (dp && !firmByUser[ud.user_id]) firmByUser[ud.user_id] = dp
    }
  }

  const activeVendors: ActiveVendor[] = []
  for (const m of (dlMembers ?? []) as any[]) {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    const dp = firmByUser[m.user_id]
    const conversationId = await ensureVendorConversation(admin, eventId, m.user_id)
    activeVendors.push({
      userId: m.user_id,
      conversationId,
      name: profile?.name ?? null,
      company: dp?.company_name ?? null,
      category: dp?.category ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      website: dp?.website ?? null,
      description: dp?.description ?? null,
    })
  }
  const active = <AktiveDienstleisterClient eventId={eventId} currentUserId={user.id} vendors={activeVendors} />

  // Brautpaar MIT Veranstalter: Entdecken + Aktive Dienstleister + Meine Anfragen.
  if (!isSolo) {
    return (
      <div className="bp-page">
        {header}
        <DienstleisterTabs eventId={eventId} isSolo={false} discover={discover} active={active} />
      </div>
    )
  }

  // ── Solo: Verwaltungs-Tab vorbereiten ───────────────────────────────────────
  const rows = activeVendors.map(v => ({ id: v.userId, userId: v.userId, name: v.name, email: v.email }))

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
            Eure verbundenen Dienstleister behalten ihren Zugriff. Datenfreigaben ändern und
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
            dann könnt ihr seine Datenfreigaben festlegen.
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
                Datenfreigaben
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
      <DienstleisterTabs eventId={eventId} isSolo discover={discover} active={active} manage={manage} />
    </div>
  )
}
