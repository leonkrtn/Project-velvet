'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Briefcase, MessageSquare, Mail, Phone, Globe, X, ChevronRight, Tag, ExternalLink,
} from 'lucide-react'
import ConversationChat from '@/components/chat/ConversationChat'

export interface ActiveVendor {
  userId: string
  conversationId: string | null
  name: string | null
  company: string | null
  category: string | null
  email: string | null
  phone: string | null
  website: string | null
  description: string | null
}

function initials(name: string) { return (name || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) }
function displayName(v: ActiveVendor) { return v.company || v.name || 'Dienstleister' }

export default function AktiveDienstleisterClient({ eventId, currentUserId, vendors }: {
  eventId: string; currentUserId: string; vendors: ActiveVendor[]
}) {
  const [selected, setSelected] = useState<ActiveVendor | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (vendors.length === 0) {
    return (
      <div className="bp-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
        <Briefcase size={28} style={{ opacity: 0.35, marginBottom: 12 }} />
        <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 6px' }}>Noch keine aktiven Dienstleister</p>
        <p className="bp-caption" style={{ margin: 0 }}>
          Sobald ein Dienstleister eure Anfrage annimmt oder eurer Veranstaltung beitritt, erscheint er hier.
        </p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {vendors.map(v => (
          <button key={v.userId} onClick={() => setSelected(v)} className="bp-card" style={{
            padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer',
            textAlign: 'left', fontFamily: 'inherit', width: '100%', border: '1px solid var(--bp-border, #e5e0d8)', background: '#fff',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--bp-gold-pale, #F5F0E8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, color: 'var(--bp-gold-deep, #9C7F4F)', fontSize: 14 }}>
              {initials(displayName(v))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 14.5, margin: 0, color: 'var(--bp-ink, #2b2b2b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(v)}</p>
              {v.category && <p className="bp-caption" style={{ margin: '2px 0 0', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Tag size={12} /> {v.category}</p>}
            </div>
            <ChevronRight size={18} style={{ color: 'var(--bp-ink-3, #999)', flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {selected && (
        <VendorLightbox vendor={selected} eventId={eventId} currentUserId={currentUserId} isMobile={isMobile} onClose={() => setSelected(null)} />
      )}
    </>
  )
}

function VendorLightbox({ vendor, eventId, currentUserId, isMobile, onClose }: {
  vendor: ActiveVendor; eventId: string; currentUserId: string; isMobile: boolean; onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const details = (
    <div style={{ padding: isMobile ? '18px' : '20px 22px', overflowY: 'auto', flex: isMobile ? '0 0 auto' : '1 1 0', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bp-gold-pale, #F5F0E8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, color: 'var(--bp-gold-deep, #9C7F4F)', fontSize: 17 }}>
          {initials(displayName(vendor))}
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: 'var(--bp-ink, #2b2b2b)' }}>{displayName(vendor)}</h2>
          {vendor.company && vendor.name && vendor.company !== vendor.name && <p className="bp-caption" style={{ margin: '2px 0 0' }}>{vendor.name}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {vendor.category && <Row icon={<Tag size={15} />} label="Kategorie">{vendor.category}</Row>}
        {vendor.email && <Row icon={<Mail size={15} />} label="E-Mail"><a href={`mailto:${vendor.email}`} style={linkStyle}>{vendor.email}</a></Row>}
        {vendor.phone && <Row icon={<Phone size={15} />} label="Telefon"><a href={`tel:${vendor.phone}`} style={linkStyle}>{vendor.phone}</a></Row>}
        {vendor.website && <Row icon={<Globe size={15} />} label="Website"><a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noreferrer" style={{ ...linkStyle, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{vendor.website} <ExternalLink size={12} /></a></Row>}
        {vendor.description && (
          <div style={{ marginTop: 6 }}>
            <p className="bp-label" style={{ marginBottom: 6 }}>Über</p>
            <p style={{ fontSize: 13.5, color: 'var(--bp-ink-2, #555)', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{vendor.description}</p>
          </div>
        )}
      </div>

      {isMobile && (
        <div style={{ marginTop: 22 }}>
          {vendor.conversationId ? (
            <Link href={`/brautpaar/${eventId}/nachrichten?c=${vendor.conversationId}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 12,
              background: 'var(--bp-gold, #B89968)', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 600,
            }}><MessageSquare size={16} /> Chat öffnen</Link>
          ) : (
            <p className="bp-caption" style={{ textAlign: 'center' }}>Chat wird vorbereitet…</p>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface, #fff)', borderRadius: isMobile ? 0 : 18,
        width: isMobile ? '100%' : 920, maxWidth: '100%',
        height: isMobile ? '100dvh' : '82vh', maxHeight: isMobile ? '100dvh' : '82vh',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden',
        boxShadow: '0 16px 60px rgba(0,0,0,0.25)', position: 'relative',
      }}>
        <button onClick={onClose} aria-label="Schließen" style={{ position: 'absolute', top: 14, right: 14, zIndex: 5, background: 'rgba(255,255,255,0.9)', border: '1px solid var(--bp-border, #e5e0d8)', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}><X size={17} /></button>

        {/* Details */}
        <div style={{ flex: isMobile ? '1 1 auto' : '0 0 360px', borderRight: isMobile ? 'none' : '1px solid var(--bp-border, #e5e0d8)', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: isMobile ? 'auto' : 'hidden' }}>
          {details}
        </div>

        {/* Chat (desktop only — mobile uses deep-link) */}
        {!isMobile && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--bp-border, #e5e0d8)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <MessageSquare size={16} style={{ color: 'var(--bp-gold, #B89968)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--bp-ink, #2b2b2b)' }}>Chat mit {displayName(vendor)}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {vendor.conversationId
                ? <ConversationChat eventId={eventId} conversationId={vendor.conversationId} currentUserId={currentUserId} />
                : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13 }}>Chat wird vorbereitet…</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const linkStyle: React.CSSProperties = { color: 'var(--bp-gold-deep, #9C7F4F)', textDecoration: 'none' }

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, fontSize: 13.5 }}>
      <span style={{ color: 'var(--bp-ink-3, #999)', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontWeight: 500, color: 'var(--bp-ink-3, #999)', width: 74, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--bp-ink, #2b2b2b)', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}
