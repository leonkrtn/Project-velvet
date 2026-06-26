'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, FileText, ReceiptText, Check, X, Clock, Copy, ChevronRight } from 'lucide-react'
import { formatMoney } from '@/lib/vendor/questionnaire'

interface OfferRow {
  id: string
  title: string
  status: 'draft' | 'released' | 'accepted' | 'declined' | 'superseded'
  version: number
  parent_offer_id: string | null
  total: number
  currency: string
  valid_until: string | null
  request_id: string | null
  created_at: string
  updated_at: string
  released_at: string | null
  accepted_at: string | null
}

const STATUS_META: Record<OfferRow['status'], { label: string; bg: string; fg: string; icon: React.ReactNode }> = {
  draft:      { label: 'Entwurf',    bg: 'rgba(0,0,0,0.05)',       fg: '#666',    icon: <FileText size={13} /> },
  released:   { label: 'Versendet',  bg: 'rgba(184,153,104,0.16)', fg: '#9a7b3f', icon: <Clock size={13} /> },
  accepted:   { label: 'Angenommen', bg: 'rgba(30,126,52,0.12)',   fg: '#1E7E34', icon: <Check size={13} /> },
  declined:   { label: 'Abgelehnt',  bg: 'rgba(197,34,31,0.10)',   fg: '#C5221F', icon: <X size={13} /> },
  superseded: { label: 'Ersetzt',    bg: 'rgba(0,0,0,0.04)',       fg: '#999',    icon: <Copy size={13} /> },
}

const GROUPS: { key: OfferRow['status']; label: string }[] = [
  { key: 'draft', label: 'Entwürfe' },
  { key: 'released', label: 'Versendet' },
  { key: 'accepted', label: 'Angenommen' },
  { key: 'declined', label: 'Abgelehnt' },
]

export default function AngeboteClient({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/vendor/event-offers?eventId=${eventId}`)
    const d = await res.json().catch(() => ({}))
    setOffers(d.offers ?? [])
    setLoading(false)
  }, [eventId])
  useEffect(() => { load() }, [load])

  const grouped = useMemo(() => {
    const map: Record<string, OfferRow[]> = {}
    for (const o of offers) (map[o.status] ??= []).push(o)
    return map
  }, [offers])

  const hasAny = offers.some(o => o.status !== 'superseded')

  async function create(source: 'questionnaire' | 'blank') {
    setCreating(true); setPickerOpen(false)
    const res = await fetch('/api/vendor/event-offers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, source }),
    })
    const d = await res.json().catch(() => ({}))
    setCreating(false)
    if (d.id) router.push(`/vendor/dashboard/${eventId}/angebote/${d.id}`)
  }

  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1 }}>
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ReceiptText size={20} style={{ color: 'var(--gold)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Angebote</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 2 }}>Angebote &amp; Verträge für dieses Event erstellen und versenden.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setPickerOpen(o => !o)} disabled={creating} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9,
            background: 'var(--gold)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
          }}>
            {creating ? <Loader2 size={15} className="ang-spin" /> : <Plus size={16} />} Neues Angebot
          </button>
          {pickerOpen && (
            <>
              <div onClick={() => setPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, width: 270, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md, 0 12px 40px rgba(0,0,0,0.16))', overflow: 'hidden' }}>
                <SourceOption title="Aus Preislogik" desc="Vorbefüllt aus deinem Fragebogen (Grundpreis, pro Gast …)" onClick={() => create('questionnaire')} />
                <SourceOption title="Leeres Angebot" desc="Positionen selbst zusammenstellen" onClick={() => create('blank')} border />
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {[3, 2].map((count, gi) => (
            <section key={gi}>
              <div className="ang-skel" style={{ height: 11, width: 90, borderRadius: 4, margin: '0 0 10px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div className="ang-skel" style={{ height: 15, width: `${120 + (i * 41) % 80}px`, borderRadius: 6 }} />
                        <div className="ang-skel" style={{ height: 16, width: 70, borderRadius: 100 }} />
                      </div>
                      <div className="ang-skel" style={{ height: 12, width: `${150 + (i * 57) % 90}px`, marginTop: 6, borderRadius: 4 }} />
                    </div>
                    <div className="ang-skel" style={{ height: 15, width: 64, borderRadius: 6, flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : !hasAny ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '40px 24px', textAlign: 'center', marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.4 }}><ReceiptText size={30} /></div>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch kein Angebot</p>
          <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
            Erstelle dein erstes Angebot — vorbefüllt aus deiner Preislogik oder ganz leer.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {GROUPS.map(g => {
            const items = grouped[g.key] ?? []
            if (items.length === 0) return null
            return (
              <section key={g.key}>
                <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', margin: '0 0 10px' }}>
                  {g.label} <span style={{ opacity: 0.6 }}>· {items.length}</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map(o => <OfferTile key={o.id} o={o} onOpen={() => router.push(`/vendor/dashboard/${eventId}/angebote/${o.id}`)} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <style>{`.ang-spin { animation: angspin 1s linear infinite; } @keyframes angspin { to { transform: rotate(360deg); } } .ang-skel { background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%); background-size: 200% 100%; animation: ang-shimmer 1.4s ease infinite; } @keyframes ang-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
    </div>
  )
}

function SourceOption({ title, desc, onClick, border }: { title: string; desc: string; onClick: () => void; border?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none', cursor: 'pointer',
      border: 'none', borderTop: border ? '1px solid var(--border)' : 'none', fontFamily: 'inherit',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
    </button>
  )
}

function OfferTile({ o, onOpen }: { o: OfferRow; onOpen: () => void }) {
  const m = STATUS_META[o.status]
  return (
    <button onClick={onOpen} style={{
      textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', width: '100%',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13,
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
      transition: 'box-shadow .15s, border-color .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</span>
          {o.version > 1 && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>v{o.version}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: m.bg, color: m.fg }}>{m.icon} {m.label}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>
          {o.request_id ? 'Aus Marktplatz-Anfrage · ' : ''}Aktualisiert {new Date(o.updated_at).toLocaleDateString('de-DE')}
          {o.valid_until ? ` · gültig bis ${new Date(o.valid_until).toLocaleDateString('de-DE')}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{formatMoney(o.total, o.currency)}</div>
      </div>
      <ChevronRight size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
    </button>
  )
}
