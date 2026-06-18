'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Check, X, MessageSquare, MapPin, Calendar, Euro, Inbox,
  ChevronLeft, Heart, Loader2,
} from 'lucide-react'

interface Req {
  id: string
  event_id: string
  message: string
  budget: number | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  conversation_id: string | null
  created_at: string
  events: { title: string; couple_name: string | null; date: string | null; location_name: string | null; location_city: string | null } | null
  requester: { name: string | null } | null
}

const statusMeta: Record<Req['status'], { label: string; bg: string; fg: string }> = {
  pending:   { label: 'Offen',         bg: 'rgba(184,153,104,0.14)', fg: 'var(--gold, #B89968)' },
  accepted:  { label: 'Angenommen',    bg: 'rgba(30,126,52,0.12)',   fg: '#1E7E34' },
  declined:  { label: 'Abgelehnt',     bg: 'rgba(197,34,31,0.10)',   fg: '#C5221F' },
  cancelled: { label: 'Zurückgezogen', bg: 'var(--bg)',              fg: 'var(--text-dim)' },
}

type Filter = 'offen' | 'angenommen' | 'erledigt'

export default function VendorAnfragenClient() {
  const [requests, setRequests] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [isVendor, setIsVendor] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('offen')

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

  // Default to the tab that actually has content.
  useEffect(() => {
    if (loading) return
    if (counts.offen === 0 && counts.angenommen > 0) setFilter('angenommen')
    else if (counts.offen === 0 && counts.angenommen === 0 && counts.erledigt > 0) setFilter('erledigt')
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => requests.filter(r => {
    if (filter === 'offen') return r.status === 'pending'
    if (filter === 'angenommen') return r.status === 'accepted'
    return r.status === 'declined' || r.status === 'cancelled'
  }), [requests, filter])

  async function act(id: string, action: 'accept' | 'decline') {
    setBusyId(id)
    await fetch(`/api/marketplace/requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    await load()
    setBusyId(null)
  }

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'offen',      label: 'Offen',      count: counts.offen },
    { key: 'angenommen', label: 'Angenommen', count: counts.angenommen },
    { key: 'erledigt',   label: 'Erledigt',   count: counts.erledigt },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '28px 20px 64px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Back */}
        <Link href="/vendor/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13,
          color: 'var(--text-dim)', textDecoration: 'none', marginBottom: 18,
        }}>
          <ChevronLeft size={15} /> Zurück zu meinen Events
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Inbox size={20} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Marktplatz-Anfragen</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 2 }}>Anfragen von Brautpaaren aus dem Marktplatz.</p>
          </div>
        </div>

        {/* Tabs */}
        {isVendor && !loading && requests.length > 0 && (
          <div style={{ display: 'flex', gap: 8, margin: '22px 0 18px', flexWrap: 'wrap' }}>
            {tabs.map(t => {
              const active = filter === t.key
              return (
                <button key={t.key} onClick={() => setFilter(t.key)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px',
                  borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                  background: active ? 'var(--gold)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text)',
                }}>
                  {t.label}
                  <span style={{
                    fontSize: 11, fontWeight: 700, borderRadius: 100, minWidth: 18, textAlign: 'center', padding: '0 5px',
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg)',
                    color: active ? '#fff' : 'var(--text-dim)',
                  }}>{t.count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Content */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {visible.map(r => (
              <RequestCard key={r.id} r={r} busy={busyId === r.id} onAct={act} />
            ))}
          </div>
        )}
      </div>

      <style>{`.anf-spin { animation: anfspin 1s linear infinite; } @keyframes anfspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function RequestCard({ r, busy, onAct }: { r: Req; busy: boolean; onAct: (id: string, a: 'accept' | 'decline') => void }) {
  const m = statusMeta[r.status]
  const title = r.events?.couple_name || r.events?.title || 'Hochzeit'
  const location = [r.events?.location_name, r.events?.location_city].filter(Boolean).join(', ')

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md, 14px)', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Heart size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3 }}>
            von {r.requester?.name ?? 'Brautpaar'} · {new Date(r.created_at).toLocaleDateString('de-DE')}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, padding: '5px 11px', borderRadius: 100, background: m.bg, color: m.fg, flexShrink: 0, whiteSpace: 'nowrap' }}>{m.label}</span>
      </div>

      {(r.events?.date || location || r.budget != null) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0' }}>
          {r.events?.date && <MetaChip icon={<Calendar size={13} />} text={new Date(r.events.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })} />}
          {location && <MetaChip icon={<MapPin size={13} />} text={location} />}
          {r.budget != null && <MetaChip icon={<Euro size={13} />} text={`${r.budget.toLocaleString('de-DE')} €`} />}
        </div>
      )}

      {r.message && (
        <p style={{ fontSize: 13.5, color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', margin: '0 0 14px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r.message}</p>
      )}

      {r.status === 'pending' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onAct(r.id, 'accept')} disabled={busy} style={{
            padding: '10px 18px', borderRadius: 10, border: 'none', background: '#1E7E34', color: '#fff',
            fontSize: 13.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
          }}>
            {busy ? <Loader2 size={15} className="anf-spin" /> : <Check size={15} />} Annehmen
          </button>
          <button onClick={() => onAct(r.id, 'decline')} disabled={busy} style={{
            padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
            fontSize: 13.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
          }}>
            <X size={15} /> Ablehnen
          </button>
        </div>
      ) : r.status === 'accepted' ? (
        <Link href={`/vendor/dashboard/${r.event_id}/kommunikation`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10,
          background: 'var(--gold)', color: '#fff', fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
        }}>
          <MessageSquare size={15} /> Zur Kommunikation
        </Link>
      ) : null}
    </div>
  )
}

function MetaChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--text-dim)',
      background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px',
    }}>
      <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>{text}
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
