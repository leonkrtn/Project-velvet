'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Check, X, UserPlus, Users, Inbox, Trash2, ShieldOff, Loader2,
  AlertCircle, Eye, EyeOff, RefreshCw, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import SubscriptionsSection from './SubscriptionsSection'
import PromoCodesSection from './PromoCodesSection'
import MarketplaceVendorsSection from './MarketplaceVendorsSection'

// ── Typen ─────────────────────────────────────────────────────────────────────

interface PendingRequest {
  id: string
  name: string
  email: string
  company: string | null
  createdAt: string | null
}

interface Organizer {
  id: string
  name: string
  email: string
  company: string | null
  eventCount: number
  isAdmin: boolean
  createdAt: string | null
}

// ── Neutrales Admin-Design (bewusst kein Forevr-Branding) ─────────────────────

const C = {
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  border: '#E2E4E8',
  text: '#1A1D21',
  text2: '#5A6068',
  text3: '#9AA0A8',
  accent: '#2563EB',
  red: '#B91C1C',
  redPale: '#FEF2F2',
  green: '#15803D',
  greenPale: '#F0FDF4',
}

const card: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  overflow: 'hidden',
}

const cardHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
  fontSize: 14, fontWeight: 600, color: C.text,
}

const btnBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', border: '1px solid transparent',
  whiteSpace: 'nowrap',
}

const btnPrimary: React.CSSProperties = { ...btnBase, background: C.text, color: '#fff' }
const btnSecondary: React.CSSProperties = { ...btnBase, background: '#fff', color: C.text, borderColor: C.border }
const btnDanger: React.CSSProperties = { ...btnBase, background: C.redPale, color: C.red, borderColor: '#FCA5A5' }

const inputStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', fontSize: 14,
  border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff',
  fontFamily: 'inherit', outline: 'none', color: C.text, boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 5,
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function AdminClient({ adminName }: { adminName: string }) {
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [organizers, setOrganizers] = useState<Organizer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null)

  // Anlegen-Formular
  const [showCreate, setShowCreate] = useState(false)
  const [cName, setCName] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cPassword, setCPassword] = useState('')
  const [cCompany, setCCompany] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdInfo, setCreatedInfo] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/organizers')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Laden fehlgeschlagen')
      setPending(data.pending)
      setOrganizers(data.organizers)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function patchAction(userId: string, action: 'approve' | 'revoke') {
    setBusyId(userId); setError('')
    try {
      const res = await fetch(`/api/admin/organizers/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Aktion fehlgeschlagen')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen')
    } finally {
      setBusyId(null)
      setConfirmRevokeId(null)
    }
  }

  async function deleteAccount(userId: string) {
    setBusyId(userId); setError('')
    try {
      const res = await fetch(`/api/admin/organizers/${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Löschen fehlgeschlagen')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen')
    } finally {
      setBusyId(null)
      setConfirmDeleteId(null)
    }
  }

  async function createOrganizer(e: React.FormEvent) {
    e.preventDefault()
    if (cPassword.length < 8) { setCreateError('Passwort muss mindestens 8 Zeichen haben.'); return }
    setCreating(true); setCreateError(''); setCreatedInfo('')
    try {
      const res = await fetch('/api/admin/organizers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cName, email: cEmail, password: cPassword, company: cCompany }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Anlegen fehlgeschlagen')
      setCreatedInfo(`Veranstalter "${cName}" (${cEmail}) wurde angelegt und freigeschaltet.`)
      setCName(''); setCEmail(''); setCPassword(''); setCCompany('')
      await load()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen')
    } finally {
      setCreating(false)
    }
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 64px' }}>

        {/* Kopf */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Verwaltung</h1>
            <p style={{ fontSize: 14, color: C.text2, margin: '4px 0 0' }}>
              Veranstalter-Accounts · angemeldet als {adminName}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSecondary} onClick={() => { setLoading(true); load() }}>
              <RefreshCw size={14} /> Aktualisieren
            </button>
            <button style={btnSecondary} onClick={logout}>
              <LogOut size={14} /> Abmelden
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
            background: C.redPale, border: '1px solid #FCA5A5', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: C.red,
          }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text2, fontSize: 14, padding: '40px 0' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Wird geladen…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Offene Anfragen ── */}
            <section style={card}>
              <div style={cardHeader}>
                <Inbox size={16} style={{ color: C.text2 }} />
                Offene Registrierungsanfragen
                {pending.length > 0 && (
                  <span style={{
                    marginLeft: 4, fontSize: 12, fontWeight: 700, color: '#fff',
                    background: C.accent, borderRadius: 999, padding: '1px 8px',
                  }}>
                    {pending.length}
                  </span>
                )}
              </div>
              {pending.length === 0 ? (
                <p style={{ padding: '18px', fontSize: 13.5, color: C.text3, margin: 0 }}>
                  Keine offenen Anfragen.
                </p>
              ) : (
                <div>
                  {pending.map((p, i) => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      padding: '12px 18px',
                      borderBottom: i < pending.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{p.name}</p>
                        <p style={{ fontSize: 12.5, color: C.text2, margin: '2px 0 0' }}>
                          {p.email}
                          {p.company ? ` · ${p.company}` : ''}
                          {` · registriert ${formatDate(p.createdAt)}`}
                        </p>
                      </div>
                      <button
                        style={btnPrimary}
                        disabled={busyId === p.id}
                        onClick={() => patchAction(p.id, 'approve')}
                      >
                        {busyId === p.id ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                        Freischalten
                      </button>
                      {confirmDeleteId === p.id ? (
                        <>
                          <button style={btnDanger} disabled={busyId === p.id} onClick={() => deleteAccount(p.id)}>
                            <Trash2 size={13} /> Endgültig ablehnen
                          </button>
                          <button style={btnSecondary} onClick={() => setConfirmDeleteId(null)}>
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <button style={btnSecondary} disabled={busyId === p.id} onClick={() => setConfirmDeleteId(p.id)}>
                          <X size={13} /> Ablehnen
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Veranstalter anlegen ── */}
            <section style={card}>
              <div style={{ ...cardHeader, justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <UserPlus size={16} style={{ color: C.text2 }} />
                  Veranstalter anlegen
                </span>
                <button style={btnSecondary} onClick={() => setShowCreate(v => !v)}>
                  {showCreate ? 'Schließen' : 'Formular öffnen'}
                </button>
              </div>
              {createdInfo && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, margin: '14px 18px 0',
                  background: C.greenPale, border: '1px solid #BBF7D0', borderRadius: 8,
                  padding: '10px 14px', fontSize: 13, color: C.green,
                }}>
                  <Check size={15} /> {createdInfo}
                </div>
              )}
              {showCreate && (
                <form onSubmit={createOrganizer} style={{ padding: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>Name *</label>
                      <input required style={inputStyle} value={cName} onChange={e => setCName(e.target.value)} placeholder="Vorname Nachname" />
                    </div>
                    <div>
                      <label style={labelStyle}>E-Mail *</label>
                      <input required type="email" style={inputStyle} value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="name@firma.de" />
                    </div>
                    <div>
                      <label style={labelStyle}>Passwort (mind. 8 Zeichen) *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          required
                          type={showPw ? 'text' : 'password'}
                          style={{ ...inputStyle, paddingRight: 38 }}
                          value={cPassword}
                          onChange={e => setCPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(v => !v)}
                          aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
                          style={{
                            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: C.text3,
                            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Firma (optional)</label>
                      <input style={inputStyle} value={cCompany} onChange={e => setCCompany(e.target.value)} placeholder="Eventagentur GmbH" />
                    </div>
                  </div>

                  {createError && (
                    <p style={{ fontSize: 13, color: C.red, margin: '0 0 12px' }}>{createError}</p>
                  )}

                  <button type="submit" style={btnPrimary} disabled={creating}>
                    {creating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={13} />}
                    {creating ? 'Wird angelegt…' : 'Anlegen & freischalten'}
                  </button>
                  <p style={{ fontSize: 12, color: C.text3, margin: '10px 0 0' }}>
                    Der Account ist sofort nutzbar (E-Mail gilt als bestätigt). Teile die Zugangsdaten selbst mit.
                  </p>
                </form>
              )}
            </section>

            {/* ── Bestand ── */}
            <section style={card}>
              <div style={cardHeader}>
                <Users size={16} style={{ color: C.text2 }} />
                Veranstalter ({organizers.length})
              </div>
              {organizers.length === 0 ? (
                <p style={{ padding: '18px', fontSize: 13.5, color: C.text3, margin: 0 }}>
                  Noch keine freigeschalteten Veranstalter.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 640 }}>
                    <thead>
                      <tr>
                        {['Name', 'E-Mail', 'Firma', 'Events', 'Seit', ''].map((h, i) => (
                          <th key={i} style={{
                            textAlign: i >= 3 && i <= 4 ? 'left' : 'left', padding: '9px 18px',
                            fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.06em', color: C.text3, borderBottom: `1px solid ${C.border}`,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {organizers.map(o => (
                        <tr key={o.id}>
                          <td style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>
                            {o.name}
                            {o.isAdmin && (
                              <span style={{
                                marginLeft: 8, fontSize: 11, fontWeight: 600, color: C.accent,
                                background: 'rgba(37,99,235,0.08)', borderRadius: 5, padding: '1px 7px',
                              }}>
                                Admin
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, color: C.text2 }}>{o.email}</td>
                          <td style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, color: C.text2 }}>{o.company ?? '—'}</td>
                          <td style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, color: C.text2 }}>{o.eventCount}</td>
                          <td style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, color: C.text2 }}>{formatDate(o.createdAt)}</td>
                          <td style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, textAlign: 'right' }}>
                            {!o.isAdmin && (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                {confirmRevokeId === o.id ? (
                                  <>
                                    <button style={btnDanger} disabled={busyId === o.id} onClick={() => patchAction(o.id, 'revoke')}>
                                      <ShieldOff size={13} /> Wirklich entziehen
                                    </button>
                                    <button style={btnSecondary} onClick={() => setConfirmRevokeId(null)}><X size={13} /></button>
                                  </>
                                ) : confirmDeleteId === o.id ? (
                                  <>
                                    <button style={btnDanger} disabled={busyId === o.id} onClick={() => deleteAccount(o.id)}>
                                      <Trash2 size={13} /> Endgültig löschen
                                    </button>
                                    <button style={btnSecondary} onClick={() => setConfirmDeleteId(null)}><X size={13} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      style={btnSecondary}
                                      title="Freischaltung entziehen — Account bleibt bestehen, landet auf der Warteseite"
                                      disabled={busyId === o.id}
                                      onClick={() => { setConfirmDeleteId(null); setConfirmRevokeId(o.id) }}
                                    >
                                      <ShieldOff size={13} />
                                    </button>
                                    <button
                                      style={btnDanger}
                                      title="Account löschen — Events bleiben bestehen"
                                      disabled={busyId === o.id}
                                      onClick={() => { setConfirmRevokeId(null); setConfirmDeleteId(o.id) }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Abos (Solo-Brautpaare) ── */}
            <SubscriptionsSection card={card} cardHeader={cardHeader} btnSecondary={btnSecondary} />

            {/* ── Promo-Codes (Influencer) ── */}
            <PromoCodesSection
              card={card}
              cardHeader={cardHeader}
              btnSecondary={btnSecondary}
              btnPrimary={btnPrimary}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />

            {/* ── Marktplatz-Dienstleister ── */}
            <MarketplaceVendorsSection />
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
