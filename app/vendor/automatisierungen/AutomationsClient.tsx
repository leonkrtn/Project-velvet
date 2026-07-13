'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Trash2, Zap, Star, Bell, MailQuestion, UserCheck, Calendar, Check, FileSpreadsheet, Mail, ListChecks } from 'lucide-react'
import ToggleSwitch from '@/components/ui/ToggleSwitch'
import { SaveStatus } from '@/components/ui/SaveStatus'
import EmailsClient from '@/app/vendor/e-mails/EmailsClient'
import SegmentedToggle from '@/components/vendor/SegmentedToggle'
import type { EmailTemplateKey } from '@/lib/vendor/email-templates'

type PageTab = 'regeln' | 'emails'
const PAGE_TABS: { key: PageTab; label: string; icon: React.ReactNode }[] = [
  { key: 'regeln', label: 'Regeln', icon: <ListChecks size={15} /> },
  { key: 'emails', label: 'E-Mail-Texte', icon: <Mail size={15} /> },
]

type Kind = 'reminder' | 'review_request' | 'followup_offer' | 'followup_lead'
interface Rule { id?: string; kind: Kind; event_type: string; offset_days: number; label: string; enabled: boolean }

const C = {
  bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)',
  text: 'var(--text)', dim: 'var(--text-dim)', gold: 'var(--gold)', red: 'var(--red, #C5221F)',
}
const inp: React.CSSProperties = { height: 34, padding: '0 10px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text }
const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 'var(--radius, 14px)', padding: 20, marginBottom: 14 }
const btnGold: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.gold, color: '#fff' }
const btnGhost: React.CSSProperties = { ...btnGold, background: '#fff', color: C.text, border: `1px solid ${C.border}` }
const sectionHead: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '26px 0 10px' }

// Satzbausteine pro Regel-Art: [Toggle] <before> [Zahl] <after> · gilt für [Event-Typ]
const KINDS: { kind: Kind; title: string; desc: string; before: string; after: string; example: string; icon: React.ReactNode }[] = [
  {
    kind: 'reminder', title: 'Erinnerung vor dem Event',
    desc: 'Legt dir automatisch eine Kalender-Erinnerung vor jedem gebuchten Event an.',
    before: 'Erinnere mich', after: 'Tage vor dem Event',
    example: 'z. B. 7 Tage vorher, um letzte Details zu klären',
    icon: <Bell size={16} />,
  },
  {
    kind: 'review_request', title: 'Bewertung anfragen',
    desc: 'Schickt dem Brautpaar automatisch eine E-Mail mit deinem Bewertungslink.',
    before: 'Sende die Anfrage', after: 'Tage nach dem Event',
    example: 'z. B. 5 Tage nachher, wenn die Erinnerungen noch frisch sind',
    icon: <Star size={16} />,
  },
  {
    kind: 'followup_offer', title: 'Offenes Angebot nachfassen',
    desc: 'Erinnert das Brautpaar (und dich) an ein freigegebenes, noch unbeantwortetes Angebot.',
    before: 'Fasse nach', after: 'Tage nach der Freigabe',
    example: 'z. B. 5 Tage nach Versand des Angebots',
    icon: <MailQuestion size={16} />,
  },
  {
    kind: 'followup_lead', title: 'Inaktiven Lead wiedervorlegen',
    desc: 'Legt dir eine Aufgabe im CRM an, wenn sich bei einem Lead nichts mehr tut.',
    before: 'Lege eine Aufgabe an nach', after: 'Tagen ohne Aktivität',
    example: 'z. B. 14 Tage Funkstille',
    icon: <UserCheck size={16} />,
  },
]

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function AutomationsClient() {
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<Rule[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [tab, setTab] = useState<PageTab>('regeln')
  const [emailKey, setEmailKey] = useState<EmailTemplateKey>('offer_released')
  const loadedRef = useRef(false)

  // Von einer Regel aus direkt in den passenden E-Mail-Reiter springen.
  function openEmail(kind: Kind) {
    if (kind === 'review_request') setEmailKey('review_request')
    else if (kind === 'followup_offer') setEmailKey('followup_offer')
    setTab('emails')
  }

  const load = useCallback(async () => {
    const r = await fetch('/api/vendor/automations')
    const d = await r.json().catch(() => ({}))
    setRules((d.automations ?? []).map((a: Rule) => ({ ...a })))
    setLoading(false)
    loadedRef.current = true
  }, [])
  useEffect(() => { load() }, [load])

  // Autosave: bei jeder Änderung debounced speichern (kein Speichern-Button).
  useEffect(() => {
    if (!loadedRef.current) return
    setSaveState('saving')
    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/vendor/automations', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ automations: rules }),
        })
        setSaveState(r.ok ? 'saved' : 'error')
        if (r.ok) idleTimer = setTimeout(() => setSaveState('idle'), 1600)
      } catch {
        setSaveState('error')
      }
    }, 700)
    return () => { clearTimeout(t); clearTimeout(idleTimer) }
  }, [rules])

  function setRule(i: number, patch: Partial<Rule>) { setRules(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r)) }
  function addRule(kind: Kind) { setRules(rs => [...rs, { kind, event_type: 'all', offset_days: 7, label: '', enabled: true }]) }
  function removeRule(i: number) { setRules(rs => rs.filter((_, idx) => idx !== i)) }

  if (loading) return <div style={{ minHeight: '60dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="bp-spin" /></div>

  return (
    <div className="vnd-page-outer" style={{ background: C.bg, flex: 1, minHeight: '100dvh', padding: '28px 24px 48px', overflow: 'auto', boxSizing: 'border-box' }}>

      {/* Header (Muster wie Angebote/Anfragen/Report) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div className="vnd-hdr-icon" style={{ width: 42, height: 42, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Zap size={20} style={{ color: C.gold }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Automatik &amp; E-Mails</h1>
          <p style={{ fontSize: 13.5, color: C.dim, marginTop: 2, marginBottom: 0 }}>
            Regeln, die Forevr täglich automatisch für dich ausführt, und die Mails, die dabei verschickt werden — Änderungen werden sofort gespeichert.
          </p>
        </div>
        <span style={{ flexShrink: 0 }}><SaveStatus status={saveState} /></span>
      </div>

      {/* Tabs: Regeln / E-Mail-Texte */}
      <SegmentedToggle
        style={{ display: 'inline-flex', marginBottom: 20 }}
        value={tab}
        onChange={(v: PageTab) => { if (v === 'emails') setEmailKey('offer_released'); setTab(v) }}
        options={PAGE_TABS.map(t => ({ key: t.key, label: <>{t.icon}{t.label}</> }))}
      />

      {tab === 'emails' && <EmailsClient embedded initialKey={emailKey} />}

      {tab === 'regeln' && (<>
      <h3 style={{ ...sectionHead, marginTop: 0 }}>Automatische Regeln</h3>
      {KINDS.map(group => {
        const groupRules = rules.map((r, i) => ({ r, i })).filter(x => x.r.kind === group.kind)
        const activeCount = groupRules.filter(x => x.r.enabled).length
        return (
          <div key={group.kind} style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: activeCount > 0 ? 'rgba(184,153,104,0.14)' : C.bg,
                border: `1px solid ${activeCount > 0 ? 'rgba(184,153,104,0.35)' : C.border}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: activeCount > 0 ? C.gold : C.dim,
              }}>
                {group.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{group.title}</h2>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                    background: activeCount > 0 ? 'rgba(21,128,61,0.1)' : 'rgba(0,0,0,0.05)',
                    color: activeCount > 0 ? '#15803D' : C.dim,
                  }}>
                    {activeCount > 0 ? `${activeCount} aktiv` : 'Aus'}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: C.dim, margin: '3px 0 0', lineHeight: 1.5 }}>{group.desc}</p>
                {(group.kind === 'review_request' || group.kind === 'followup_offer') && (
                  <button onClick={() => openEmail(group.kind)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: C.gold, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', marginTop: 6 }}>
                    <Mail size={13} /> E-Mail-Text bearbeiten
                  </button>
                )}
              </div>
            </div>

            {groupRules.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {groupRules.map(({ r, i }) => (
                  <div
                    key={i}
                    className="auto-rule"
                    style={{
                      padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.border}`,
                      background: C.bg, opacity: r.enabled ? 1 : 0.55, transition: 'opacity 0.15s',
                    }}
                  >
                    {/* Zeile 1: Ein/Aus + Kernsatz + Löschen — immer zusammen, egal wie schmal */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ToggleSwitch checked={r.enabled} onChange={v => setRule(i, { enabled: v })} size="sm" aria-label="Regel aktiv" />
                      <span className="auto-sentence" style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: C.text }}>
                        {group.before}
                        <input
                          style={{ ...inp, width: 58, textAlign: 'right' }} type="number" min={0} value={r.offset_days}
                          onChange={e => setRule(i, { offset_days: Math.max(0, e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0) })}
                        />
                        {group.after}
                      </span>
                      <button onClick={() => removeRule(i)} aria-label="Regel entfernen" title="Regel entfernen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, display: 'flex', flexShrink: 0, padding: 4 }}><Trash2 size={15} /></button>
                    </div>

                    {/* Zeile 2: Nebenbedingungen — visuell abgesetzt vom Kernsatz */}
                    <div className="auto-rule-meta" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                      <input
                        className="auto-label"
                        style={{ ...inp, flex: '1 1 180px', minWidth: 140, height: 34, maxHeight: 34, lineHeight: '32px', paddingTop: 0, paddingBottom: 0 }}
                        value={r.label} placeholder="Interne Bezeichnung (optional)"
                        onChange={e => setRule(i, { label: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: groupRules.length > 0 ? 10 : 14 }}>
              <button onClick={() => addRule(group.kind)} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }}><Plus size={13} /> Regel hinzufügen</button>
              {groupRules.length === 0 && <span style={{ fontSize: 12, color: C.dim }}>{group.example}</span>}
            </div>
          </div>
        )
      })}

      <h3 style={sectionHead}>Benachrichtigungen</h3>
      <NewRequestEmailSection />

      <h3 style={sectionHead}>Manuelle Aktionen</h3>
      <ManualReviewSection />
      </>)}

      <style>{`
        @media (max-width: 480px) {
          .auto-rule-meta { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>
    </div>
  )
}

function NewRequestEmailSection() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/vendor/notifications').then(r => r.json()).then(d => {
      setEnabled(!!d.notifyNewRequestEmail)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function toggle(v: boolean) {
    setEnabled(v)
    setSaving(true)
    try {
      await fetch('/api/vendor/notifications', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyNewRequestEmail: v }),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: enabled ? 'rgba(184,153,104,0.14)' : C.bg,
        border: `1px solid ${enabled ? 'rgba(184,153,104,0.35)' : C.border}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: enabled ? C.gold : C.dim,
      }}>
        <FileSpreadsheet size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Neue Anfragen per E-Mail</h2>
        <p style={{ fontSize: 12.5, color: C.dim, margin: '3px 0 0', lineHeight: 1.5 }}>
          Bei jeder neuen Marktplatz-Anfrage bekommst du eine E-Mail mit allen Anfrage-Daten
          als Excel-Anhang — praktisch, um außerhalb von Forevr zu kalkulieren.
        </p>
      </div>
      <span style={{ flexShrink: 0, paddingTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        {loading ? (
          <Loader2 size={15} className="bp-spin" style={{ color: C.dim }} />
        ) : (
          <>
            <span style={{ fontSize: 12, fontWeight: 700, color: enabled ? C.gold : C.dim }}>{enabled ? 'An' : 'Aus'}</span>
            <ToggleSwitch checked={enabled} onChange={toggle} size="sm" aria-label="Neue Anfragen per E-Mail" disabled={saving} />
          </>
        )}
      </span>
    </div>
  )
}

function ManualReviewSection() {
  const [events, setEvents] = useState<{ id: string; name: string; date: string | null; invited: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/vendor/reviews/request')
    const d = await r.json().catch(() => ({}))
    setEvents(d.events ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function send(eventId: string) {
    setBusy(eventId)
    await fetch('/api/vendor/reviews/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId }) })
    setBusy(null); load()
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: events.length > 0 || loading ? 14 : 0 }}>
        <span style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: C.bg, border: `1px solid ${C.border}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.dim,
        }}>
          <Star size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Bewertung manuell anfragen</h2>
          <p style={{ fontSize: 12.5, color: C.dim, margin: '3px 0 0', lineHeight: 1.5 }}>
            Sende für ein abgeschlossenes Event jederzeit selbst eine Bewertungsanfrage ans Brautpaar.
          </p>
        </div>
      </div>
      {loading ? (
        <div style={{ color: C.dim, fontSize: 13 }}><Loader2 size={15} className="bp-spin" /></div>
      ) : events.length === 0 ? (
        <p style={{ fontSize: 12.5, color: C.dim, margin: '10px 0 0' }}>Noch keine abgeschlossenen (angenommenen) Aufträge.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 9, background: C.bg }}>
              <Calendar size={14} style={{ color: C.dim, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}{e.date ? ` · ${e.date}` : ''}</span>
              {e.invited ? (
                <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={14} /> Angefragt</span>
              ) : (
                <button onClick={() => send(e.id)} disabled={busy === e.id} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }}>
                  {busy === e.id ? <Loader2 size={13} className="bp-spin" /> : <Star size={13} />} Anfragen
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
