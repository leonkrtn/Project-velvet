'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Flag, Check, Ban, Loader2, Mail, StickyNote, ChevronDown, ChevronUp } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Report {
  id: string
  vendor_id: string
  reason: string
  comment: string | null
  status: 'open' | 'closed'
  admin_note: string | null
  created_at: string
  dienstleister_profiles: {
    company_name: string | null
    name: string | null
    category: string
    login_email: string | null
  } | null
}

const REASON_LABEL: Record<string, string> = {
  falsche_angaben: 'Falsche Angaben',
  unangemessene_bilder: 'Unangemessene Bilder',
  betrug: 'Betrug',
  spam: 'Spam',
}

const C = {
  surface: '#FFFFFF', border: '#E2E4E8', text: '#1A1D21', text2: '#5A6068', text3: '#9AA0A8',
  accent: '#2563EB', red: '#B91C1C', redPale: '#FEF2F2', green: '#15803D', greenPale: '#F0FDF4',
}

const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }
const cardHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 600, color: C.text }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: '#fff', color: C.text }
const btnDanger: React.CSSProperties = { ...btn, background: C.redPale, color: C.red, borderColor: '#FCA5A5' }
const btnGreen: React.CSSProperties = { ...btn, background: C.greenPale, color: C.green, borderColor: '#BBF7D0' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminReportsSection({ card: cardStyle, cardHeader: cardHeaderStyle }: { card: React.CSSProperties; cardHeader: React.CSSProperties }) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'open' | 'closed'>('open')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/reports')
    const json = await res.json().catch(() => ({}))
    setReports(json.reports ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function doAction(reportId: string, action: string, adminNote?: string) {
    setBusyId(reportId)
    await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, adminNote }),
    })
    await load()
    setBusyId(null)
    setNoteId(null)
  }

  const filtered = reports.filter(r => r.status === filter)
  const openCount = reports.filter(r => r.status === 'open').length

  return (
    <div style={{ padding: 'clamp(18px, 4vw, 28px) clamp(14px, 4vw, 24px) 64px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: C.text }}>Meldungen</h1>
            <p style={{ fontSize: 13.5, color: C.text2, margin: '3px 0 0' }}>Von Nutzern gemeldete Anbieter</p>
          </div>
          <div style={{ display: 'flex', gap: 4, background: '#F0F1F3', borderRadius: 8, padding: 3 }}>
            {(['open', 'closed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  background: filter === f ? '#fff' : 'transparent',
                  color: filter === f ? C.text : C.text3,
                  boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {f === 'open' ? 'Offen' : 'Erledigt'}
                {f === 'open' && openCount > 0 && (
                  <span style={{ background: C.accent, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 100, padding: '1px 6px' }}>
                    {openCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <section style={cardStyle}>
          <div style={cardHeaderStyle}>
            <Flag size={16} style={{ color: C.text2 }} />
            {filter === 'open' ? 'Offene Meldungen' : 'Geschlossene Meldungen'}
            {filter === 'open' && openCount > 0 && (
              <span style={{ marginLeft: 4, fontSize: 12, fontWeight: 700, color: '#fff', background: C.accent, borderRadius: 999, padding: '1px 8px' }}>
                {openCount}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text2, fontSize: 13.5, padding: '24px 18px' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Wird geladen…
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: '18px', fontSize: 13.5, color: C.text3, margin: 0 }}>
              {filter === 'open' ? 'Keine offenen Meldungen.' : 'Keine geschlossenen Meldungen.'}
            </p>
          ) : (
            <div>
              {filtered.map((report, i) => {
                const vendor = report.dienstleister_profiles
                const vendorName = vendor?.company_name || vendor?.name || 'Unbekannter Anbieter'
                const isExpanded = expandedId === report.id
                const busy = busyId === report.id

                return (
                  <div key={report.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    {/* Summary row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '13px 18px' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 14, color: C.text }}>{vendorName}</strong>
                          <span style={{
                            fontSize: 11.5, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
                            background: 'rgba(239,68,68,0.08)', color: '#DC2626',
                            border: '1px solid rgba(239,68,68,0.2)',
                          }}>
                            {REASON_LABEL[report.reason] ?? report.reason}
                          </span>
                        </div>
                        <p style={{ fontSize: 12.5, color: C.text2, margin: '2px 0 0' }}>
                          {vendor?.category && <span style={{ textTransform: 'capitalize' }}>{vendor.category.replace(/-/g, ' ')} · </span>}
                          {formatDate(report.created_at)}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {vendor?.login_email && (
                          <a
                            href={`mailto:${vendor.login_email}?subject=Meldung%20auf%20Forevr`}
                            style={{ ...btn, textDecoration: 'none' }}
                            title="Anbieter per E-Mail kontaktieren"
                          >
                            <Mail size={13} /> Anbieter
                          </a>
                        )}
                        {report.status === 'open' && (
                          <>
                            <button style={btnDanger} disabled={busy} title="Anbieter sperren und Meldung schließen" onClick={async () => {
                              if (await confirm(`Anbieter "${vendorName}" wirklich sperren? Das Profil wird offline gesetzt.`)) {
                                doAction(report.id, 'suspend_vendor')
                              }
                            }}>
                              {busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Ban size={13} />}
                              Sperren
                            </button>
                            <button style={btnGreen} disabled={busy} onClick={() => doAction(report.id, 'close')}>
                              {busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                              Schließen
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : report.id)}
                          style={{ ...btn, padding: '6px 8px' }}
                          title={isExpanded ? 'Einklappen' : 'Details & Notiz'}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${C.border}`, background: '#FAFBFC' }}>
                        {report.comment && (
                          <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: `1px solid ${C.border}`, margin: '12px 0', fontSize: 13.5, color: C.text2, lineHeight: 1.6 }}>
                            <span style={{ fontWeight: 600, color: C.text, display: 'block', marginBottom: 4 }}>Kommentar des Meldenden:</span>
                            {report.comment}
                          </div>
                        )}

                        {/* Admin note */}
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StickyNote size={13} /> Interne Notiz
                          </div>
                          {noteId === report.id ? (
                            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                              <textarea
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                placeholder="Interne Notiz für das Admin-Team…"
                                style={{ width: '100%', minHeight: 72, padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical', boxSizing: 'border-box' }}
                              />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button style={btnGreen} onClick={() => doAction(report.id, 'note', noteText)}>
                                  <Check size={13} /> Speichern
                                </button>
                                <button style={btn} onClick={() => setNoteId(null)}>Abbrechen</button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => { setNoteId(report.id); setNoteText(report.admin_note ?? '') }}
                              style={{
                                padding: '8px 10px', borderRadius: 7, border: `1px dashed ${C.border}`,
                                fontSize: 13.5, color: report.admin_note ? C.text : C.text3,
                                cursor: 'text', lineHeight: 1.6, minHeight: 36,
                              }}
                            >
                              {report.admin_note || 'Hier klicken, um eine interne Notiz hinzuzufügen…'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
