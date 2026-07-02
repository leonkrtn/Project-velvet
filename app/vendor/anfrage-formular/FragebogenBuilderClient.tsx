'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown, FileText, LayoutTemplate, GripVertical,
  AlertTriangle, Eye, EyeOff,
} from 'lucide-react'
import {
  DEFAULT_SETTINGS, QUESTION_TYPE_LABELS, TAX_MODE_LABELS,
  type QQuestion, type QSection, type QuestionType, type QuestionnaireSettings, type TaxMode,
  type PriceTier, type SeasonRule, type TravelZone, type TravelMode,
} from '@/lib/vendor/questionnaire'
import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace/types'
import { templateForCategory } from '@/lib/vendor/questionnaire-templates'
import ToggleSwitch from '@/components/ui/ToggleSwitch'

const C = {
  bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)',
  text: 'var(--text)', dim: 'var(--text-dim)', gold: 'var(--gold)', red: 'var(--red, #C5221F)',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: 13.5, border: `1px solid ${C.border}`,
  borderRadius: 8, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text,
}
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: C.dim, marginBottom: 5 }
const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid transparent' }
const btnGold: React.CSSProperties = { ...btn, background: C.gold, color: '#fff' }
const btnGhost: React.CSSProperties = { ...btn, background: '#fff', color: C.text, border: `1px solid ${C.border}` }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 4, display: 'inline-flex', borderRadius: 6 }

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`)

function newQuestion(sectionId: string, sort: number): QQuestion {
  return { id: uid(), section_id: sectionId, type: 'text', label: '', help_text: '', required: false, options: [], pricing: {}, sort_order: sort }
}
function newSection(sort: number): QSection {
  const id = uid()
  return { id, title: '', description: '', sort_order: sort, questions: [newQuestion(id, 0)] }
}

export default function FragebogenBuilderClient({ category, embedded }: { category: string; embedded?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<QuestionnaireSettings>(DEFAULT_SETTINGS)
  const [sections, setSections] = useState<QSection[]>([])
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const flash = (kind: 'ok' | 'err', text: string) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 4000) }

  const load = useCallback(async () => {
    const res = await fetch('/api/vendor/questionnaire')
    if (res.ok) {
      const { questionnaire } = await res.json()
      const { sections: secs, id, dienstleister_id, ...rest } = questionnaire
      setSettings({ ...DEFAULT_SETTINGS, ...rest })
      setSections(Array.isArray(secs) ? secs : [])
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const setSetting = <K extends keyof QuestionnaireSettings>(k: K, v: QuestionnaireSettings[K]) =>
    setSettings(s => ({ ...s, [k]: v }))

  // ── Sektionen ──────────────────────────────────────────────────────────────
  function addSection() { setSections(s => [...s, newSection(s.length)]) }
  function removeSection(id: string) { setSections(s => s.filter(x => x.id !== id)) }
  function moveSection(idx: number, dir: -1 | 1) {
    setSections(s => {
      const next = [...s]; const t = idx + dir
      if (t < 0 || t >= next.length) return s
      ;[next[idx], next[t]] = [next[t], next[idx]]
      return next
    })
  }
  function updateSection(id: string, patch: Partial<QSection>) {
    setSections(s => s.map(x => x.id === id ? { ...x, ...patch } : x))
  }

  // ── Fragen ─────────────────────────────────────────────────────────────────
  function addQuestion(sectionId: string) {
    setSections(s => s.map(x => x.id === sectionId ? { ...x, questions: [...x.questions, newQuestion(sectionId, x.questions.length)] } : x))
  }
  function removeQuestion(sectionId: string, qid: string) {
    setSections(s => s.map(x => x.id === sectionId ? { ...x, questions: x.questions.filter(q => q.id !== qid) } : x))
  }
  function moveQuestion(sectionId: string, idx: number, dir: -1 | 1) {
    setSections(s => s.map(x => {
      if (x.id !== sectionId) return x
      const qs = [...x.questions]; const t = idx + dir
      if (t < 0 || t >= qs.length) return x
      ;[qs[idx], qs[t]] = [qs[t], qs[idx]]
      return { ...x, questions: qs }
    }))
  }
  function updateQuestion(sectionId: string, qid: string, patch: Partial<QQuestion>) {
    setSections(s => s.map(x => x.id === sectionId ? { ...x, questions: x.questions.map(q => q.id === qid ? { ...q, ...patch } : q) } : x))
  }

  function applyTemplate(cat: string) {
    if (sections.length > 0 && !window.confirm('Bestehende Abschnitte durch die Vorlage ersetzen?')) return
    const tpl = templateForCategory(cat)
    setSettings(s => ({ ...s, ...tpl.settings, is_active: true }))
    setSections(tpl.sections.map((sec, si) => {
      const sid = uid()
      return {
        id: sid, title: sec.title, description: sec.description ?? '', sort_order: si,
        questions: sec.questions.map((q, qi) => ({
          id: uid(), section_id: sid, type: q.type, label: q.label, help_text: q.help_text ?? '',
          required: !!q.required,
          options: (q.options ?? []).map(o => ({ id: uid(), label: o.label, price: o.price ?? 0, perGuest: !!o.perGuest })),
          pricing: q.pricing ?? {}, sort_order: qi,
        })),
      }
    }))
    flash('ok', 'Vorlage geladen — noch nicht gespeichert.')
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/vendor/questionnaire', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, sections }),
    })
    setSaving(false)
    if (res.ok) { flash('ok', 'Fragebogen gespeichert.'); load() }
    else { const d = await res.json().catch(() => ({})); flash('err', d.error ?? 'Speichern fehlgeschlagen') }
  }

  if (loading) {
    return <div style={{ minHeight: embedded ? 120 : '100dvh', background: embedded ? 'transparent' : C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="bp-spin" /></div>
  }

  const content = (
    <>
        {!embedded && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text, display: 'flex', alignItems: 'center', gap: 9 }}>
                <FileText size={20} style={{ color: C.gold }} /> Anfrage-Formular
              </h1>
              <p style={{ fontSize: 13, color: C.dim, marginTop: 6, maxWidth: 560, lineHeight: 1.5 }}>
                Lege fest, welche Fragen Brautpaare bei einer Anfrage beantworten. Aus den Antworten erstellt Forevr automatisch einen Angebotsentwurf, den du vor dem Freigeben prüfst.
              </p>
            </div>
          </div>
        )}

        {/* Aktionen */}
        <div data-tour="vdr-fragebogen-actions" style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={save} disabled={saving} style={btnGold}>
            {saving ? <Loader2 size={15} className="bp-spin" /> : <Save size={15} />} Speichern
          </button>
          <button
            onClick={() => setSetting('is_active', !settings.is_active)}
            title={settings.is_active ? 'Formular deaktivieren' : 'Formular aktivieren'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px',
              borderRadius: 8, border: `1px solid ${settings.is_active ? '#16a34a' : C.border}`,
              background: settings.is_active ? 'rgba(22,163,74,0.08)' : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              color: settings.is_active ? '#16a34a' : C.dim,
            }}
          >
            {settings.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
            {settings.is_active ? 'Aktiv' : 'Inaktiv'}
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <LayoutTemplate size={15} style={{ color: C.dim }} />
            <select style={{ ...inp, width: 'auto', padding: '7px 10px' }} defaultValue="" onChange={e => { if (e.target.value) { applyTemplate(e.target.value); e.target.value = '' } }}>
              <option value="">Vorlage laden…</option>
              <option value={category}>Meine Kategorie</option>
              {MARKETPLACE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          {msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.kind === 'ok' ? '#15803D' : C.red, width: '100%' }}>{msg.text}</span>}
        </div>

        {/* Warnung: Formular inaktiv */}
        {!settings.is_active && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', marginBottom: 16, borderRadius: 12, background: 'rgba(202,138,4,0.07)', border: '1px solid rgba(202,138,4,0.28)' }}>
            <AlertTriangle size={18} style={{ color: '#b45309', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#92400e' }}>Formular ist inaktiv</p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#78350f', lineHeight: 1.5 }}>
                Brautpaare können aktuell keine Anfragen stellen. Klicke auf „Aktivieren&rdquo; und speichere, damit Anfragen möglich sind.
              </p>
            </div>
            <button
              onClick={() => setSetting('is_active', true)}
              style={{ ...btn, background: '#b45309', color: '#fff', flexShrink: 0, fontSize: 12.5, padding: '7px 12px' }}
            >
              Aktivieren
            </button>
          </div>
        )}

        {/* Kopf des Fragebogens */}
        <div data-tour="vdr-fragebogen-allgemein" style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Allgemein</h2>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Titel</label>
            <input style={inp} value={settings.title} onChange={e => setSetting('title', e.target.value)} placeholder="Angebotsanfrage" />
          </div>
          <div>
            <label style={lbl}>Einleitungstext (optional)</label>
            <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={settings.intro_text} onChange={e => setSetting('intro_text', e.target.value)} placeholder="Kurze Begrüßung für das Brautpaar…" />
          </div>
        </div>

        {/* Abschnitte */}
        <div data-tour="vdr-fragebogen-sections">
        {sections.map((sec, si) => (
          <div key={sec.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <GripVertical size={16} style={{ color: C.dim }} />
              <input style={{ ...inp, fontWeight: 700, fontSize: 14.5 }} value={sec.title} onChange={e => updateSection(sec.id, { title: e.target.value })} placeholder={`Abschnitt ${si + 1}`} />
              <button style={iconBtn} onClick={() => moveSection(si, -1)} title="Nach oben"><ArrowUp size={16} /></button>
              <button style={iconBtn} onClick={() => moveSection(si, 1)} title="Nach unten"><ArrowDown size={16} /></button>
              <button style={{ ...iconBtn, color: C.red }} onClick={() => removeSection(sec.id)} title="Abschnitt löschen"><Trash2 size={16} /></button>
            </div>
            <input style={{ ...inp, marginBottom: 14, fontSize: 12.5, color: C.dim }} value={sec.description} onChange={e => updateSection(sec.id, { description: e.target.value })} placeholder="Beschreibung (optional)" />

            {sec.questions.map((q, qi) => (
              <QuestionEditor
                key={q.id} q={q} index={qi} total={sec.questions.length}
                onChange={patch => updateQuestion(sec.id, q.id, patch)}
                onRemove={() => removeQuestion(sec.id, q.id)}
                onMove={dir => moveQuestion(sec.id, qi, dir)}
              />
            ))}
            <button onClick={() => addQuestion(sec.id)} style={{ ...btnGhost, marginTop: 6 }}><Plus size={15} /> Frage hinzufügen</button>
          </div>
        ))}

        <button onClick={addSection} style={{ ...btnGhost, marginBottom: 20 }}><Plus size={15} /> Abschnitt hinzufügen</button>
        </div>

        {/* Preislogik */}
        <div data-tour="vdr-fragebogen-pricing" style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>Preislogik</h2>
          <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 16px', lineHeight: 1.5 }}>
            Diese Werte bilden den automatischen Angebotsentwurf. Du prüfst und passt jedes Angebot vor dem Freigeben an — die Automatik ist nur ein Startpunkt.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <NumField label="Grundpreis (€)" value={settings.base_price} onChange={v => setSetting('base_price', v)} />
            <NumField label="Preis pro Gast (€)" value={settings.per_guest_price} onChange={v => setSetting('per_guest_price', v)} hint="× bestätigte Gästezahl (entfällt, wenn Staffeln gesetzt sind)" />
            <NumField label="Mindestbestellwert (€)" value={settings.min_total} onChange={v => setSetting('min_total', v)} hint="wird ggf. aufgefüllt" />
            <NumField label="Wochenend-Aufschlag (%)" value={settings.weekend_surcharge_pct} onChange={v => setSetting('weekend_surcharge_pct', v)} hint="bei Sa/So" />
          </div>

          {/* Mengenstaffeln auf die Gästezahl */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <label style={{ ...lbl, marginBottom: 3 }}>Mengenstaffeln (Pro-Gast-Preis)</label>
            <p style={{ fontSize: 11.5, color: C.dim, margin: '0 0 10px', lineHeight: 1.5 }}>
              Optional: Pro-Gast-Preis je nach Gästezahl. Greift die passende Stufe, ersetzt sie den festen Pro-Gast-Preis oben.
            </p>
            <TiersEditor tiers={settings.guest_tiers} unitWord="Gäste" onChange={t => setSetting('guest_tiers', t)} />
          </div>
        </div>

        {/* Saison- / Datumsaufschläge */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>Saison- &amp; Datumsaufschläge</h2>
          <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 14px', lineHeight: 1.5 }}>
            Auf- oder Abschläge für bestimmte Zeiträume (z. B. Hochsaison, Feiertage). Gilt zusätzlich zum Wochenend-Aufschlag. Datum als <code>JJJJ-MM-TT</code> (festes Datum) oder <code>MM-TT</code> (jährlich wiederkehrend).
          </p>
          <SeasonEditor rules={settings.season_rules} onChange={r => setSetting('season_rules', r)} />
        </div>

        {/* Anfahrt / Reisekosten */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>Anfahrt &amp; Reisekosten</h2>
          <p style={{ fontSize: 12.5, color: C.dim, margin: '0 0 14px', lineHeight: 1.5 }}>
            PLZ-Zonen werden automatisch als (abwählbare) Angebotsposition gesetzt, sobald die PLZ des Veranstaltungsorts passt. Der km-Satz dient dir als Richtwert zum manuellen Eintragen im Angebot.
          </p>
          <TravelEditor settings={settings} setSetting={setSetting} />
        </div>

        {/* Steuer & Konditionen */}
        <div data-tour="vdr-fragebogen-tax" style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Steuer & Konditionen</h2>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Umsatzsteuer</label>
            <select style={inp} value={settings.tax_mode} onChange={e => setSetting('tax_mode', e.target.value as TaxMode)}>
              {(Object.keys(TAX_MODE_LABELS) as TaxMode[]).map(m => <option key={m} value={m}>{TAX_MODE_LABELS[m]}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {settings.tax_mode === 'regular' && <NumField label="USt.-Satz (%)" value={settings.tax_rate} onChange={v => setSetting('tax_rate', v)} />}
            <div>
              <label style={lbl}>Währung</label>
              <input style={inp} value={settings.currency} onChange={e => setSetting('currency', e.target.value)} />
            </div>
            <NumField label="Gültigkeit (Tage)" value={settings.valid_days} onChange={v => setSetting('valid_days', v)} />
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={lbl}>Fußnote auf dem Angebot</label>
            <input style={inp} value={settings.footer_note} onChange={e => setSetting('footer_note', e.target.value)} />
          </div>
        </div>
    </>
  )

  if (embedded) return content

  return (
    <div className="vnd-page-outer" style={{ minHeight: '100dvh', background: C.bg, padding: '28px 24px 80px' }}>
      <div>
        {content}
      </div>
    </div>
  )
}

function NumField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input style={inp} type="number" value={Number.isFinite(value) ? value : 0}
        onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} />
      {hint && <p style={{ fontSize: 10.5, color: C.dim, margin: '4px 0 0' }}>{hint}</p>}
    </div>
  )
}

function QuestionEditor({ q, index, total, onChange, onRemove, onMove }: {
  q: QQuestion; index: number; total: number
  onChange: (patch: Partial<QQuestion>) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void
}) {
  const hasOptions = q.type === 'single' || q.type === 'multi'
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 10, background: C.bg }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input style={{ ...inp, fontWeight: 600 }} value={q.label} onChange={e => onChange({ label: e.target.value })} placeholder="Fragetext" />
        <select style={{ ...inp, width: 150 }} value={q.type} onChange={e => {
          const type = e.target.value as QuestionType
          const willHaveOptions = type === 'single' || type === 'multi'
          onChange({ type, options: willHaveOptions && q.options.length === 0 ? [{ id: uid(), label: '', price: 0 }] : q.options, pricing: {} })
        }}>
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(t => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
        </select>
        <button style={iconBtn} onClick={() => onMove(-1)} disabled={index === 0} title="Nach oben"><ArrowUp size={15} /></button>
        <button style={iconBtn} onClick={() => onMove(1)} disabled={index === total - 1} title="Nach unten"><ArrowDown size={15} /></button>
        <button style={{ ...iconBtn, color: C.red }} onClick={onRemove} title="Frage löschen"><Trash2 size={15} /></button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '10px 0 0' }}>
        <input style={{ ...inp, fontSize: 12, flex: 1 }} value={q.help_text} onChange={e => onChange({ help_text: e.target.value })} placeholder="Hilfetext (optional)" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.dim, whiteSpace: 'nowrap' }}>
          <ToggleSwitch checked={q.required} onChange={v => onChange({ required: v })} size="sm" aria-label="Pflichtfrage" /> Pflicht
        </span>
      </div>

      {/* Optionen mit Preis */}
      {hasOptions && (
        <div style={{ marginTop: 12, paddingLeft: 6, borderLeft: `2px solid ${C.border}` }}>
          {q.options.map((o, oi) => (
            <div key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input style={{ ...inp, fontSize: 12.5 }} value={o.label} onChange={e => {
                const opts = [...q.options]; opts[oi] = { ...o, label: e.target.value }; onChange({ options: opts })
              }} placeholder={`Option ${oi + 1}`} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 120, flexShrink: 0 }}>
                <input style={{ ...inp, fontSize: 12.5, textAlign: 'right' }} type="number" value={o.price ?? 0} onChange={e => {
                  const opts = [...q.options]; opts[oi] = { ...o, price: e.target.value === '' ? 0 : parseFloat(e.target.value) }; onChange({ options: opts })
                }} /><span style={{ fontSize: 12, color: C.dim }}>€</span>
              </div>
              <span title="Preis gilt pro Gast" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: C.dim, whiteSpace: 'nowrap', flexShrink: 0 }}>
                <ToggleSwitch checked={!!o.perGuest} size="sm" aria-label="Preis pro Gast" onChange={v => {
                  const opts = [...q.options]; opts[oi] = { ...o, perGuest: v }; onChange({ options: opts })
                }} />/Gast
              </span>
              <button style={{ ...iconBtn, color: C.red }} onClick={() => onChange({ options: q.options.filter(x => x.id !== o.id) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <button style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }} onClick={() => onChange({ options: [...q.options, { id: uid(), label: '', price: 0 }] })}>
            <Plus size={13} /> Option
          </button>
        </div>
      )}

      {/* Preislogik je nach Typ */}
      {q.type === 'number' && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: C.dim }}>Preis pro Einheit:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 120 }}>
            <input style={{ ...inp, fontSize: 12.5, textAlign: 'right' }} type="number" value={q.pricing.unitPrice ?? 0}
              onChange={e => onChange({ pricing: { ...q.pricing, mode: 'per_unit', unitPrice: e.target.value === '' ? 0 : parseFloat(e.target.value) } })} />
            <span style={{ fontSize: 12, color: C.dim }}>€</span>
          </div>
          <input style={{ ...inp, fontSize: 12.5, width: 130 }} value={q.pricing.unitLabel ?? ''} placeholder="Einheit (z. B. Std.)"
            onChange={e => onChange({ pricing: { ...q.pricing, unitLabel: e.target.value } })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11.5, color: C.dim }}>min</span>
            <input style={{ ...inp, fontSize: 12, textAlign: 'right', width: 56 }} type="number" value={q.pricing.min ?? ''}
              onChange={e => onChange({ pricing: { ...q.pricing, min: e.target.value === '' ? undefined : parseFloat(e.target.value) } })} />
            <span style={{ fontSize: 11.5, color: C.dim }}>max</span>
            <input style={{ ...inp, fontSize: 12, textAlign: 'right', width: 56 }} type="number" value={q.pricing.max ?? ''}
              onChange={e => onChange({ pricing: { ...q.pricing, max: e.target.value === '' ? undefined : parseFloat(e.target.value) } })} />
            <span style={{ fontSize: 11.5, color: C.dim }}>Schritt</span>
            <input style={{ ...inp, fontSize: 12, textAlign: 'right', width: 56 }} type="number" value={q.pricing.step ?? ''}
              onChange={e => onChange({ pricing: { ...q.pricing, step: e.target.value === '' ? undefined : parseFloat(e.target.value) } })} />
          </div>
          <OptionalToggle q={q} onChange={onChange} />
          <div style={{ width: '100%' }}>
            <p style={{ fontSize: 11, color: C.dim, margin: '4px 0 6px' }}>Mengenstaffeln (optional — ersetzen den Einheitspreis in der passenden Stufe):</p>
            <TiersEditor tiers={q.pricing.tiers ?? []} unitWord="Einheiten" onChange={t => onChange({ pricing: { ...q.pricing, mode: 'per_unit', tiers: t } })} />
          </div>
        </div>
      )}
      {q.type === 'boolean' && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: C.dim }}>Aufschlag bei {'„Ja"'}:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 120 }}>
            <input style={{ ...inp, fontSize: 12.5, textAlign: 'right' }} type="number" value={q.pricing.price ?? 0}
              onChange={e => onChange({ pricing: { ...q.pricing, mode: 'fixed', price: e.target.value === '' ? 0 : parseFloat(e.target.value) } })} />
            <span style={{ fontSize: 12, color: C.dim }}>€</span>
          </div>
          <span title="Aufschlag gilt pro Gast" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.dim }}>
            <ToggleSwitch checked={!!q.pricing.perGuest} size="sm" aria-label="Aufschlag pro Gast" onChange={v => onChange({ pricing: { ...q.pricing, perGuest: v } })} /> pro Gast
          </span>
          <OptionalToggle q={q} onChange={onChange} />
        </div>
      )}
      {hasOptions && (
        <div style={{ marginTop: 10 }}><OptionalToggle q={q} onChange={onChange} /></div>
      )}
    </div>
  )
}

// ── Mengenstaffeln (geteilt: Pro-Gast + Pro-Frage) ───────────────────────────
function TiersEditor({ tiers, unitWord, onChange }: { tiers: PriceTier[]; unitWord: string; onChange: (t: PriceTier[]) => void }) {
  const numOrEmpty = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  function set(i: number, patch: Partial<PriceTier>) { onChange(tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t)) }
  function add() { onChange([...tiers, { min: tiers.length ? ((tiers[tiers.length - 1].max ?? 0) + 1) : 0, max: null, unitPrice: 0 }]) }
  return (
    <div>
      {tiers.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: C.dim }}>ab</span>
          <input style={{ ...inp, fontSize: 12.5, textAlign: 'right', width: 70 }} type="number" value={numOrEmpty(t.min)}
            onChange={e => set(i, { min: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
          <span style={{ fontSize: 11.5, color: C.dim }}>bis</span>
          <input style={{ ...inp, fontSize: 12.5, textAlign: 'right', width: 70 }} type="number" placeholder="∞" value={numOrEmpty(t.max)}
            onChange={e => set(i, { max: e.target.value === '' ? null : parseFloat(e.target.value) })} />
          <span style={{ fontSize: 11.5, color: C.dim }}>{unitWord} →</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 110 }}>
            <input style={{ ...inp, fontSize: 12.5, textAlign: 'right' }} type="number" value={numOrEmpty(t.unitPrice)}
              onChange={e => set(i, { unitPrice: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
            <span style={{ fontSize: 12, color: C.dim }}>€/Einh.</span>
          </div>
          <button style={{ ...iconBtn, color: C.red }} onClick={() => onChange(tiers.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <button style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }} onClick={add}><Plus size={13} /> Stufe</button>
    </div>
  )
}

// ── Saison-/Datumsregeln ─────────────────────────────────────────────────────
function SeasonEditor({ rules, onChange }: { rules: SeasonRule[]; onChange: (r: SeasonRule[]) => void }) {
  function set(i: number, patch: Partial<SeasonRule>) { onChange(rules.map((r, idx) => idx === i ? { ...r, ...patch } : r)) }
  function add() { onChange([...rules, { id: uid(), label: '', from: '', to: '', mode: 'percent', value: 0 }]) }
  return (
    <div>
      {rules.map((r, i) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <input style={{ ...inp, fontSize: 12.5, flex: '1 1 140px', minWidth: 120 }} value={r.label} placeholder="Bezeichnung (z. B. Hochsaison)" onChange={e => set(i, { label: e.target.value })} />
          <input style={{ ...inp, fontSize: 12.5, width: 120 }} value={r.from} placeholder="von" onChange={e => set(i, { from: e.target.value.trim() })} />
          <input style={{ ...inp, fontSize: 12.5, width: 120 }} value={r.to} placeholder="bis" onChange={e => set(i, { to: e.target.value.trim() })} />
          <select style={{ ...inp, fontSize: 12.5, width: 110 }} value={r.mode} onChange={e => set(i, { mode: e.target.value as 'percent' | 'flat' })}>
            <option value="percent">Prozent</option>
            <option value="flat">Pauschale</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 100 }}>
            <input style={{ ...inp, fontSize: 12.5, textAlign: 'right' }} type="number" value={Number.isFinite(r.value) ? r.value : 0} onChange={e => set(i, { value: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
            <span style={{ fontSize: 12, color: C.dim }}>{r.mode === 'percent' ? '%' : '€'}</span>
          </div>
          <button style={{ ...iconBtn, color: C.red }} onClick={() => onChange(rules.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <button style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }} onClick={add}><Plus size={13} /> Regel</button>
    </div>
  )
}

// ── Anfahrt / Reisekosten ────────────────────────────────────────────────────
function TravelEditor({ settings, setSetting }: {
  settings: QuestionnaireSettings
  setSetting: <K extends keyof QuestionnaireSettings>(k: K, v: QuestionnaireSettings[K]) => void
}) {
  const zones = settings.travel_zones
  function setZone(i: number, patch: Partial<TravelZone>) { setSetting('travel_zones', zones.map((z, idx) => idx === i ? { ...z, ...patch } : z)) }
  const showZones = settings.travel_mode === 'zones' || settings.travel_mode === 'both'
  const showKm = settings.travel_mode === 'km' || settings.travel_mode === 'both'
  return (
    <div>
      <div style={{ marginBottom: 14, maxWidth: 280 }}>
        <label style={lbl}>Modus</label>
        <select style={inp} value={settings.travel_mode} onChange={e => setSetting('travel_mode', e.target.value as TravelMode)}>
          <option value="none">Keine Anfahrtskosten</option>
          <option value="zones">PLZ-Zonen</option>
          <option value="km">km-Pauschale</option>
          <option value="both">PLZ-Zonen + km</option>
        </select>
      </div>

      {showKm && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: showZones ? 16 : 0 }}>
          <NumField label="Preis pro km (€)" value={settings.travel_km_price} onChange={v => setSetting('travel_km_price', v)} />
          <NumField label="Frei-Radius (km)" value={settings.travel_free_radius_km} onChange={v => setSetting('travel_free_radius_km', v)} hint="bis hier kostenlos" />
          <div>
            <label style={lbl}>Start-PLZ (Firmensitz)</label>
            <input style={inp} value={settings.travel_base_postal_code} onChange={e => setSetting('travel_base_postal_code', e.target.value)} placeholder="z. B. 10115" />
          </div>
        </div>
      )}

      {showZones && (
        <div>
          <label style={{ ...lbl, marginBottom: 8 }}>PLZ-Zonen</label>
          {zones.map((z, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <input style={{ ...inp, fontSize: 12.5, width: 110 }} value={z.plzPrefix} placeholder="PLZ-Präfix (z. B. 10)" onChange={e => setZone(i, { plzPrefix: e.target.value })} />
              <input style={{ ...inp, fontSize: 12.5, flex: '1 1 140px' }} value={z.label} placeholder="Bezeichnung (z. B. Berlin)" onChange={e => setZone(i, { label: e.target.value })} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 110 }}>
                <input style={{ ...inp, fontSize: 12.5, textAlign: 'right' }} type="number" value={Number.isFinite(z.price) ? z.price : 0} onChange={e => setZone(i, { price: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                <span style={{ fontSize: 12, color: C.dim }}>€</span>
              </div>
              <button style={{ ...iconBtn, color: C.red }} onClick={() => setSetting('travel_zones', zones.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
          <button style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }} onClick={() => setSetting('travel_zones', [...zones, { plzPrefix: '', label: '', price: 0 }])}><Plus size={13} /> Zone</button>
        </div>
      )}
    </div>
  )
}

// Schalter: erzeugte Angebotsposition optional (Brautpaar kann ab-/zuwaehlen).
function OptionalToggle({ q, onChange }: { q: QQuestion; onChange: (patch: Partial<QQuestion>) => void }) {
  return (
    <span title="Position im Angebot ist optional — das Brautpaar kann sie ab- oder zuwählen" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.dim }}>
      <ToggleSwitch checked={!!q.pricing.optional} size="sm" aria-label="Optionale Position" onChange={v => onChange({ pricing: { ...q.pricing, optional: v } })} /> optional
    </span>
  )
}
