'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Mail, Bold, Italic, Link2, RotateCcw, Zap, ChevronRight, Info } from 'lucide-react'
import { SaveStatus } from '@/components/ui/SaveStatus'
import SegmentedToggle from '@/components/vendor/SegmentedToggle'
import {
  EMAIL_TEMPLATE_KEYS, EMAIL_TEMPLATE_META, PLACEHOLDERS, DEFAULT_TEMPLATES,
  DEFAULT_GREETING, DEFAULT_SIGNATURE, renderVendorEmailHtml,
  type EmailTemplate, type EmailTemplateKey, type PlaceholderKey,
} from '@/lib/vendor/email-templates'

const C = {
  bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)',
  text: 'var(--text-primary)', dim: 'var(--text-secondary)', accent: 'var(--accent)',
  red: '#C5221F',
}
const inp: React.CSSProperties = { height: 36, padding: '0 11px', fontSize: 13.5, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text, width: '100%' }
const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 14 }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }
const chip: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 100, border: `1px solid ${C.border}`, background: '#fff', color: C.dim, cursor: 'pointer', fontFamily: 'inherit' }

const SAMPLE_VALUES: Partial<Record<PlaceholderKey, string>> = Object.fromEntries(PLACEHOLDERS.map(p => [p.key, p.sample]))

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Loaded {
  templates: Record<EmailTemplateKey, EmailTemplate>
  greeting: string
  signature: string
  brand: { color: string | null; name: string | null }
  imprint: string[]
}

export default function EmailsClient({ embedded, initialKey }: { embedded?: boolean; initialKey?: EmailTemplateKey } = {}) {
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [templates, setTemplates] = useState<Record<EmailTemplateKey, EmailTemplate>>(DEFAULT_TEMPLATES)
  const [greeting, setGreeting] = useState(DEFAULT_GREETING)
  const [signature, setSignature] = useState(DEFAULT_SIGNATURE)
  const [brand, setBrand] = useState<{ color: string | null; name: string | null }>({ color: null, name: null })
  const [imprint, setImprint] = useState<string[]>([])
  const [active, setActive] = useState<EmailTemplateKey>(initialKey ?? 'offer_released')
  const loadedRef = useRef(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/vendor/email-templates')
    const d = await r.json().catch(() => ({}))
    if (d.templates) setTemplates(d.templates)
    if (typeof d.greeting === 'string') setGreeting(d.greeting)
    if (typeof d.signature === 'string') setSignature(d.signature)
    if (d.brand) setBrand(d.brand)
    if (Array.isArray(d.imprint)) setImprint(d.imprint)
    setLoading(false)
    loadedRef.current = true
  }, [])
  useEffect(() => { load() }, [load])

  // Autosave (debounced) — kein Speichern-Button.
  useEffect(() => {
    if (!loadedRef.current) return
    setSaveState('saving')
    let idle: ReturnType<typeof setTimeout> | undefined
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/vendor/email-templates', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templates, greeting, signature }),
        })
        setSaveState(r.ok ? 'saved' : 'error')
        if (r.ok) idle = setTimeout(() => setSaveState('idle'), 1600)
      } catch { setSaveState('error') }
    }, 700)
    return () => { clearTimeout(t); clearTimeout(idle) }
  }, [templates, greeting, signature])

  function setActiveTpl(patch: Partial<EmailTemplate>) {
    setTemplates(ts => ({ ...ts, [active]: { ...ts[active], ...patch } }))
  }
  function resetActive() {
    setTemplates(ts => ({ ...ts, [active]: { ...DEFAULT_TEMPLATES[active] } }))
  }

  // In der Vorschau echten Firmennamen fuer {firma} zeigen (statt Beispielwert),
  // damit die Vorschau exakt dem entspricht, was das Brautpaar spaeter erhaelt.
  const previewValues = useMemo(
    () => ({ ...SAMPLE_VALUES, ...(brand.name ? { firma: brand.name } : {}) }),
    [brand.name],
  )

  const previewHtml = useMemo(() => renderVendorEmailHtml({
    template: templates[active], greeting, signature, brand, imprint, values: previewValues, ctaUrl: '#',
  }).html, [templates, active, greeting, signature, brand, imprint, previewValues])

  const previewSubject = useMemo(() => renderVendorEmailHtml({
    template: templates[active], greeting, signature, brand, imprint, values: previewValues,
  }).subject, [templates, active, greeting, signature, brand, imprint, previewValues])

  if (loading) return <div style={{ minHeight: '60dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="bp-spin" /></div>

  const meta = EMAIL_TEMPLATE_META[active]
  const tpl = templates[active]
  const isDefault = JSON.stringify(tpl) === JSON.stringify(DEFAULT_TEMPLATES[active])

  const content = (
    <div style={embedded ? undefined : { maxWidth: 1120, margin: '0 auto' }}>

        {!embedded && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mail size={20} style={{ color: C.accent }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.4px', margin: 0, color: C.text }}>E-Mails</h1>
                <p style={{ fontSize: 13.5, color: C.dim, marginTop: 2, marginBottom: 0 }}>
                  Passe die E-Mails an, die Forevr in deinem Namen an das Brautpaar schickt — Änderungen werden sofort gespeichert.
                </p>
              </div>
              <span style={{ flexShrink: 0 }}><SaveStatus status={saveState} /></span>
            </div>

            {/* Verknüpfung zu Automatik */}
            <Link href="/vendor/automatisierungen" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: C.accent, textDecoration: 'none', margin: '4px 0 18px' }}>
              <Zap size={14} /> Wann diese Mails rausgehen, steuerst du unter „Automatik“ <ChevronRight size={14} />
            </Link>
          </>
        )}

        {embedded && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <SaveStatus status={saveState} />
          </div>
        )}

        {/* Zentrale Anrede + Signatur */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
            <Info size={16} style={{ color: C.accent, flexShrink: 0, marginTop: 2 }} />
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: C.text }}>Anrede & Signatur</h2>
              <p style={{ fontSize: 12.5, color: C.dim, margin: '3px 0 0', lineHeight: 1.5 }}>
                Gelten für alle drei Mails. Der eigentliche Text steht weiter unten je Mail.
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div>
              <label style={label}>Anrede</label>
              <RichField value={greeting} onChange={setGreeting} rows={2} placeholders={['brautpaar', 'firma']} />
            </div>
            <div>
              <label style={label}>Signatur</label>
              <RichField value={signature} onChange={setSignature} rows={3} placeholders={['firma', 'brautpaar']} />
            </div>
          </div>
        </div>

        {/* Mail-Auswahl */}
        <SegmentedToggle
          style={{ display: 'inline-flex', marginBottom: 14, flexWrap: 'wrap' }}
          value={active}
          onChange={setActive}
          options={EMAIL_TEMPLATE_KEYS.map(k => ({ key: k, label: EMAIL_TEMPLATE_META[k].title }))}
        />

        {/* Editor + Vorschau */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }} className="eml-grid">
          {/* Editor */}
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: C.text }}>{meta.title}</h2>
                <p style={{ fontSize: 12.5, color: C.dim, margin: '3px 0 0', lineHeight: 1.5 }}>{meta.trigger}</p>
              </div>
              <button onClick={resetActive} disabled={isDefault} title="Diese Mail auf den Standardtext zurücksetzen" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8,
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0,
                cursor: isDefault ? 'default' : 'pointer', opacity: isDefault ? 0.4 : 1,
                border: `1px solid ${C.border}`, background: '#fff', color: C.text,
              }}>
                <RotateCcw size={13} /> Standard
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={label}>Betreff</label>
              <input style={inp} value={tpl.subject} onChange={e => setActiveTpl({ subject: e.target.value })} />
              <PlaceholderRow placeholders={meta.placeholders} onInsert={p => setActiveTpl({ subject: `${tpl.subject}{${p}}` })} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={label}>Überschrift</label>
              <input style={inp} value={tpl.heading} onChange={e => setActiveTpl({ heading: e.target.value })} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={label}>Text</label>
              <RichField value={tpl.body} onChange={v => setActiveTpl({ body: v })} rows={6} placeholders={meta.placeholders} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={label}>Button-Beschriftung</label>
              <input style={{ ...inp, maxWidth: 260 }} value={tpl.cta_label} onChange={e => setActiveTpl({ cta_label: e.target.value })} />
              <p style={{ fontSize: 11.5, color: C.dim, margin: '6px 0 0' }}>{meta.ctaNote}</p>
            </div>
          </div>

          {/* Vorschau */}
          <div style={{ ...card, marginBottom: 0, position: 'sticky', top: 12 }} className="eml-preview">
            <div style={{ fontSize: 12, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Live-Vorschau</div>
            <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: C.text }}>Betreff:</span> {previewSubject || <em style={{ color: C.dim }}>(leer)</em>}
            </div>
            <iframe
              title="E-Mail-Vorschau"
              srcDoc={previewHtml}
              style={{ width: '100%', height: 520, border: `1px solid ${C.border}`, borderRadius: 10, background: '#f7f5f1' }}
            />
            <p style={{ fontSize: 11.5, color: C.dim, margin: '10px 0 0', lineHeight: 1.5 }}>
              Platzhalter sind hier mit Beispieldaten gefüllt. Beim echten Versand werden sie durch die Daten des Brautpaars ersetzt.
            </p>
          </div>
        </div>
    </div>
  )

  const styleTag = (
    <style>{`
      @media (max-width: 860px) {
        .eml-grid { grid-template-columns: 1fr !important; }
        .eml-preview { position: static !important; }
      }
    `}</style>
  )

  if (embedded) {
    return <>{content}{styleTag}</>
  }

  return (
    <div style={{ background: C.bg, flex: 1, minHeight: '100dvh', padding: '28px 24px 48px', overflow: 'auto', boxSizing: 'border-box' }}>
      {content}
      {styleTag}
    </div>
  )
}

// ── Platzhalter-Chips ────────────────────────────────────────────────────────
function PlaceholderRow({ placeholders, onInsert }: { placeholders: PlaceholderKey[]; onInsert: (p: PlaceholderKey) => void }) {
  if (!placeholders.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: C.dim }}>Einfügen:</span>
      {placeholders.map(p => {
        const def = PLACEHOLDERS.find(x => x.key === p)!
        return <button key={p} type="button" style={chip} onClick={() => onInsert(p)} title={def.label}>{`{${p}}`}</button>
      })}
    </div>
  )
}

// ── Rich-Text-Feld (Markdown-lite: **fett**, *kursiv*, [Text](url), - Liste) ──
function RichField({ value, onChange, rows, placeholders }: {
  value: string; onChange: (v: string) => void; rows: number; placeholders: PlaceholderKey[]
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function surround(before: string, after: string, fallback: string) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const sel = value.slice(start, end) || fallback
    const next = value.slice(0, start) + before + sel + after + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + before.length + sel.length + after.length
      el.setSelectionRange(pos, pos)
    })
  }
  function insertAtCursor(text: string) {
    const el = ref.current
    if (!el) { onChange(value + text); return }
    const start = el.selectionStart, end = el.selectionEnd
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => { el.focus(); const pos = start + text.length; el.setSelectionRange(pos, pos) })
  }

  const tbBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', color: C.text, cursor: 'pointer', padding: 0 }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={tbBtn} title="Fett" onClick={() => surround('**', '**', 'fett')}><Bold size={14} /></button>
        <button type="button" style={tbBtn} title="Kursiv" onClick={() => surround('*', '*', 'kursiv')}><Italic size={14} /></button>
        <button type="button" style={tbBtn} title="Link einfügen" onClick={() => surround('[', '](https://)', 'Link-Text')}><Link2 size={14} /></button>
        {placeholders.length > 0 && <span style={{ width: 1, height: 20, background: C.border, margin: '0 2px' }} />}
        {placeholders.map(p => (
          <button key={p} type="button" style={chip} title={PLACEHOLDERS.find(x => x.key === p)?.label} onClick={() => insertAtCursor(`{${p}}`)}>{`{${p}}`}</button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        style={{ ...inp, height: 'auto', padding: '9px 11px', lineHeight: 1.5, resize: 'vertical', minHeight: rows * 22 }}
      />
    </div>
  )
}
