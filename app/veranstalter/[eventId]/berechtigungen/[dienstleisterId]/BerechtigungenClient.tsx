'use client'
import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Database, Mail, MessageSquare, Snowflake, Radio,
  X, Loader2, Eye, Layers,
} from 'lucide-react'
import ShareBox from '@/components/vendor/ShareBox'
import { SHARE_MODULES, SHARE_MODULE_LABELS, type ModuleSnapshot, type ShareModule, type ShareMode } from '@/lib/vendor/shares'

export interface ShareRow {
  id: string
  module: ShareModule
  mode: ShareMode
  status: 'active' | 'frozen' | 'revoked'
  created_at: string
}

interface Props {
  eventId: string
  dienstleisterId: string          // = vendor user_id
  dienstleisterName: string
  dienstleisterEmail: string
  conversationId: string | null
  initialShares: ShareRow[]
  backHref?: string
  backLabel?: string
  chatHref?: string
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BerechtigungenDLClient({
  dienstleisterName, dienstleisterEmail,
  conversationId, initialShares, backHref, backLabel, chatHref,
}: Props) {
  const [shares, setShares] = useState<ShareRow[]>(initialShares)
  const [pickModule, setPickModule] = useState<ShareModule | null>(null)
  const [sharing, setSharing] = useState(false)
  const [openShare, setOpenShare] = useState<{ id: string; label: string; snapshot: ModuleSnapshot | null; status: string; loading: boolean } | null>(null)

  const refresh = useCallback(async () => {
    if (!conversationId) return
    const res = await fetch(`/api/vendor/shares?conversationId=${conversationId}`)
    if (res.ok) setShares((await res.json()).shares ?? [])
  }, [conversationId])

  async function share(mode: ShareMode) {
    if (!conversationId || !pickModule || sharing) return
    setSharing(true)
    const res = await fetch('/api/vendor/shares', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, module: pickModule, mode }),
    })
    setSharing(false)
    if (res.ok) { setPickModule(null); refresh() }
  }

  async function view(id: string, label: string) {
    setOpenShare({ id, label, snapshot: null, status: 'active', loading: true })
    const res = await fetch(`/api/vendor/shares/${id}`)
    if (!res.ok) { setOpenShare({ id, label, snapshot: null, status: 'revoked', loading: false }); return }
    const { share } = await res.json()
    setOpenShare({ id, label, snapshot: share.snapshot ?? null, status: share.status, loading: false })
  }

  async function update(id: string, action: 'freeze' | 'revoke') {
    const res = await fetch(`/api/vendor/shares/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) { setOpenShare(null); refresh() }
  }

  const visibleShares = shares.filter(s => s.status !== 'revoked')

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 0 60px' }}>
      {backHref && (
        <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 18 }}>
          <ArrowLeft size={15} />{backLabel ?? 'Zurück'}
        </Link>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 8 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Database size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>{dienstleisterName}</h1>
          {dienstleisterEmail && (
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={13} />{dienstleisterEmail}
            </p>
          )}
        </div>
        {chatHref && (
          <Link href={chatHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13.5, fontWeight: 500, flexShrink: 0 }}>
            <MessageSquare size={15} />Zum Chat
          </Link>
        )}
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '14px 0 24px' }}>
        Hier steuerst du, welche Daten dieser Dienstleister sieht. Geteilte Bereiche erscheinen direkt im Chat —
        als <b>Auszug</b> (eingefrorener Stand) oder <b>Live</b> (aktualisiert sich automatisch). Du kannst jede
        Freigabe später einfrieren oder zurückziehen.
      </p>

      {!conversationId ? (
        <div style={{ padding: '20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13.5, color: 'var(--text-secondary)' }}>
          Sobald ein Chat mit diesem Dienstleister besteht, kannst du hier Daten teilen.
        </div>
      ) : (
        <>
          {/* Share new */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 22 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', margin: '0 0 14px' }}>Daten teilen</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 16 }}>
              {SHARE_MODULES.map(m => (
                <button key={m.key} onClick={() => setPickModule(m.key)} style={{
                  padding: '10px 12px', borderRadius: 10, textAlign: 'left', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                  border: `1.5px solid ${pickModule === m.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: pickModule === m.key ? 'var(--accent)' : 'var(--surface)',
                  color: pickModule === m.key ? '#fff' : 'var(--text-primary)',
                }}>{m.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => share('snapshot')} disabled={!pickModule || sharing} style={{
                flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
                cursor: pickModule && !sharing ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                color: pickModule ? 'var(--text-primary)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <Snowflake size={15} /> Als Auszug
              </button>
              <button onClick={() => share('live')} disabled={!pickModule || sharing} style={{
                flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: pickModule ? 'var(--accent)' : '#C7C7CC',
                cursor: pickModule && !sharing ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                {sharing ? <Loader2 size={15} className="b-spin" /> : <Radio size={15} />} Live teilen
              </button>
            </div>
          </section>

          {/* Current shares */}
          <section>
            <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
              Aktuell geteilt ({visibleShares.length})
            </h2>
            {visibleShares.length === 0 ? (
              <div style={{ padding: '20px', borderRadius: 12, border: '1px dashed var(--border)', fontSize: 13.5, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                Noch keine Daten geteilt.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleShares.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <Layers size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{SHARE_MODULE_LABELS[s.module]}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                        {s.mode === 'live' ? 'Live' : 'Auszug'}{s.status === 'frozen' ? ' · eingefroren' : ''} · seit {fmtDate(s.created_at)}
                      </div>
                    </div>
                    <button onClick={() => view(s.id, SHARE_MODULE_LABELS[s.module])} title="Ansehen" style={iconBtn}><Eye size={15} /></button>
                    {s.status === 'active' && (
                      <button onClick={() => update(s.id, 'freeze')} title="Einfrieren" style={iconBtn}><Snowflake size={15} /></button>
                    )}
                    <button onClick={() => update(s.id, 'revoke')} title="Nicht mehr teilen" style={{ ...iconBtn, color: '#FF3B30' }}><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* View modal */}
      {openShare && (
        <div onClick={() => setOpenShare(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, width: 640, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={17} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, flex: 1 }}>{openShare.label}{openShare.status === 'frozen' ? ' · eingefroren' : ''}</h3>
              <button onClick={() => setOpenShare(null)} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {openShare.loading
                ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 30 }}><Loader2 size={22} className="b-spin" /></div>
                : openShare.snapshot ? <ShareBox snapshot={openShare.snapshot} />
                : <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Diese Freigabe ist nicht mehr verfügbar.</p>}
            </div>
            {!openShare.loading && openShare.status !== 'revoked' && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                {openShare.status === 'active' && (
                  <button onClick={() => update(openShare.id, 'freeze')} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Snowflake size={14} /> Einfrieren
                  </button>
                )}
                <button onClick={() => update(openShare.id, 'revoke')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#FF3B30', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                  Nicht mehr teilen
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`.b-spin { animation: bspin 1s linear infinite; } @keyframes bspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0,
}
