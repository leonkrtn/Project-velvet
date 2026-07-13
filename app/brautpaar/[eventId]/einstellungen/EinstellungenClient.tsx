'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, FileDown, CreditCard, GraduationCap, ChevronRight, User } from 'lucide-react'
import DisplaySettingsLauncher from '@/components/display-studio/DisplaySettingsLauncher'
import SoloInviteSection from '../allgemein/SoloInviteSection'
import { TOUR_START_EVENT } from '@/components/tour/ProductTour'
import { BILLING_ENABLED } from '@/lib/billing'

interface Props {
  eventId: string
  currentUserId: string
  isSolo: boolean
  /** Es gibt einen Veranstalter im Event → das Paar zahlt nicht selbst (Abo ausblenden). */
  hasOrganizer: boolean
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 44, height: 44, borderRadius: 12,
  background: 'var(--bp-gold-pale)', color: 'var(--bp-gold-deep)', flexShrink: 0,
}

function LauncherCard({
  icon, title, desc, action,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  action: React.ReactNode
}) {
  return (
    <div className="bp-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={badgeStyle}>{icon}</span>
        <div>
          <h2 className="bp-section-title" style={{ margin: 0 }}>{title}</h2>
          <p className="bp-caption" style={{ margin: '2px 0 0', maxWidth: 460 }}>{desc}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

export default function EinstellungenClient({ eventId, currentUserId, isSolo, hasOrganizer }: Props) {
  const [query, setQuery] = useState('')

  const sections = useMemo(() => {
    const list: { key: string; keywords: string; node: React.ReactNode }[] = [
      {
        key: 'profil',
        keywords: 'profil account konto name email passwort löschen abmelden',
        node: (
          <LauncherCard
            icon={<User size={20} />}
            title="Profil"
            desc="Name, E-Mail, Passwort, Abmelden und Account löschen — alles an einem Ort."
            action={
              <Link href={`/brautpaar/${eventId}/profil`} className="bp-btn bp-btn-primary">
                Öffnen <ChevronRight size={16} />
              </Link>
            }
          />
        ),
      },
      {
        key: 'anzeige',
        keywords: 'anzeige anzeigeeinstellungen design farben schriften bilder einladungsseite rsvp gestalten',
        node: <DisplaySettingsLauncher eventId={eventId} />,
      },
      {
        key: 'einladen',
        keywords: 'personen einladen partner partnerin code link veranstalter',
        // Veranstalter-Onboarding ist ein Pro-Feature — in der Gratis-Phase aus.
        node: (
          <SoloInviteSection
            eventId={eventId}
            currentUserId={currentUserId}
            partnerTarget={isSolo ? 'brautpaar_solo' : 'brautpaar'}
            showOrganizer={isSolo && BILLING_ENABLED}
          />
        ),
      },
      {
        key: 'pdf',
        keywords: 'pdf export drucken dokument exportieren gästeliste ablaufplan',
        node: (
          <LauncherCard
            icon={<FileDown size={20} />}
            title="PDF-Export"
            desc="Exportiert eure Planung als PDF – Gästeliste, Ablaufplan und mehr, druckfertig."
            action={
              <Link href={`/brautpaar/${eventId}/pdf-export`} className="bp-btn bp-btn-primary">
                Öffnen <ChevronRight size={16} />
              </Link>
            }
          />
        ),
      },
      ...(!hasOrganizer && BILLING_ENABLED ? [{
        key: 'abo',
        keywords: 'abo tarif abonnement forevr pro zahlung rechnung upgrade',
        node: (
          <LauncherCard
            icon={<CreditCard size={20} />}
            title="Abo & Tarif"
            desc="Verwaltet euren Forevr-Tarif und schaltet Pro-Funktionen frei."
            action={
              <Link href={`/brautpaar/${eventId}/abo`} className="bp-btn bp-btn-primary">
                Verwalten <ChevronRight size={16} />
              </Link>
            }
          />
        ),
      }] : []),
      {
        key: 'tutorial',
        keywords: 'tutorial tour hilfe einführung anleitung onboarding rundgang',
        node: (
          <LauncherCard
            icon={<GraduationCap size={20} />}
            title="Tutorial"
            desc="Startet die geführte Tour durch Forevr und lernt alle Funktionen kennen."
            action={
              <button
                type="button"
                className="bp-btn bp-btn-primary"
                onClick={() => window.dispatchEvent(new Event(TOUR_START_EVENT))}
              >
                Tutorial starten
              </button>
            }
          />
        ),
      },
    ]
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(s => s.keywords.includes(q) || s.keywords.split(' ').some(w => w.startsWith(q)))
  }, [eventId, currentUserId, isSolo, hasOrganizer, query])

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Einstellungen</h1>
        <p className="bp-page-subtitle">Anzeige, Einladungen, Export und mehr an einem Ort.</p>
      </div>

      {/* Suchfeld */}
      <div style={{ position: 'relative', maxWidth: 420, marginBottom: '1.5rem' }}>
        <Search
          size={16}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--bp-ink-3)', pointerEvents: 'none' }}
        />
        <input
          className="bp-input"
          style={{ paddingLeft: 36 }}
          placeholder="Einstellungen durchsuchen …"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Einstellungen durchsuchen"
        />
      </div>

      {sections.length === 0 ? (
        <p style={{ color: 'var(--bp-ink-3)', fontSize: '0.9375rem' }}>
          Keine Einstellung gefunden für &quot;{query}&quot;.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {sections.map(s => (
            <div key={s.key}>{s.node}</div>
          ))}
        </div>
      )}
    </div>
  )
}
