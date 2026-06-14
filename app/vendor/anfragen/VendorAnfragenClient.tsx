'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, X, MessageSquare, MapPin, Calendar, Euro, Inbox } from 'lucide-react'

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
  pending: { label: 'Offen', bg: '#FEF3E0', fg: '#B26A00' },
  accepted: { label: 'Angenommen', bg: '#E6F4EA', fg: '#1E7E34' },
  declined: { label: 'Abgelehnt', bg: '#FCE8E6', fg: '#C5221F' },
  cancelled: { label: 'Zurückgezogen', bg: '#F1F1F1', fg: '#777' },
}

export default function VendorAnfragenClient() {
  const [requests, setRequests] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [isVendor, setIsVendor] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/marketplace/vendor-requests')
    const json = await res.json()
    setRequests(json.requests ?? [])
    setIsVendor(json.isVendor !== false)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function act(id: string, action: 'accept' | 'decline') {
    setBusyId(id)
    await fetch(`/api/marketplace/requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    await load()
    setBusyId(null)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Inbox size={22} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Anfragen</h1>
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>Lädt…</p>
      ) : !isVendor ? (
        <p style={{ color: '#888' }}>Dieser Bereich ist nur für Marktplatz-Dienstleister verfügbar.</p>
      ) : requests.length === 0 ? (
        <p style={{ color: '#888' }}>Noch keine Anfragen.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {requests.map(r => {
            const m = statusMeta[r.status]
            return (
              <div key={r.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{r.events?.couple_name || r.events?.title || 'Hochzeit'}</div>
                    <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>von {r.requester?.name ?? 'Brautpaar'}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: m.bg, color: m.fg }}>{m.label}</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '10px 0', fontSize: 12.5, color: '#555' }}>
                  {r.events?.date && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {new Date(r.events.date).toLocaleDateString('de-DE')}</span>}
                  {(r.events?.location_name || r.events?.location_city) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {[r.events?.location_name, r.events?.location_city].filter(Boolean).join(', ')}</span>}
                  {r.budget != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Euro size={13} /> {r.budget.toLocaleString('de-DE')} €</span>}
                </div>

                {r.message && <p style={{ fontSize: 13.5, color: '#333', background: '#fafafa', borderRadius: 8, padding: '10px 12px', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{r.message}</p>}

                {r.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => act(r.id, 'accept')} disabled={busyId === r.id} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#1E7E34', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Check size={15} /> Annehmen
                    </button>
                    <button onClick={() => act(r.id, 'decline')} disabled={busyId === r.id} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <X size={15} /> Ablehnen
                    </button>
                  </div>
                ) : r.status === 'accepted' && r.conversation_id ? (
                  <Link href={`/vendor/dashboard/${r.event_id}/chats`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--gold, #B89968)', textDecoration: 'none' }}>
                    <MessageSquare size={15} /> Zum Chat
                  </Link>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
