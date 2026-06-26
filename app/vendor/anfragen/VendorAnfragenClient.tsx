'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  X, MapPin, Calendar, Euro, Inbox,
  Heart, Loader2, Users, Mail, Phone, Tag, ArrowRight, ReceiptText, Search, Trash2,
} from 'lucide-react'
import VendorOfferEditor from '@/components/vendor/VendorOfferEditor'

interface Contact { name: string | null; email: string | null; phone: string | null }
interface Req {
  id: string
  event_id: string
  message: string
  budget: number | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  conversation_id: string | null
  created_at: string
  events: {
    title: string; couple_name: string | null; date: string | null
    location_name: string | null; location_city: string | null
    venue: string | null; venue_address: string | null; event_type: string | null
  } | null
  requester: Contact | null
  guest_count: { confirmed: number; pending: number } | null
  couple_contacts: Contact[]
}

const statusMeta: Record<Req['status'], { label: string; bg: string; fg: string }> = {
  pending:   { label: 'Offen',         bg: 'rgba(184,153,104,0.14)', fg: 'var(--gold, #B89968)' },
  accepted:  { label: 'Angenommen',    bg: 'rgba(30,126,52,0.12)',   fg: '#1E7E34' },
  declined:  { label: 'Abgelehnt',     bg: 'rgba(197,34,31,0.10)',   fg: '#C5221F' },
  cancelled: { label: 'Zurückgezogen', bg: 'var(--bg)',              fg: 'var(--text-dim)' },
}
const EVENT_TYPE_LABELS: Record<string, string> = { hochzeit: 'Hochzeit', firmenevent: 'Firmenevent', intern: 'Interne Veranstaltung' }

type Filter = 'offen' | 'angenommen' | 'erledigt'

function locationOf(e: Req['events']): string {
  if (!e) return ''
  if (e.venue) return [e.venue, e.venue_address].filter(Boolean).join(', ')
  return [e.location_name, e.location_city].filter(Boolean).join(', ')
}
function titleOf(r: Req): string { return r.events?.couple_name || r.events?.title || 'Hochzeit' }

export default function VendorAnfragenClient() {
  const [requests, setRequests] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [isVendor, setIsVendor] = useState(true)
  const [filter, setFilter] = useState<Filter>('offen')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/marketplace/vendor-requests')
    const json = await res.json()
    setRequests(json.requests ?? [])
    setIsVendor(json.isVendor !== false)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const counts = useMemo(() => ({
    offen:      requests.filter(r => r.status === 'pending').length,
    angenommen: requests.filter(r => r.status === 'accepted').length,
    erledigt:   requests.filter(r => r.status === 'declined' || r.status === 'cancelled').length,
  }), [requests])

  useEffect(() => {
    if (loading) return
    if (counts.offen === 0 && counts.angenommen > 0) setFilter('angenommen')
    else if (counts.offen === 0 && counts.angenommen === 0 && counts.erledigt > 0) setFilter('erledigt')
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const byFilter = requests.filter(r => {
      if (filter === 'offen') return r.status === 'pending'
      if (filter === 'angenommen') return r.status === 'accepted'
      return r.status === 'declined' || r.status === 'cancelled'
    })
    if (!search.trim()) return byFilter
    const q = search.trim().toUpperCase()
    return byFilter.filter(r =>
      titleOf(r).toUpperCase().includes(q) ||
      (r.events?.date ? new Date(r.events.date).toLocaleDateString('de-DE') : '').includes(q) ||
      (r.requester?.name ?? '').toUpperCase().includes(q) ||
      r.id.toUpperCase().includes(q)
    )
  }, [requests, filter, search])

  const selected = useMemo(() => requests.find(r => r.id === selectedId) ?? null, [requests, selectedId])

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'offen',      label: 'Offen',      count: counts.offen },
    { key: 'angenommen', label: 'Angenommen', count: counts.angenommen },
    { key: 'erledigt',   label: 'Erledigt',   count: counts.erledigt },
  ]

  return (
    <div style={{ background: 'var(--bg)', flex: 1, padding: '28px 24px 48px', overflow: 'auto' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Inbox size={20} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Anfragen</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 2 }}>Anfragen von Brautpaaren aus dem Marktplatz.</p>
          </div>
        </div>

        {isVendor && !loading && requests.length > 0 && (
          <div style={{ position: 'relative', margin: '22px 0 12px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nach Brautpaar, Datum oder ID suchen …"
              style={{ width: '100%', padding: '10px 14px 10px 34px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: 'var(--text)' }}
              onFocus={e => { e.target.style.borderColor = 'var(--gold)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>
        )}

        {isVendor && !loading && requests.length > 0 && (
          <div data-tour="vdr-anfragen-filters" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {tabs.map(t => {
              const active = filter === t.key
              return (
                <button key={t.key} onClick={() => setFilter(t.key)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`, background: active ? 'var(--gold)' : 'var(--bg)', color: active ? '#fff' : 'var(--text)',
                  transition: 'box-shadow .15s, border-color .15s',
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--accent)' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' } }}
                >
                  {t.label}
                  <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 100, minWidth: 18, textAlign: 'center', padding: '0 5px', background: active ? 'rgba(255,255,255,0.25)' : 'var(--border)', color: active ? '#fff' : 'var(--text-dim)' }}>{t.count}</span>
                </button>
              )
            })}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 14, padding: '30px 0' }}>
            <Loader2 size={16} className="anf-spin" /> Lädt…
          </div>
        ) : !isVendor ? (
          <EmptyState title="Nur für Marktplatz-Dienstleister" text="Dieser Bereich ist nur für Anbieter mit Marktplatz-Profil verfügbar." />
        ) : requests.length === 0 ? (
          <EmptyState title="Noch keine Anfragen" text="Sobald ein Brautpaar dich über den Marktplatz anfragt, erscheint die Anfrage hier." />
        ) : visible.length === 0 ? (
          <EmptyState title="Nichts hier" text={`Keine Anfragen im Bereich „${tabs.find(t => t.key === filter)?.label}".`} />
        ) : (
          <div data-tour="vdr-anfragen-list" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            {visible.map(r => <RequestTile key={r.id} r={r} onOpen={() => setSelectedId(r.id)} />)}
          </div>
        )}
      </div>

      {selected && (
        <RequestLightbox r={selected} onClose={() => setSelectedId(null)} onReload={load} />
      )}

      <style>{`.anf-spin { animation: anfspin 1s linear infinite; } @keyframes anfspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function RequestTile({ r, onOpen }: { r: Req; onOpen: () => void }) {
  const m = statusMeta[r.status]
  const loc = locationOf(r.events)
  return (
    <button onClick={onOpen} style={{
      textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', width: '100%',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md, 14px)',
      padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16,
      transition: 'box-shadow .15s, border-color .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {/* Avatar */}
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(184,153,104,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Heart size={18} style={{ color: 'var(--gold)' }} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{titleOf(r)}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 100, background: m.bg, color: m.fg, flexShrink: 0, whiteSpace: 'nowrap' }}>{m.label}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6 }}>
          {r.events?.date && <TileLine icon={<Calendar size={13} />} text={new Date(r.events.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })} />}
          {loc && <TileLine icon={<MapPin size={13} />} text={loc} />}
          {r.guest_count && r.guest_count.confirmed > 0 && <TileLine icon={<Users size={13} />} text={`${r.guest_count.confirmed} Gäste`} />}
          {r.budget != null && <TileLine icon={<Euro size={13} />} text={`${r.budget.toLocaleString('de-DE')} €`} />}
          <TileLine icon={<Heart size={13} />} text={`von ${r.requester?.name ?? 'Brautpaar'}`} />
        </div>
        {r.message && <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '8px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.message}</p>}
      </div>

      {/* Action */}
      <span className="anf-details" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--gold)', flexShrink: 0 }}>
        Details <ArrowRight size={15} />
      </span>
    </button>
  )
}

function RequestLightbox({ r, onClose, onReload }: { r: Req; onClose: () => void; onReload: () => void }) {
  const m = statusMeta[r.status]
  const loc = locationOf(r.events)
  const contacts = r.couple_contacts.length ? r.couple_contacts : (r.requester ? [r.requester] : [])
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleDelete() {
    if (!confirm('Anfrage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
    setDeleting(true)
    const res = await fetch(`/api/marketplace/vendor-requests?id=${r.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) { onClose(); onReload() }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, width: 560, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md, 0 12px 48px rgba(0,0,0,0.2))' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Heart size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>{titleOf(r)}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: m.bg, color: m.fg }}>{m.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Angefragt am {new Date(r.created_at).toLocaleDateString('de-DE')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button onClick={handleDelete} disabled={deleting} title="Anfrage löschen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4, borderRadius: 6, opacity: deleting ? 0.5 : 1 }}>
              {deleting ? <Loader2 size={16} className="anf-spin" /> : <Trash2 size={16} />}
            </button>
            <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 2 }}><X size={20} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 22, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Section title="Veranstaltung">
            {r.events?.event_type && <DetailRow icon={<Tag size={15} />} label="Art">{EVENT_TYPE_LABELS[r.events.event_type] ?? r.events.event_type}</DetailRow>}
            <DetailRow icon={<Calendar size={15} />} label="Datum">{r.events?.date ? new Date(r.events.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</DetailRow>
            <DetailRow icon={<MapPin size={15} />} label="Location">{loc || '—'}</DetailRow>
            <DetailRow icon={<Users size={15} />} label="Gäste">
              {r.guest_count && r.guest_count.confirmed > 0
                ? <>{r.guest_count.confirmed} bestätigt{r.guest_count.pending > 0 ? <span style={{ color: 'var(--text-dim)' }}> · {r.guest_count.pending} ausstehend</span> : null}</>
                : '—'}
            </DetailRow>
            {r.budget != null && <DetailRow icon={<Euro size={15} />} label="Budget">{r.budget.toLocaleString('de-DE')} €</DetailRow>}
          </Section>

          {contacts.length > 0 && (
            <Section title="Kontakt zum Brautpaar">
              {contacts.map((c, i) => (
                <div key={i} style={{ padding: '4px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none', marginTop: i > 0 ? 6 : 0, paddingTop: i > 0 ? 10 : 4 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>{c.name ?? 'Brautpaar'}</p>
                  {c.email && <ContactLink icon={<Mail size={13} />} href={`mailto:${c.email}`} text={c.email} />}
                  {c.phone && <ContactLink icon={<Phone size={13} />} href={`tel:${c.phone}`} text={c.phone} />}
                  {!c.email && !c.phone && <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Keine Kontaktdaten hinterlegt.</span>}
                </div>
              ))}
            </Section>
          )}

          {r.message && (
            <Section title="Nachricht">
              <p style={{ fontSize: 14, color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{r.message}</p>
            </Section>
          )}

          {r.status !== 'cancelled' && (
            <Section title="Angebot">
              <VendorOfferEditor requestId={r.id} eventId={r.event_id} requestStatus={r.status} onChanged={onReload} />
              {r.status === 'accepted' && (
                <Link href={`/vendor/dashboard/${r.event_id}/angebote`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none', marginTop: 12 }}>
                  <ReceiptText size={14} /> Angebote &amp; Verträge im Event verwalten <ArrowRight size={14} />
                </Link>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', margin: '0 0 10px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
    </div>
  )
}
function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14 }}>
      <span style={{ color: 'var(--text-dim)', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontWeight: 500, color: 'var(--text-dim)', width: 76, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', flex: 1 }}>{children}</span>
    </div>
  )
}
function ContactLink({ icon, href, text }: { icon: React.ReactNode; href: string; text: string }) {
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'var(--text-secondary, #555)', textDecoration: 'none', marginBottom: 4 }}>
      <span style={{ color: 'var(--text-dim)', flexShrink: 0, display: 'flex' }}>{icon}</span>{text}
    </a>
  )
}
function TileLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-dim)' }}>
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </span>
  )
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md, 14px)', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.4 }}><Inbox size={30} /></div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>{text}</p>
    </div>
  )
}
