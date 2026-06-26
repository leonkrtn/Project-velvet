'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Calendar, MapPin, Users, Mail, Phone, Heart, UserCircle, Tag,
  Lock, Check, Loader2,
} from 'lucide-react'

interface Contact { name: string | null; email: string | null; phone: string | null }
interface EventInfo {
  title: string; date: string | null; couple_name: string | null
  venue: string | null; venue_address: string | null; event_type: string | null
}
interface Props {
  eventId: string
  event: EventInfo
  confirmed: number
  pending: number
  veranstalter: Contact[]
  brautpaar: Contact[]
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  hochzeit: 'Hochzeit', firmenevent: 'Firmenevent', intern: 'Interne Veranstaltung',
}

export default function InformationenClient({ eventId, event, confirmed, pending, veranstalter, brautpaar }: Props) {
  const [notes, setNotes] = useState('')
  const [loadedNotes, setLoadedNotes] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`/api/vendor/notes?eventId=${eventId}`)
      .then(r => r.ok ? r.json() : { content: '' })
      .then(d => { setNotes(d.content ?? ''); setLoadedNotes(true) })
      .catch(() => setLoadedNotes(true))
  }, [eventId])

  const save = useCallback(async (content: string) => {
    setSaveState('saving')
    const res = await fetch('/api/vendor/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, content }),
    })
    setSaveState(res.ok ? 'saved' : 'idle')
    if (res.ok) setTimeout(() => setSaveState('idle'), 2000)
  }, [eventId])

  function onNotesChange(v: string) {
    setNotes(v)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(v), 800)
  }

  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1 }}>
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>

      {/* ── Title ── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Informationen</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>{event.title}</h1>
        {event.couple_name && (
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Heart size={13} style={{ color: 'var(--gold)' }} />{event.couple_name}
          </p>
        )}
      </div>

      {/* ── Two-column layout ── */}
      <div className="info-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: Details + Contacts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Veranstaltungsdetails">
            {event.event_type && <DetailRow icon={<Tag size={15} />} label="Art">{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</DetailRow>}
            <DetailRow icon={<Calendar size={15} />} label="Datum">
              {event.date ? new Date(event.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
            </DetailRow>
            <DetailRow icon={<MapPin size={15} />} label="Location">
              {event.venue ? <>{event.venue}{event.venue_address ? <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>· {event.venue_address}</span> : null}</> : '—'}
            </DetailRow>
            <DetailRow icon={<Users size={15} />} label="Gäste" last>
              {confirmed > 0 ? <>{confirmed} bestätigt{pending > 0 ? <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>· {pending} ausstehend</span> : null}</> : '—'}
            </DetailRow>
          </Card>

          {(brautpaar.length > 0 || veranstalter.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: brautpaar.length && veranstalter.length ? '1fr 1fr' : '1fr', gap: 14 }} className="info-contact-grid">
              {brautpaar.length > 0 && <ContactCard title="Brautpaar" icon={<Heart size={14} style={{ color: 'var(--gold)' }} />} contacts={brautpaar} />}
              {veranstalter.length > 0 && <ContactCard title="Veranstalter" icon={<UserCircle size={14} />} contacts={veranstalter} />}
            </div>
          )}
        </div>

        {/* Right: Internal notes */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Lock size={14} style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', margin: 0 }}>Interne Notizen</p>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {saveState === 'saving' && <><Loader2 size={12} className="spin" /> Speichert…</>}
              {saveState === 'saved' && <><Check size={12} /> Gespeichert</>}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>
            Nur für euer Team sichtbar — das Brautpaar kann diese Notizen nicht sehen.
          </p>
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            disabled={!loadedNotes}
            placeholder="z. B. Anfahrt, Ansprechpartner vor Ort, interne To-Dos…"
            rows={10}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '14px 16px',
              border: '1px solid var(--border)', borderRadius: 12, fontSize: 14.5, lineHeight: 1.6,
              fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: 'var(--surface)', color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .info-two-col { grid-template-columns: 1fr !important; } }
        @media (max-width: 540px) { .info-contact-grid { grid-template-columns: 1fr !important; } }
        .spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{title}</div>
      <div style={{ padding: '4px 0' }}>{children}</div>
    </div>
  )
}

function DetailRow({ icon, label, children, last }: { icon: React.ReactNode; label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 20px', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-tertiary)', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', width: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>{children}</span>
    </div>
  )
}

function ContactCard({ title, icon, contacts }: { title: string; icon: React.ReactNode; contacts: Contact[] }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
        {icon}{title}
      </div>
      <div style={{ padding: '8px 0' }}>
        {contacts.map((c, i) => (
          <div key={i} style={{ padding: '10px 18px', borderBottom: i < contacts.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{c.name ?? '—'}</p>
            {c.email && (
              <a href={`mailto:${c.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 3 }}>
                <Mail size={12} style={{ flexShrink: 0 }} />{c.email}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                <Phone size={12} style={{ flexShrink: 0 }} />{c.phone}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
