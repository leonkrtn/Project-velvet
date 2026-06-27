'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, ClipboardList, Check, Send } from 'lucide-react'

interface Field { key: string; label: string; value: string }
interface DReq {
  id: string
  status: 'open' | 'answered'
  fields: Field[]
  dienstleister_profiles?: { company_name: string | null; name: string | null } | { company_name: string | null; name: string | null }[]
}

function vendorName(r: DReq): string {
  const p = Array.isArray(r.dienstleister_profiles) ? r.dienstleister_profiles[0] : r.dienstleister_profiles
  return p?.company_name || p?.name || 'Dienstleister'
}

// Zeigt dem Brautpaar offene Daten-Anfragen der Dienstleister + Antwortformular.
export default function CoupleDataRequests({ eventId }: { eventId: string }) {
  const [requests, setRequests] = useState<DReq[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/marketplace/data-requests?eventId=${eventId}`)
    const d = await r.json().catch(() => ({}))
    setRequests(d.requests ?? [])
    setLoading(false)
  }, [eventId])
  useEffect(() => { load() }, [load])

  function setField(reqId: string, key: string, value: string) {
    setDrafts(prev => ({ ...prev, [reqId]: { ...(prev[reqId] ?? {}), [key]: value } }))
  }

  async function submit(r: DReq) {
    setBusy(r.id)
    await fetch(`/api/marketplace/data-requests/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: drafts[r.id] ?? {} }),
    })
    setBusy(null); load()
  }

  if (loading) return null
  const open = requests.filter(r => r.status === 'open')
  if (open.length === 0) return null

  return (
    <div className="bp-card" style={{ padding: 18 }}>
      <h4 className="bp-font-heading" style={{ fontSize: '1.05rem', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 7 }}>
        <ClipboardList size={16} style={{ color: 'var(--bp-gold-deep)' }} /> Offene Daten-Anfragen
      </h4>
      <p style={{ fontSize: 13, color: 'var(--bp-text-soft, #666)', margin: '0 0 14px' }}>
        Diese Angaben hat ein Dienstleister angefragt.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {open.map(r => (
          <div key={r.id} style={{ border: '1px solid var(--bp-border, #e5e0d8)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{vendorName(r)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.fields.map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--bp-text-soft, #555)', marginBottom: 4 }}>{f.label}</label>
                  <input
                    value={drafts[r.id]?.[f.key] ?? ''}
                    onChange={e => setField(r.id, f.key, e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13.5, border: '1px solid var(--bp-border, #e3ddd2)', borderRadius: 8, boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
              ))}
            </div>
            <button onClick={() => submit(r)} disabled={busy === r.id} className="bp-btn bp-btn-primary" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {busy === r.id ? <Loader2 size={15} className="bp-spin" /> : <Send size={15} />} Daten senden
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
