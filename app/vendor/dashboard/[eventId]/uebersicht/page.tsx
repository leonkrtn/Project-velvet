import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Calendar, MapPin, Users, Mail, Phone, UserCircle,
  UtensilsCrossed, MessageSquare, Grid2X2, Music2,
  Cake, Flower2, Camera, Clock, Heart, ArrowRight,
} from 'lucide-react'

interface Props { params: Promise<{ eventId: string }> }

type Access = 'none' | 'read' | 'write'

const ALL_MODULE_DEFS = [
  { key: 'catering',    label: 'Catering & Menü',    icon: UtensilsCrossed, href: 'catering' },
  { key: 'chats',       label: 'Chats',              icon: MessageSquare,   href: 'chats' },
  { key: 'ablaufplan',  label: 'Ablaufplan',         icon: Clock,           href: 'ablaufplan' },
  { key: 'gaesteliste', label: 'Gästeliste',         icon: Users,           href: 'gaesteliste' },
  { key: 'musik',       label: 'Musik',              icon: Music2,          href: 'musik' },
  { key: 'patisserie',  label: 'Patisserie',         icon: Cake,            href: 'patisserie' },
  { key: 'dekoration',  label: 'Dekoration',         icon: Flower2,         href: 'dekoration' },
  { key: 'medien',      label: 'Foto & Videograf',   icon: Camera,          href: 'medien' },
  { key: 'sitzplan',    label: 'Sitzplan',           icon: Grid2X2,         href: 'sitzplan' },
]

export default async function VendorUebersichtPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [eventRes, guestCountRes, membersRes, permsRes] = await Promise.all([
    supabase
      .from('events')
      .select('title, date, couple_name, venue, venue_address')
      .eq('id', eventId)
      .single(),
    supabase
      .from('v_event_guest_counts')
      .select('confirmed_guests, pending_guests, confirmed_plus_ones')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('event_members')
      .select('role, profiles!user_id(name, email)')
      .eq('event_id', eventId)
      .in('role', ['veranstalter', 'brautpaar']),
    supabase
      .from('dienstleister_permissions')
      .select('tab_key, access')
      .eq('event_id', eventId)
      .eq('dienstleister_user_id', user?.id ?? '')
      .is('item_id', null),
  ])

  const event = eventRes.data
  const guestCount = guestCountRes.data
  const members = membersRes.data ?? []
  const tabPerms: Record<string, Access> = {}
  for (const r of permsRes.data ?? []) {
    tabPerms[r.tab_key] = r.access as Access
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const veranstalter = members.filter((m: any) => m.role === 'veranstalter')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brautpaar = members.filter((m: any) => m.role === 'brautpaar')

  const confirmedTotal = (guestCount?.confirmed_guests ?? 0) + (guestCount?.confirmed_plus_ones ?? 0)
  const pendingTotal = guestCount?.pending_guests ?? 0

  const accessibleModules = ALL_MODULE_DEFS.filter(m => (tabPerms[m.key] ?? 'none') !== 'none')

  const base = `/vendor/dashboard/${eventId}`

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 6,
        }}>
          Übersicht
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--text-primary)', marginBottom: 0 }}>
          {event?.title ?? 'Veranstaltung'}
        </h1>
        {event?.couple_name && (
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Heart size={13} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            {event.couple_name}
          </p>
        )}
      </div>

      {/* Event details card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'var(--text-tertiary)',
        }}>
          Veranstaltungsdetails
        </div>
        <div style={{ padding: '4px 0' }}>
          <DetailRow icon={<Calendar size={15} />} label="Datum">
            {event?.date
              ? new Date(event.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
              : '—'}
          </DetailRow>
          <DetailRow icon={<MapPin size={15} />} label="Location">
            {event?.venue
              ? <>{event.venue}{event.venue_address ? <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>· {event.venue_address}</span> : null}</>
              : '—'}
          </DetailRow>
          <DetailRow icon={<Users size={15} />} label="Gästeanzahl" last>
            {confirmedTotal > 0
              ? <>{confirmedTotal} bestätigt{pendingTotal > 0 ? <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>· {pendingTotal} ausstehend</span> : null}</>
              : '—'}
          </DetailRow>
        </div>
      </div>

      {/* Contacts: Veranstalter + Brautpaar */}
      {(veranstalter.length > 0 || brautpaar.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: veranstalter.length > 0 && brautpaar.length > 0 ? '1fr 1fr' : '1fr',
          gap: 14,
          marginBottom: 40,
        }}
          className="contact-grid"
        >
          {veranstalter.length > 0 && (
            <ContactCard
              title="Veranstalter"
              icon={<UserCircle size={15} />}
              members={veranstalter}
            />
          )}
          {brautpaar.length > 0 && (
            <ContactCard
              title="Brautpaar"
              icon={<Heart size={15} style={{ color: 'var(--gold)' }} />}
              members={brautpaar}
            />
          )}
        </div>
      )}

      {/* Accessible modules */}
      {accessibleModules.length > 0 && (
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 14,
          }}>
            Meine Bereiche
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}>
            {accessibleModules.map(({ key, label, icon: Icon, href }) => {
              const access = tabPerms[key] ?? 'none'
              return (
                <Link
                  key={key}
                  href={`${base}/${href}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    textDecoration: 'none',
                    color: 'var(--text-primary)',
                    transition: 'box-shadow 0.12s, border-color 0.12s',
                  }}
                  className="module-card"
                >
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 9,
                    background: 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={17} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 1, color: 'var(--text-primary)' }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {access === 'write' ? 'Lesen & Schreiben' : 'Nur lesen'}
                    </p>
                  </div>
                  <ArrowRight size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 540px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
        .module-card:hover {
          box-shadow: var(--shadow-sm);
          border-color: var(--border-hover, var(--border));
        }
      `}</style>
    </div>
  )
}

function DetailRow({
  icon, label, children, last,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '13px 20px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ color: 'var(--text-tertiary)', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', width: 90, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>
        {children}
      </span>
    </div>
  )
}

function ContactCard({ title, icon, members }: {
  title: string
  icon: React.ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  members: any[]
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 7,
        fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--text-tertiary)',
      }}>
        {icon}
        {title}
      </div>
      <div style={{ padding: '8px 0' }}>
        {members.map((m, i) => {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
          return (
            <div key={i} style={{
              padding: '10px 18px',
              borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                {profile?.name ?? '—'}
              </p>
              {profile?.email && (
                <a href={`mailto:${profile.email}`} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 13, color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}>
                  <Mail size={12} style={{ flexShrink: 0 }} />
                  {profile.email}
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
