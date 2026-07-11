'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, Plus, RefreshCw, Eye, EyeOff, Check, X, ShieldCheck, ShieldOff, Ban, RotateCcw,
  KeyRound, Trash2, Pencil, ChevronDown, Loader2, Store, Clock, CheckCircle2, AlertTriangle,
  Users as UsersIcon,
} from 'lucide-react'
import { categoryLabel, moderationLabel, type ModerationStatus } from '@/lib/marketplace/types'
import MarketplaceReviewLightbox from './MarketplaceReviewLightbox'
import { VendorForm, type Vendor as FormVendor } from './MarketplaceVendorsSection'
import VendorStatsPanel from '@/components/marketplace/VendorStatsPanel'
import { type Counts, type DayPoint } from '@/lib/marketplace/stats'

type AdminVendor = FormVendor & {
  moderation_status: ModerationStatus
  pending_changes: Record<string, unknown> | null
  verified: boolean
  created_at: string | null
  stats: { total: Counts; last30: Counts }
  review_count: number
}

const C = {
  bg: '#F4F5F7', surface: '#FFFFFF', border: '#E2E4E8', line: '#EEF1F6',
  text: '#1A1D21', text2: '#5A6068', text3: '#9AA0A8',
  accent: '#2563EB', red: '#B91C1C', redPale: '#FEF2F2', green: '#15803D', greenPale: '#F0FDF4',
  amber: '#B45309', amberPale: '#FEF9F0',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Entwurf',    color: C.amber, bg: C.amberPale },
  pending:   { label: 'In Prüfung', color: C.accent, bg: '#EFF4FF' },
  approved:  { label: 'Freigegeben', color: C.green, bg: C.greenPale },
  rejected:  { label: 'Abgelehnt',  color: C.red, bg: C.redPale },
  suspended: { label: 'Gesperrt',   color: C.red, bg: C.redPale },
}

type Tab = 'alle' | 'pruefung' | 'freigegeben' | 'offline' | 'inaktiv'

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: C.text, whiteSpace: 'nowrap' }
const btnGreen: React.CSSProperties = { ...btn, background: C.green, color: '#fff', border: 'none' }
const btnRed: React.CSSProperties = { ...btn, color: C.red, borderColor: '#FCA5A5' }
const btnPrimary: React.CSSProperties = { ...btn, background: C.text, color: '#fff', border: 'none' }
const iconBtn: React.CSSProperties = { ...btn, padding: 7 }

export default function MarketplaceAdminPanel() {
  const [vendors, setVendors] = useState<AdminVendor[]>([])
  const [adminStats, setAdminStats] = useState<{ total: Counts; last30: Counts; series: DayPoint[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('alle')
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/marketplace/vendors')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Laden fehlgeschlagen')
      setVendors(json.vendors ?? [])
      setAdminStats(json.adminStats ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const hasPending = (v: AdminVendor) => !!v.pending_changes && Object.keys(v.pending_changes).length > 0

  function applyOptimistic(id: string, action: string) {
    setVendors(vs => vs.map(v => {
      if (v.id !== id) return v
      const pc = hasPending(v)
      switch (action) {
        case 'approve': return pc ? { ...v, pending_changes: null } : { ...v, moderation_status: 'approved', published: true }
        case 'reject': return pc ? { ...v, pending_changes: null } : { ...v, moderation_status: 'rejected' }
        case 'verify': return { ...v, verified: true }
        case 'unverify': return { ...v, verified: false }
        case 'suspend': return { ...v, moderation_status: 'suspended' }
        case 'unsuspend': return { ...v, moderation_status: 'approved' }
        default: return v
      }
    }))
  }
  function moderate(id: string, action: string, reason?: string) {
    applyOptimistic(id, action)
    fetch(`/api/admin/marketplace/vendors/${id}/moderate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }),
    }).then(res => { if (!res.ok) load() }).catch(() => load())
  }
  function togglePublish(v: AdminVendor) {
    setVendors(vs => vs.map(x => x.id === v.id ? { ...x, published: !x.published } : x))
    fetch(`/api/admin/marketplace/vendors/${v.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ published: !v.published }),
    }).then(res => { if (!res.ok) load() }).catch(() => load())
  }
  async function remove(v: AdminVendor) {
    if (!confirm(`Anbieter „${v.company_name || v.name}" endgültig löschen? Login, Bilder und Daten werden entfernt.`)) return
    await fetch(`/api/admin/marketplace/vendors/${v.id}`, { method: 'DELETE' })
    load()
  }
  async function resetPassword(v: AdminVendor) {
    const pw = prompt(`Neues Passwort für ${v.login_email ?? v.name} (mind. 8 Zeichen):`)
    if (!pw) return
    const res = await fetch(`/api/admin/marketplace/vendors/${v.id}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }),
    })
    alert(res.ok ? 'Passwort aktualisiert.' : 'Fehler beim Zurücksetzen.')
  }

  // ── KPIs & Filter ──
  const counts = useMemo(() => ({
    total: vendors.length,
    pruefung: vendors.filter(v => v.moderation_status === 'pending' || hasPending(v)).length,
    freigegeben: vendors.filter(v => v.moderation_status === 'approved').length,
    offline: vendors.filter(v => v.moderation_status === 'approved' && !v.published).length,
  }), [vendors])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return vendors.filter(v => {
      if (needle) {
        const hay = `${v.company_name ?? ''} ${v.name} ${v.login_email ?? ''} ${v.city ?? ''} ${categoryLabel(v.category)}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      switch (tab) {
        case 'pruefung': return v.moderation_status === 'pending' || hasPending(v)
        case 'freigegeben': return v.moderation_status === 'approved'
        case 'offline': return v.moderation_status === 'approved' && !v.published
        case 'inaktiv': return (v.stats.total.profile_view + v.stats.total.request) === 0
        default: return true
      }
    })
  }, [vendors, q, tab])

  const TABS: { key: Tab; label: string; n?: number }[] = [
    { key: 'alle', label: 'Alle', n: counts.total },
    { key: 'pruefung', label: 'In Prüfung', n: counts.pruefung },
    { key: 'freigegeben', label: 'Freigegeben', n: counts.freigegeben },
    { key: 'offline', label: 'Offline', n: counts.offline },
    { key: 'inaktiv', label: 'Ohne Aktivität' },
  ]

  return (
    <div style={{ padding: '28px 24px 64px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em', color: C.text }}>Marktplatz-Anbieter</h1>
            <p style={{ fontSize: 13.5, color: C.text2, margin: 0 }}>Freigeben, prüfen, verwalten und Reichweite auswerten</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={() => { setLoading(true); load() }}><RefreshCw size={14} /> Aktualisieren</button>
            <button style={btnPrimary} onClick={() => { setCreating(true); setEditId(null); setExpanded(null) }}><Plus size={15} /> Anbieter anlegen</button>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.redPale, border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 16 }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        {/* KPI-Kacheln */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Kpi icon={Store} label="Anbieter gesamt" value={counts.total} color={C.accent} />
          <Kpi icon={Clock} label="In Prüfung" value={counts.pruefung} color={C.accent} highlight={counts.pruefung > 0} />
          <Kpi icon={CheckCircle2} label="Freigegeben" value={counts.freigegeben} color={C.green} />
          <Kpi icon={EyeOff} label="Freigegeben, offline" value={counts.offline} color={C.amber} />
        </div>

        {/* Gesamt-Reichweite (Tracking) */}
        {adminStats && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14, fontWeight: 700, color: C.text }}>
              <UsersIcon size={16} style={{ color: C.accent }} /> Marktplatz-Reichweite (gesamt)
            </div>
            <VendorStatsPanel total={adminStats.total} last30={adminStats.last30} series={adminStats.series} accent={C.accent} compact />
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.text3 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Suche: Firma, E-Mail, Ort, Kategorie…"
              style={{ width: '100%', height: 40, padding: '0 12px 0 34px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ ...btn, background: tab === t.key ? C.text : '#fff', color: tab === t.key ? '#fff' : C.text2, borderColor: tab === t.key ? C.text : C.border }}>
                {t.label}{typeof t.n === 'number' && <span style={{ opacity: 0.7 }}>· {t.n}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Anlegen-Formular */}
        {creating && (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <VendorForm onDone={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />
          </div>
        )}

        {/* Tabelle */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: C.text3 }} /></div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', fontSize: 13.5, color: C.text3, margin: 0 }}>Keine Anbieter in dieser Ansicht.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 920 }}>
                <thead>
                  <tr>
                    {['Anbieter', 'Status', 'Online', 'Aufrufe', 'Kontaktklicks', 'Anfragen', 'Bew.', ''].map((h, i) => (
                      <th key={i} style={{ textAlign: i >= 3 && i <= 6 ? 'right' : 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text3, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => {
                    const pc = hasPending(v)
                    const sm = STATUS_META[v.moderation_status] ?? STATUS_META.draft
                    const contacts = v.stats.total.contact_email + v.stats.total.contact_phone
                    const isOpen = expanded === v.id
                    return (
                      <React.Fragment key={v.id}>
                        <tr style={{ borderBottom: `1px solid ${C.line}`, background: isOpen ? '#FAFBFD' : undefined }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
                              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f0f2f5', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {v.logo_url
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={v.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <span style={{ fontSize: 14, fontWeight: 700, color: '#b6bdc9' }}>{(v.company_name || v.name).charAt(0)}</span>}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {v.company_name || v.name}
                                  {v.verified && <ShieldCheck size={13} style={{ color: C.green }} />}
                                </div>
                                <div style={{ fontSize: 12, color: C.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                                  {categoryLabel(v.category)}{v.city ? ` · ${v.city}` : ''}{v.login_email ? ` · ${v.login_email}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: sm.color, background: sm.bg, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                              {pc ? 'Änderungen prüfen' : sm.label}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <button onClick={() => togglePublish(v)} disabled={v.moderation_status !== 'approved'} title={v.moderation_status !== 'approved' ? 'Erst nach Freigabe' : v.published ? 'Offline nehmen' : 'Online stellen'}
                              style={{ ...iconBtn, opacity: v.moderation_status !== 'approved' ? 0.4 : 1, color: v.published ? C.green : C.text2 }}>
                              {v.published ? <Eye size={15} /> : <EyeOff size={15} />}
                            </button>
                          </td>
                          <Num v={v.stats.total.profile_view} sub={v.stats.last30.profile_view} />
                          <Num v={contacts} sub={v.stats.last30.contact_email + v.stats.last30.contact_phone} />
                          <Num v={v.stats.total.request} sub={v.stats.last30.request} />
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{v.review_count}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {(v.moderation_status === 'pending' || pc) && (
                                <>
                                  <button style={{ ...btn, borderColor: C.accent, color: C.accent }} onClick={() => setReviewing(v.id)} title="Vorschau prüfen"><Eye size={14} /></button>
                                  <button style={btnGreen} onClick={() => moderate(v.id, 'approve')} title={pc ? 'Änderungen übernehmen' : 'Freigeben'}><Check size={14} /></button>
                                  <button style={btnRed} onClick={() => { const r = pc ? undefined : (prompt('Ablehnungsgrund (für den Anbieter sichtbar):') ?? ''); if (!pc && r === '') return; moderate(v.id, 'reject', r) }} title="Ablehnen"><X size={14} /></button>
                                </>
                              )}
                              {v.moderation_status === 'approved' && (
                                v.verified
                                  ? <button style={iconBtn} onClick={() => moderate(v.id, 'unverify')} title="Verifizierung entziehen"><ShieldOff size={14} /></button>
                                  : <button style={iconBtn} onClick={() => moderate(v.id, 'verify')} title="Verifizieren"><ShieldCheck size={14} /></button>
                              )}
                              {v.moderation_status === 'suspended'
                                ? <button style={iconBtn} onClick={() => moderate(v.id, 'unsuspend')} title="Entsperren"><RotateCcw size={14} /></button>
                                : v.moderation_status === 'approved' && <button style={{ ...iconBtn, color: C.red }} onClick={() => moderate(v.id, 'suspend')} title="Sperren"><Ban size={14} /></button>}
                              <button style={iconBtn} onClick={() => { setEditId(editId === v.id ? null : v.id); setExpanded(null) }} title="Bearbeiten"><Pencil size={14} /></button>
                              <button style={iconBtn} onClick={() => resetPassword(v)} title="Passwort zurücksetzen"><KeyRound size={14} /></button>
                              <button style={{ ...iconBtn, color: C.red }} onClick={() => remove(v)} title="Löschen"><Trash2 size={14} /></button>
                              <button style={iconBtn} onClick={() => { setExpanded(isOpen ? null : v.id); setEditId(null) }} title="Statistik">
                                <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={8} style={{ padding: '4px 14px 18px', background: '#FAFBFD', borderBottom: `1px solid ${C.line}` }}>
                              <VendorStatsPanel total={v.stats.total} last30={v.stats.last30} series={[]} accent={C.accent} compact />
                            </td>
                          </tr>
                        )}
                        {editId === v.id && (
                          <tr>
                            <td colSpan={8} style={{ padding: 0, borderBottom: `1px solid ${C.line}` }}>
                              <VendorForm vendor={v} onDone={() => { setEditId(null); load() }} onCancel={() => setEditId(null)} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {reviewing && (
        <MarketplaceReviewLightbox
          vendorId={reviewing}
          onClose={() => setReviewing(null)}
          onModerate={(action, reason) => moderate(reviewing, action, reason)}
        />
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, color, highlight }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${highlight ? color : C.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.text2, fontSize: 12, fontWeight: 600 }}>
        <Icon size={14} style={{ color }} /> {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function Num({ v, sub }: { v: number; sub: number }) {
  return (
    <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ fontWeight: 700, color: C.text }}>{v.toLocaleString('de-DE')}</div>
      {sub > 0 && <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>+{sub} / 30 T.</div>}
    </td>
  )
}
