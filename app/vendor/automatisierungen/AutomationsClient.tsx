'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Trash2, Zap, Star, Bell, MailQuestion, UserCheck, Calendar, Check, CloudOff, FileSpreadsheet } from 'lucide-react'
import ToggleSwitch from '@/components/ui/ToggleSwitch'

type Kind = 'reminder' | 'review_request' | 'followup_offer' | 'followup_lead'
interface Rule { id?: string; kind: Kind; event_type: string; offset_days: number; label: string; enabled: boolean }

const C = {
  bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)',
  text: 'var(--text)', dim: 'var(--text-dim)', gold: 'var(--gold)', red: 'var(--red, #C5221F)',
}
const inp: React.CSSProperties = { padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text }
const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }
const btnGold: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.gold, color: '#fff' }
const btnGhost: React.CSSProperties = { ...btnGold, background: '#fff', color: C.text, border: `1px solid ${C.border}` }

const KINDS: { kind: Kind; title: string; desc: string; unit: string; icon: React.ReactNode }[] = [
  { kind: 'reminder', title: 'Erinnerungen vor dem Event', desc: 'Kalender-Erinnerung für dich, X Tage vor einem gebuchten Event.', unit: 'Tage vorher', icon: <Bell size={16} /> },
  { kind: 'review_request', title: 'Bewertungsanfragen', desc: 'Automatische E-Mail ans Brautpaar X Tage nach dem Event mit Bewertungslink.', unit: 'Tage nachher', icon: <Star size={16} /> },
  { kind: 'followup_offer', title: 'Angebote nachfassen', desc: 'Erinnerung ans Brautpaar (und dich) X Tage nach Freigabe eines noch offenen Angebots.', unit: 'Tage nach Freigabe', icon: <MailQuestion size={16} /> },
  { kind: 'followup_lead', title: 'Inaktive Leads', desc: 'Lege automatisch eine Aufgabe an, wenn ein Lead X Tage ohne Aktivität ist.', unit: 'Tage inaktiv', icon: <UserCheck size={16} /> },
]

const EVENT_TYPES = [
  { v: 'all', l: 'Alle Event-Typen' },
  { v: 'hochzeit', l: 'Hochzeit' },
  { v: 'firmenevent', l: 'Firmenevent' },
  { v: 'privat', l: 'Privat' },
  { v: 'sonstige', l: 'Sonstige' },
]

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function AutomationsClient() {
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<Rule[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const loadedRef = useRef(false)

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
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/vendor/automations', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ automations: rules }),
        })
        setSaveState(r.ok ? 'saved' : 'error')
      } catch {
        setSaveState('error')
      }
    }, 700)
    return () => clearTimeout(t)
  }, [rules])

  function setRule(i: number, patch: Partial<Rule>) { setRules(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r)) }
  function addRule(kind: Kind) { setRules(rs => [...rs, { kind, event_type: 'all', offset_days: 7, label: '', enabled: true }]) }
  function removeRule(i: number) { setRules(rs => rs.filter((_, idx) => idx !== i)) }

  if (loading) return <div style={{ minHeight: '60dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="bp-spin" /></div>

  return (
    <div className="vnd-page-outer auto-page" style={{ minHeight: '100dvh', background: C.bg, padding: '28px 24px 80px', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <Zap size={20} style={{ color: C.gold }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>Automatisierungen</h1>
        <span style={{ marginLeft: 'auto' }}><SaveIndicator state={saveState} /></span>
      </div>
      <p style={{ fontSize: 13, color: C.dim, margin: '0 0 18px', maxWidth: 620, lineHeight: 1.5 }}>
        Lege Regeln fest, die Forevr automatisch ausführt — Erinnerungen, Bewertungsanfragen und Nachfass-Aktionen. Sie laufen täglich im Hintergrund und werden automatisch gespeichert.
      </p>

      {KINDS.map(group => {
        const groupRules = rules.map((r, i) => ({ r, i })).filter(x => x.r.kind === group.kind)
        return (
          <div key={group.kind} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
              <span style={{ color: C.gold }}>{group.icon}</span>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{group.title}</h2>
            </div>
            <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 14px', lineHeight: 1.5 }}>{group.desc}</p>

            {groupRules.length === 0 && <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 10px' }}>Keine Regel aktiv.</p>}
            {groupRules.map(({ r, i }) => (
              <div key={i} className="auto-rule" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="auto-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: r.enabled ? C.text : C.dim, minWidth: 64 }}>
                  <ToggleSwitch checked={r.enabled} onChange={v => setRule(i, { enabled: v })} size="sm" aria-label="Regel aktiv" />
                  {r.enabled ? 'an' : 'aus'}
                </span>
                <span className="auto-offset" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input style={{ ...inp, width: 64, textAlign: 'right' }} type="number" value={r.offset_days} onChange={e => setRule(i, { offset_days: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })} />
                  <span style={{ fontSize: 12.5, color: C.dim, whiteSpace: 'nowrap' }}>{group.unit}</span>
                </span>
                <select className="auto-select" style={{ ...inp, width: 160 }} value={r.event_type} onChange={e => setRule(i, { event_type: e.target.value })}>
                  {EVENT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <input className="auto-label" style={{ ...inp, flex: '1 1 180px', minWidth: 120 }} value={r.label} placeholder="Bezeichnung (optional)" onChange={e => setRule(i, { label: e.target.value })} />
                <button onClick={() => removeRule(i)} aria-label="Regel entfernen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, display: 'flex', flexShrink: 0 }}><Trash2 size={15} /></button>
              </div>
            ))}
            <button onClick={() => addRule(group.kind)} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12 }}><Plus size={13} /> Regel</button>
          </div>
        )
      })}

      <NewRequestEmailSection />

      <ManualReviewSection />

      <style>{`
        @media (max-width: 640px) {
          .auto-page { padding-left: 14px !important; padding-right: 14px !important; }
          .auto-rule { flex-direction: column; align-items: stretch !important; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid ${C.border}; }
          .auto-rule .auto-select, .auto-rule .auto-label { width: 100% !important; flex: 1 1 auto !important; min-width: 0 !important; }
          .auto-rule .auto-offset { justify-content: space-between; }
          .auto-rule .auto-offset input { flex: 1 1 auto; }
        }
      `}</style>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  const map: Record<Exclude<SaveState, 'idle'>, { text: string; color: string; icon: React.ReactNode }> = {
    saving: { text: 'Speichert…', color: C.dim, icon: <Loader2 size={13} className="bp-spin" /> },
    saved: { text: 'Gespeichert', color: '#15803D', icon: <Check size={13} /> },
    error: { text: 'Nicht gespeichert', color: C.red, icon: <CloudOff size={13} /> },
  }
  const m = map[state]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: m.color }}>
      {m.icon} {m.text}
    </span>
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
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <FileSpreadsheet size={16} style={{ color: C.gold }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Neue Anfragen per E-Mail</h2>
      </div>
      <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 14px', lineHeight: 1.5 }}>
        Erhalte zusätzlich zur Anzeige im Dashboard bei jeder neuen Marktplatz-Anfrage eine E-Mail mit
        allen Anfrage-Daten als Excel-Datei im Anhang — praktisch, um ein Angebot außerhalb von Forevr zu kalkulieren.
      </p>
      {loading ? (
        <div style={{ color: C.dim, fontSize: 13 }}><Loader2 size={15} className="bp-spin" /></div>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: enabled ? C.text : C.dim }}>
          <ToggleSwitch checked={enabled} onChange={toggle} size="sm" aria-label="Neue Anfragen per E-Mail" disabled={saving} />
          {enabled ? 'an' : 'aus'}
        </span>
      )}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <Star size={16} style={{ color: C.gold }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Bewertung manuell anfragen</h2>
      </div>
      <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 14px', lineHeight: 1.5 }}>
        Sende für ein abgeschlossenes Event jederzeit selbst eine Bewertungsanfrage ans Brautpaar.
      </p>
      {loading ? (
        <div style={{ color: C.dim, fontSize: 13 }}><Loader2 size={15} className="bp-spin" /></div>
      ) : events.length === 0 ? (
        <p style={{ fontSize: 12.5, color: C.dim, margin: 0 }}>Noch keine abgeschlossenen (angenommenen) Aufträge.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 9 }}>
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
