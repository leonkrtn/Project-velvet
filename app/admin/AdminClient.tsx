'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Check, X, UserPlus, Users, Inbox, Trash2, ShieldOff, Loader2,
  AlertCircle, Eye, EyeOff, RefreshCw, LayoutDashboard,
  ShieldCheck, Tag, Store, Flag, ChevronRight, BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AdminShell from './AdminShell'
import SubscriptionsSection from './SubscriptionsSection'
import PromoCodesSection from './PromoCodesSection'
import MarketplaceAdminPanel from './MarketplaceAdminPanel'
import AdminReportsSection from './AdminReportsSection'
import AdminNotificationsSection from './AdminNotificationsSection'
import AdminTestMailSection from './AdminTestMailSection'
import AdminStatsSection from './AdminStatsSection'

// ── Typen ─────────────────────────────────────────────────────────────────────

interface PendingRequest {
  id: string; name: string; email: string; company: string | null; createdAt: string | null
}

interface Organizer {
  id: string; name: string; email: string; company: string | null
  eventCount: number; isAdmin: boolean; createdAt: string | null
}

type Section = 'ubersicht' | 'insights' | 'anbieter' | 'meldungen' | 'veranstalter' | 'promo' | 'benachrichtigungen' | 'testen'

// ── Design ────────────────────────────────────────────────────────────────────

const C = {
  bg: '#F4F5F7', surface: '#FFFFFF', border: '#E2E4E8',
  text: '#1A1D21', text2: '#5A6068', text3: '#9AA0A8',
  accent: '#2563EB', red: '#B91C1C', redPale: '#FEF2F2',
  green: '#15803D', greenPale: '#F0FDF4',
}

const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }
const cardHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text }
const btnBase: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid transparent', whiteSpace: 'nowrap' }
const btnPrimary: React.CSSProperties = { ...btnBase, background: C.text, color: '#fff' }
const btnSecondary: React.CSSProperties = { ...btnBase, background: '#fff', color: C.text, borderColor: C.border }
const btnDanger: React.CSSProperties = { ...btnBase, background: C.redPale, color: C.red, borderColor: '#FCA5A5' }
const inputStyle: React.CSSProperties = { width: '100%', height: 38, padding: '0 12px', fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', fontFamily: 'inherit', outline: 'none', color: C.text, boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 5 }

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Übersicht ─────────────────────────────────────────────────────────────────

interface Dash {
  pendingVendors: number; openReports: number; pendingOrganizers: number
  totalVendors: number; approvedVendors: number; totalOrganizers: number
  reachViews: number; reachContacts: number; reachRequests: number
}

function UbersichtSection({ onNav }: { onNav: (s: Section) => void }) {
  const [d, setD] = useState<Dash | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [shell, vend, org] = await Promise.all([
          fetch('/api/admin/shell-data').then(r => r.ok ? r.json() : {}) as Promise<{ anbieter?: number; meldungen?: number }>,
          fetch('/api/admin/marketplace/vendors').then(r => r.ok ? r.json() : {}) as Promise<{ vendors?: { moderation_status: string }[]; adminStats?: { last30?: Record<string, number> } }>,
          fetch('/api/admin/organizers').then(r => r.ok ? r.json() : {}) as Promise<{ pending?: unknown[]; organizers?: unknown[] }>,
        ])
        const vendors = vend.vendors ?? []
        const st = vend.adminStats?.last30 ?? {}
        setD({
          pendingVendors: shell.anbieter ?? 0,
          openReports: shell.meldungen ?? 0,
          pendingOrganizers: (org.pending ?? []).length,
          totalVendors: vendors.length,
          approvedVendors: vendors.filter(v => v.moderation_status === 'approved').length,
          totalOrganizers: (org.organizers ?? []).length,
          reachViews: st.profile_view ?? 0,
          reachContacts: (st.contact_email ?? 0) + (st.contact_phone ?? 0),
          reachRequests: st.request ?? 0,
        })
      } finally { setLoading(false) }
    })()
  }, [])

  const todos = d ? [
    d.pendingVendors > 0 && { n: d.pendingVendors, label: 'Anbieter warten auf Prüfung', cta: 'Zur Prüfung', icon: ShieldCheck, sec: 'anbieter' as Section, color: C.accent },
    d.openReports > 0 && { n: d.openReports, label: 'offene Meldungen zu Anbietern', cta: 'Meldungen ansehen', icon: Flag, sec: 'meldungen' as Section, color: C.red },
    d.pendingOrganizers > 0 && { n: d.pendingOrganizers, label: 'Veranstalter-Anfragen offen', cta: 'Freischalten', icon: Inbox, sec: 'veranstalter' as Section, color: C.accent },
  ].filter(Boolean) as { n: number; label: string; cta: string; icon: React.ElementType; sec: Section; color: string }[] : []

  return (
    <div style={{ padding: 'clamp(18px, 4vw, 28px) clamp(14px, 4vw, 24px) 64px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em', color: C.text }}>Übersicht</h1>
        <p style={{ fontSize: 13.5, color: C.text2, margin: '0 0 24px' }}>Was heute deine Aufmerksamkeit braucht.</p>

        {loading ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: C.text2, padding: '30px 0' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Wird geladen…</div>
        ) : d && (
          <>
            {/* Handlungsbedarf */}
            {todos.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {todos.map((t, i) => {
                  const Icon = t.icon
                  return (
                    <button key={i} onClick={() => onNav(t.sec)} className="adm-todo"
                      style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', width: '100%', background: '#fff', border: `1px solid ${C.border}`, borderLeft: `4px solid ${t.color}`, borderRadius: 10, padding: '14px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Icon size={20} style={{ color: t.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{t.n}</span>
                        <span style={{ fontSize: 14, color: C.text2, marginLeft: 8 }}>{t.label}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t.cta} <ChevronRight size={15} /></span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ ...card, padding: 18, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 10, color: C.green }}>
                <Check size={18} /> <span style={{ fontSize: 14, fontWeight: 600 }}>Alles erledigt — kein offener Handlungsbedarf.</span>
              </div>
            )}

            {/* Bestandszahlen (klickbar) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <StatCard icon={Store} label="Marktplatz-Anbieter" value={d.totalVendors} sub={`${d.approvedVendors} freigegeben`} onClick={() => onNav('anbieter')} />
              <StatCard icon={Users} label="Veranstalter" value={d.totalOrganizers} sub="Accounts verwalten" onClick={() => onNav('veranstalter')} />
              <StatCard icon={Tag} label="Promo-Codes" value={null} sub="Rabattcodes verwalten" onClick={() => onNav('promo')} />
            </div>

            {/* Marktplatz-Reichweite (30 Tage) */}
            <button onClick={() => onNav('anbieter')} style={{ display: 'block', width: '100%', textAlign: 'left', ...card, padding: 18, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Marktplatz-Reichweite · letzte 30 Tage</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.accent, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Details <ChevronRight size={14} /></span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <Reach label="Profilaufrufe" value={d.reachViews} />
                <Reach label="Kontaktklicks" value={d.reachContacts} />
                <Reach label="Anfragen" value={d.reachRequests} />
              </div>
            </button>

            {/* Verweis auf das ausführliche Insights-Dashboard */}
            <button onClick={() => onNav('insights')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', ...card, padding: 16, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12 }}>
              <BarChart3 size={20} style={{ color: C.accent, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.text }}>Insights — Nutzung, Aktivierung & Marktplatz-Potenzial</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Öffnen <ChevronRight size={15} /></span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, onClick }: { icon: React.ElementType; label: string; value: number | null; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...card, padding: 18, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <Icon size={20} style={{ color: C.accent, marginBottom: 10 }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {value !== null && <span style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{value}</span>}
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{label}</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.text2, margin: '4px 0 0' }}>{sub}</p>
    </button>
  )
}

function Reach({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString('de-DE')}</div>
      <div style={{ fontSize: 12, color: C.text2 }}>{label}</div>
    </div>
  )
}

// ── Anbieter-Bereich (Moderation + Vendor-Liste) ──────────────────────────────

function AnbieterSection() {
  return <MarketplaceAdminPanel />
}

// ── Veranstalter ──────────────────────────────────────────────────────────────

function VeranstalterSection({ adminName }: { adminName: string }) {
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [organizers, setOrganizers] = useState<Organizer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null)
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
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function patchAction(userId: string, action: 'approve' | 'revoke') {
    setBusyId(userId); setError('')
    try {
      const res = await fetch(`/api/admin/organizers/${userId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Aktion fehlgeschlagen')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen')
    } finally { setBusyId(null); setConfirmRevokeId(null) }
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
    } finally { setBusyId(null); setConfirmDeleteId(null) }
  }

  async function createOrganizer(e: React.FormEvent) {
    e.preventDefault()
    if (cPassword.length < 8) { setCreateError('Passwort muss mindestens 8 Zeichen haben.'); return }
    setCreating(true); setCreateError(''); setCreatedInfo('')
    try {
      const res = await fetch('/api/admin/organizers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cName, email: cEmail, password: cPassword, company: cCompany }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Anlegen fehlgeschlagen')
      setCreatedInfo(`Veranstalter "${cName}" (${cEmail}) wurde angelegt und freigeschaltet.`)
      setCName(''); setCEmail(''); setCPassword(''); setCCompany('')
      await load()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen')
    } finally { setCreating(false) }
  }

  return (
    <div style={{ padding: 'clamp(18px, 4vw, 28px) clamp(14px, 4vw, 24px) 64px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em', color: C.text }}>Veranstalter</h1>
            <p style={{ fontSize: 13.5, color: C.text2, margin: 0 }}>Accounts verwalten · angemeldet als {adminName}</p>
          </div>
          <button style={btnSecondary} onClick={() => { setLoading(true); load() }}>
            <RefreshCw size={14} /> Aktualisieren
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.redPale, border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text2, fontSize: 14, padding: '40px 0' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Wird geladen…
          </div>
        ) : (
          <>
            {/* Offene Anfragen */}
            <section style={card}>
              <div style={cardHeader}>
                <Inbox size={16} style={{ color: C.text2 }} />
                Offene Registrierungsanfragen
                {pending.length > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 12, fontWeight: 700, color: '#fff', background: C.accent, borderRadius: 999, padding: '1px 8px' }}>
                    {pending.length}
                  </span>
                )}
              </div>
              {pending.length === 0 ? (
                <p style={{ padding: '18px', fontSize: 13.5, color: C.text3, margin: 0 }}>Keine offenen Anfragen.</p>
              ) : (
                <div>
                  {pending.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 18px', borderBottom: i < pending.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{p.name}</p>
                        <p style={{ fontSize: 12.5, color: C.text2, margin: '2px 0 0' }}>
                          {p.email}{p.company ? ` · ${p.company}` : ''}{` · registriert ${formatDate(p.createdAt)}`}
                        </p>
                      </div>
                      <button style={btnPrimary} disabled={busyId === p.id} onClick={() => patchAction(p.id, 'approve')}>
                        {busyId === p.id ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                        Freischalten
                      </button>
                      {confirmDeleteId === p.id ? (
                        <>
                          <button style={btnDanger} disabled={busyId === p.id} onClick={() => deleteAccount(p.id)}>
                            <Trash2 size={13} /> Endgültig ablehnen
                          </button>
                          <button style={btnSecondary} onClick={() => setConfirmDeleteId(null)}><X size={13} /></button>
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

            {/* Veranstalter anlegen */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 18px 0', background: C.greenPale, border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.green }}>
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
                        <input required type={showPw ? 'text' : 'password'} style={{ ...inputStyle, paddingRight: 38 }} value={cPassword} onChange={e => setCPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                        <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Firma (optional)</label>
                      <input style={inputStyle} value={cCompany} onChange={e => setCCompany(e.target.value)} placeholder="Eventagentur GmbH" />
                    </div>
                  </div>
                  {createError && <p style={{ fontSize: 13, color: C.red, margin: '0 0 12px' }}>{createError}</p>}
                  <button type="submit" style={btnPrimary} disabled={creating}>
                    {creating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={13} />}
                    {creating ? 'Wird angelegt…' : 'Anlegen & freischalten'}
                  </button>
                  <p style={{ fontSize: 12, color: C.text3, margin: '10px 0 0' }}>Der Account ist sofort nutzbar. Teile die Zugangsdaten selbst mit.</p>
                </form>
              )}
            </section>

            {/* Bestand */}
            <section style={card}>
              <div style={cardHeader}>
                <Users size={16} style={{ color: C.text2 }} />
                Veranstalter ({organizers.length})
              </div>
              {organizers.length === 0 ? (
                <p style={{ padding: '18px', fontSize: 13.5, color: C.text3, margin: 0 }}>Noch keine freigeschalteten Veranstalter.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 640 }}>
                    <thead>
                      <tr>
                        {['Name', 'E-Mail', 'Firma', 'Events', 'Seit', ''].map((h, i) => (
                          <th key={i} style={{ textAlign: 'left', padding: '9px 18px', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.text3, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {organizers.map(o => (
                        <tr key={o.id}>
                          <td style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>
                            {o.name}
                            {o.isAdmin && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: C.accent, background: 'rgba(37,99,235,0.08)', borderRadius: 5, padding: '1px 7px' }}>Admin</span>}
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
                                    <button style={btnDanger} disabled={busyId === o.id} onClick={() => patchAction(o.id, 'revoke')}><ShieldOff size={13} /> Wirklich entziehen</button>
                                    <button style={btnSecondary} onClick={() => setConfirmRevokeId(null)}><X size={13} /></button>
                                  </>
                                ) : confirmDeleteId === o.id ? (
                                  <>
                                    <button style={btnDanger} disabled={busyId === o.id} onClick={() => deleteAccount(o.id)}><Trash2 size={13} /> Endgültig löschen</button>
                                    <button style={btnSecondary} onClick={() => setConfirmDeleteId(null)}><X size={13} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button style={btnSecondary} title="Freischaltung entziehen" disabled={busyId === o.id} onClick={() => { setConfirmDeleteId(null); setConfirmRevokeId(o.id) }}><ShieldOff size={13} /></button>
                                    <button style={btnDanger} title="Account löschen" disabled={busyId === o.id} onClick={() => { setConfirmRevokeId(null); setConfirmDeleteId(o.id) }}><Trash2 size={13} /></button>
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

            {/* Abos */}
            <SubscriptionsSection card={card} cardHeader={cardHeader} btnSecondary={btnSecondary} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Promo-Codes ───────────────────────────────────────────────────────────────

function PromoSection() {
  return (
    <div style={{ padding: 'clamp(18px, 4vw, 28px) clamp(14px, 4vw, 24px) 64px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em', color: C.text }}>Promo-Codes</h1>
          <p style={{ fontSize: 13.5, color: C.text2, margin: 0 }}>Rabattcodes für Influencer und Kampagnen</p>
        </div>
        <PromoCodesSection card={card} cardHeader={cardHeader} btnSecondary={btnSecondary} btnPrimary={btnPrimary} inputStyle={inputStyle} labelStyle={labelStyle} />
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function AdminClient({ adminName }: { adminName: string }) {
  const [section, setSection] = useState<Section>('ubersicht')

  return (
    <AdminShell adminName={adminName} active={section} onNav={setSection}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {section === 'ubersicht'    && <UbersichtSection onNav={setSection} />}
      {section === 'insights'    && <AdminStatsSection onNav={setSection} />}
      {section === 'anbieter'    && <AnbieterSection />}
      {section === 'meldungen'   && <AdminReportsSection card={card} cardHeader={cardHeader} />}
      {section === 'veranstalter' && <VeranstalterSection adminName={adminName} />}
      {section === 'promo'       && <PromoSection />}
      {section === 'benachrichtigungen' && <AdminNotificationsSection />}
      {section === 'testen'      && <AdminTestMailSection />}
    </AdminShell>
  )
}
