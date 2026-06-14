'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Trash2, X, GlassWater, Wine, Calculator, Users, RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Kategorie {
  id: string
  event_id: string
  name: string
  color: string
  sort_order: number
  is_alcoholic: boolean
}

interface Artikel {
  id: string
  event_id: string
  kategorie_id: string | null
  name: string
  unit: string
  amount_per_person: number
  total_planned: number
  price_per_unit: number
  kalkulationspreis: number
  notes: string
  sort_order: number
  // Alkohol pro Getränk: null = erbt Kategorie-Default (Vorbelegung)
  is_alcoholic: boolean | null
}

interface Ingredient {
  name: string
  amount: string
  unit: string
}

interface Cocktail {
  id: string
  event_id: string
  name: string
  description: string
  is_alcoholic: boolean
  planned_count: number
  price_per_unit: number
  kalkulationspreis: number
  ingredients: Ingredient[]
  sort_order: number
}

type Mode = 'veranstalter' | 'brautpaar' | 'dienstleister'

interface Props {
  eventId: string
  mode: Mode
  guestCount?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_KATEGORIEN = [
  { name: 'Bier',            color: '#E8A020', is_alcoholic: true  },
  { name: 'Wein',            color: '#8B2252', is_alcoholic: true  },
  { name: 'Sekt / Prosecco', color: '#C9A84C', is_alcoholic: true  },
  { name: 'Spirituosen',     color: '#5C4033', is_alcoholic: true  },
  { name: 'Softdrinks',      color: '#2A9D8F', is_alcoholic: false },
  { name: 'Wasser',          color: '#457B9D', is_alcoholic: false },
]

const UNITS = ['Flasche', 'Liter', 'Dose', 'Glas', 'Krug', 'Kasten', 'Stück']

const CATEGORY_COLORS = [
  '#E8A020', '#8B2252', '#C9A84C', '#5C4033', '#2A9D8F', '#457B9D',
  '#B8943E', '#E76F51', '#264653', '#6A4C93', '#1982C4', '#8AC926',
]

const TABS = [
  { key: 'planung'   as const, label: 'Mengenplanung' },
  { key: 'cocktails' as const, label: 'Cocktails' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// Accepts both German comma and dot as decimal separator → number (0 on empty/invalid).
// Both "1,20" and "1.20" yield 1.2; the dot is never treated as a thousands separator.
function parseDecimal(s: string): number {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}

// Decimal text input that tolerates both "," and "." regardless of browser locale.
// Holds a string buffer while focused so typing "1,20" is never clobbered by the
// parsed numeric value; displays the value with a German comma.
function DecimalInput({
  value, onChange, placeholder, style,
}: { value: number; onChange: (n: number) => void; placeholder?: string; style?: React.CSSProperties }) {
  const display = (v: number) => (v ? String(v).replace('.', ',') : '')
  const [text, setText] = useState(() => display(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(display(value))
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onFocus={() => { focused.current = true }}
      onBlur={() => { focused.current = false; setText(display(value)) }}
      onChange={e => {
        const t = e.target.value.replace(/[^0-9.,]/g, '')
        setText(t)
        onChange(parseDecimal(t))
      }}
      style={style}
    />
  )
}

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

function FieldInput({
  value, onChange, placeholder, type = 'text', inputMode,
}: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      inputMode={inputMode}
      style={{
        width: '100%', height: 40, padding: '0 10px',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
        outline: 'none', background: '#fff', boxSizing: 'border-box',
      }}
    />
  )
}

// Small label-over-field wrapper for inline add forms
function AddField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

// ── Info block sub-component ──────────────────────────────────────────────────

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg, #f5f5f7)', borderRadius: 7, padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

// ── Artikel card ──────────────────────────────────────────────────────────────

function ArtikelCard({
  artikel, canEdit, isVera, effectiveGuestCount, katAlcoholic, onChange, onDelete,
}: {
  artikel: Artikel; canEdit: boolean; isVera: boolean; effectiveGuestCount: number
  katAlcoholic: boolean
  onChange: (a: Artikel) => void; onDelete: () => void
}) {
  const [draft, setDraft]  = useState(artikel)
  const debouncedDraft     = useDebounce(draft, 600)
  const savedRef           = useRef(artikel)

  useEffect(() => {
    if (JSON.stringify(debouncedDraft) === JSON.stringify(savedRef.current)) return
    savedRef.current = debouncedDraft
    createClient().from('getraenke_artikel').update({
      name:              debouncedDraft.name,
      unit:              debouncedDraft.unit,
      amount_per_person: debouncedDraft.amount_per_person,
      total_planned:     debouncedDraft.total_planned,
      price_per_unit:    debouncedDraft.price_per_unit,
      kalkulationspreis: debouncedDraft.kalkulationspreis,
      notes:             debouncedDraft.notes,
      is_alcoholic:      debouncedDraft.is_alcoholic,
    }).eq('id', artikel.id).then(({ error }) => {
      if (!error) onChange(debouncedDraft)
    })
  }, [debouncedDraft]) // eslint-disable-line react-hooks/exhaustive-deps

  function setField<K extends keyof Artikel>(key: K, val: Artikel[K]) {
    setDraft(p => {
      const next = { ...p, [key]: val }
      if (key === 'amount_per_person' && effectiveGuestCount > 0) {
        const perP = typeof val === 'number' ? val : parseFloat(val as string) || 0
        next.total_planned = perP > 0 ? Math.ceil(perP * effectiveGuestCount) : 0
      }
      if (key === 'total_planned') {
        // Direct edit of total_planned: keep amount_per_person unchanged
      }
      return next
    })
  }

  useEffect(() => {
    if (draft.amount_per_person > 0 && effectiveGuestCount > 0) {
      const computed = Math.ceil(draft.amount_per_person * effectiveGuestCount)
      if (computed !== draft.total_planned) {
        setDraft(p => ({ ...p, total_planned: computed }))
      }
    }
  }, [effectiveGuestCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const bpLineTotal   = draft.total_planned * draft.price_per_unit
  const kalkLineTotal = draft.total_planned * draft.kalkulationspreis

  // ── Berechnung sichtbar machen ───────────────────────────────────────────
  const hasCalc      = draft.amount_per_person > 0 && effectiveGuestCount > 0
  const computedTotal = hasCalc ? Math.ceil(draft.amount_per_person * effectiveGuestCount) : 0
  const isManual      = hasCalc && draft.total_planned !== computedTotal
  const isAutoTotal   = hasCalc && draft.total_planned === computedTotal
  const totalStyleColor = isAutoTotal ? 'var(--text-tertiary, #999)' : 'var(--text-primary, #1a1a1a)'

  function resetTotal() {
    setField('total_planned', computedTotal)
  }

  // Hint line shown under the "Pro Person" input
  const perPersonHint = hasCalc ? (
    <div style={{ fontSize: 10, color: 'var(--text-tertiary, #bbb)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {fmt(draft.amount_per_person, draft.amount_per_person % 1 === 0 ? 0 : 2)} × {effectiveGuestCount} Gäste = {computedTotal} {draft.unit}
    </div>
  ) : null

  // Alkohol-Kennzeichen pro Getränk: null = erbt Kategorie-Vorbelegung
  const effectiveAlcoholic = draft.is_alcoholic ?? katAlcoholic
  function toggleAlcoholic() {
    setField('is_alcoholic', !effectiveAlcoholic)
  }

  // Manual badge + reset button shown under the "Gesamt" input
  const manualBadge = (canEdit && isManual) ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary, #bbb)' }}>manuell angepasst</span>
      <button onClick={resetTotal} title={`Auf berechneten Wert (${computedTotal}) zurücksetzen`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.6 }}>
        <RotateCcw size={11} style={{ color: 'var(--text-tertiary, #999)' }} />
      </button>
    </div>
  ) : null

  return (
    <div style={{
      background: 'var(--surface, #fff)',
      border: '1px solid var(--border, #e8e8e8)',
      borderRadius: 10, padding: '12px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {canEdit ? (
          <input
            value={draft.name}
            onChange={e => setField('name', e.target.value)}
            style={{
              flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: '#1a1a1a',
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'inherit', padding: 0,
            }}
            placeholder="Bezeichnung"
          />
        ) : (
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{draft.name}</span>
        )}
        {/* Alkohol-Kennzeichen pro Getränk (Klick wechselt; Vorbelegung kommt aus der Kategorie) */}
        {canEdit ? (
          <button
            onClick={toggleAlcoholic}
            title={effectiveAlcoholic ? 'Alkoholisch — klicken für alkoholfrei' : 'Alkoholfrei — klicken für alkoholisch'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
              padding: '2px 8px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 10, fontWeight: 600,
              border: `1px solid ${effectiveAlcoholic ? '#D4A8B4' : '#A8D4C4'}`,
              background: effectiveAlcoholic ? '#FBF3F5' : '#F2FAF6',
              color: effectiveAlcoholic ? '#8B2252' : '#1F7A5C',
            }}
          >
            {effectiveAlcoholic ? <Wine size={10} /> : <GlassWater size={10} />}
            {effectiveAlcoholic ? 'Alkohol' : 'Alkoholfrei'}
          </button>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, fontSize: 10, fontWeight: 600, color: effectiveAlcoholic ? '#8B2252' : '#1F7A5C' }}>
            {effectiveAlcoholic ? <Wine size={10} /> : <GlassWater size={10} />}
            {effectiveAlcoholic ? 'Alkohol' : 'Alkoholfrei'}
          </span>
        )}
        {canEdit && (
          <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Trash2 size={12} style={{ color: '#e05252' }} />
          </button>
        )}
      </div>

      {/* Info blocks */}
      {isVera ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {/* Gesamt (editable) */}
          <InfoBlock label="Gesamt">
            {canEdit ? (
              <input
                type="number"
                value={draft.total_planned || ''}
                onChange={e => setField('total_planned', parseInt(e.target.value) || 0)}
                placeholder="0"
                style={{ width: '100%', fontSize: 17, fontWeight: 700, color: totalStyleColor, border: 'none', background: 'transparent', padding: 0, outline: 'none', fontFamily: 'inherit' }}
              />
            ) : (
              <div style={{ fontSize: 17, fontWeight: 700, color: totalStyleColor }}>{draft.total_planned || <span style={{ color: '#ccc' }}>—</span>}</div>
            )}
            {canEdit ? (
              <select value={draft.unit} onChange={e => setField('unit', e.target.value)} style={{ fontSize: 11, color: 'var(--text-secondary, #888)', border: 'none', background: 'transparent', padding: 0, marginTop: 3, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%' }}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)', marginTop: 3 }}>{draft.unit}</div>
            )}
            {manualBadge}
          </InfoBlock>

          {/* Pro Person */}
          <InfoBlock label="Pro Person">
            {canEdit ? (
              <DecimalInput value={draft.amount_per_person} onChange={n => setField('amount_per_person', n)} placeholder="0"
                style={{ width: '100%', fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #1a1a1a)', border: 'none', background: 'transparent', padding: 0, outline: 'none', fontFamily: 'inherit' }} />
            ) : (
              <div style={{ fontSize: 17, fontWeight: 700 }}>{draft.amount_per_person || '—'}</div>
            )}
            {perPersonHint}
          </InfoBlock>

          {/* Preis BP */}
          <InfoBlock label="Preis BP">
            {canEdit ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <DecimalInput value={draft.price_per_unit} onChange={n => setField('price_per_unit', n)} placeholder="0"
                  style={{ width: '100%', minWidth: 0, fontSize: 15, fontWeight: 700, border: 'none', background: 'transparent', padding: 0, outline: 'none', fontFamily: 'inherit' }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary, #aaa)', flexShrink: 0 }}>€</span>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(draft.price_per_unit)} €</div>
            )}
            {bpLineTotal > 0 && <div style={{ fontSize: 10, color: 'var(--text-tertiary, #bbb)', marginTop: 3 }}>= {fmt(bpLineTotal)} €</div>}
          </InfoBlock>

          {/* Kalkulation */}
          <InfoBlock label="Kalkulation">
            {canEdit ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <DecimalInput value={draft.kalkulationspreis} onChange={n => setField('kalkulationspreis', n)} placeholder="0"
                  style={{ width: '100%', minWidth: 0, fontSize: 15, fontWeight: 700, border: 'none', background: 'transparent', padding: 0, outline: 'none', fontFamily: 'inherit' }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary, #aaa)', flexShrink: 0 }}>€</span>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(draft.kalkulationspreis)} €</div>
            )}
            {kalkLineTotal > 0 && <div style={{ fontSize: 10, color: 'var(--text-tertiary, #bbb)', marginTop: 3 }}>= {fmt(kalkLineTotal)} €</div>}
          </InfoBlock>
        </div>
      ) : (
        /* 3-block row for brautpaar / dienstleister */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr) minmax(0,1fr)', gap: 6 }}>
          <InfoBlock label="Gesamt">
            {canEdit ? (
              <input type="number" value={draft.total_planned || ''} onChange={e => setField('total_planned', parseInt(e.target.value) || 0)} placeholder="0"
                style={{ width: '100%', fontSize: 17, fontWeight: 700, color: totalStyleColor, border: 'none', background: 'transparent', padding: 0, outline: 'none', fontFamily: 'inherit' }} />
            ) : (
              <div style={{ fontSize: 17, fontWeight: 700, color: totalStyleColor }}>{draft.total_planned || <span style={{ color: '#ccc' }}>—</span>}</div>
            )}
            {canEdit ? (
              <select value={draft.unit} onChange={e => setField('unit', e.target.value)} style={{ fontSize: 11, color: 'var(--text-secondary, #888)', border: 'none', background: 'transparent', padding: 0, marginTop: 3, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%' }}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)', marginTop: 3 }}>{draft.unit}</div>
            )}
            {manualBadge}
          </InfoBlock>

          <InfoBlock label="Pro Person">
            {canEdit ? (
              <DecimalInput value={draft.amount_per_person} onChange={n => setField('amount_per_person', n)} placeholder="0"
                style={{ width: '100%', fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #1a1a1a)', border: 'none', background: 'transparent', padding: 0, outline: 'none', fontFamily: 'inherit' }} />
            ) : (
              <div style={{ fontSize: 17, fontWeight: 700 }}>{draft.amount_per_person || '—'}</div>
            )}
            {perPersonHint}
          </InfoBlock>

          <InfoBlock label="Preis / Stk">
            {canEdit ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <DecimalInput value={draft.price_per_unit} onChange={n => setField('price_per_unit', n)} placeholder="0"
                  style={{ width: '100%', minWidth: 0, fontSize: 15, fontWeight: 700, border: 'none', background: 'transparent', padding: 0, outline: 'none', fontFamily: 'inherit' }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary, #aaa)', flexShrink: 0 }}>€</span>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(draft.price_per_unit)} €</div>
            )}
            {bpLineTotal > 0 && <div style={{ fontSize: 10, color: 'var(--text-tertiary, #bbb)', marginTop: 3 }}>= {fmt(bpLineTotal)} €</div>}
          </InfoBlock>
        </div>
      )}
    </div>
  )
}

// ── Kategorie section ─────────────────────────────────────────────────────────

function KategorieSection({
  kat, artikel, canEdit, isVera, effectiveGuestCount, grandTotal,
  onArtikelChange, onArtikelDelete, onArtikelAdd, onKatDelete, onKatAlcoholicToggle,
}: {
  kat: Kategorie
  artikel: Artikel[]
  canEdit: boolean
  isVera: boolean
  effectiveGuestCount: number
  grandTotal: number
  onArtikelChange: (a: Artikel) => void
  onArtikelDelete: (id: string) => void
  onArtikelAdd: (a: Artikel) => void
  onKatDelete: () => void
  onKatAlcoholicToggle: () => void
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName]         = useState('')
  const [addUnit, setAddUnit]         = useState('Flasche')
  const [addAmt, setAddAmt]           = useState('')
  const [addPrice, setAddPrice]       = useState('')
  const [addKalk, setAddKalk]         = useState('')
  const [saving, setSaving]           = useState(false)

  const bpTotal   = artikel.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
  const kalkTotal = artikel.reduce((s, a) => s + a.total_planned * a.kalkulationspreis, 0)
  const displayTotal = isVera ? kalkTotal : bpTotal
  const sharePct = grandTotal > 0 ? Math.min(100, (displayTotal / grandTotal) * 100) : 0

  async function addArtikel() {
    if (!addName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const perPerson = parseDecimal(addAmt)
    const total = perPerson > 0 && effectiveGuestCount > 0 ? Math.ceil(perPerson * effectiveGuestCount) : 0
    const { data, error } = await supabase.from('getraenke_artikel').insert({
      event_id:          kat.event_id,
      kategorie_id:      kat.id,
      name:              addName.trim(),
      unit:              addUnit,
      amount_per_person: perPerson,
      total_planned:     total,
      price_per_unit:    parseDecimal(addPrice),
      kalkulationspreis: parseDecimal(addKalk),
      sort_order:        artikel.length,
    }).select().single()
    setSaving(false)
    if (!error && data) {
      onArtikelAdd({ ...data, kalkulationspreis: data.kalkulationspreis ?? 0 } as Artikel)
      setAddName(''); setAddAmt(''); setAddPrice(''); setAddKalk(''); setAddUnit('Flasche')
      setShowAddForm(false)
    }
  }

  return (
    <div style={{
      background: 'var(--surface, #fff)',
      borderRadius: 12,
      border: '1px solid var(--border, #e8e8e8)',
      borderLeft: `4px solid ${kat.color}`,
      marginBottom: 16, overflow: 'hidden',
    }}>
      {/* Category header */}
      <div style={{
        padding: '13px 16px',
        borderBottom: artikel.length > 0 || canEdit ? '1px solid var(--border, #f0f0f0)' : undefined,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Clickable is_alcoholic icon */}
          {canEdit ? (
            <button
              onClick={onKatAlcoholicToggle}
              title={kat.is_alcoholic ? 'Vorbelegung: alkoholisch — gilt für neue Getränke, pro Getränk änderbar' : 'Vorbelegung: alkoholfrei — gilt für neue Getränke, pro Getränk änderbar'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              {kat.is_alcoholic
                ? <Wine size={15} style={{ color: kat.color }} />
                : <GlassWater size={15} style={{ color: kat.color }} />
              }
            </button>
          ) : (
            kat.is_alcoholic
              ? <Wine size={15} style={{ color: kat.color, flexShrink: 0 }} />
              : <GlassWater size={15} style={{ color: kat.color, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 15, fontWeight: 700, flex: 1, color: 'var(--text-primary, #1a1a1a)' }}>
            {kat.name}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            {displayTotal > 0 && (
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #1a1a1a)', lineHeight: 1.1 }}>
                {fmt(displayTotal)} €
              </span>
            )}
            {(artikel.length > 0 || displayTotal > 0) && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #aaa)' }}>
                {artikel.length} Artikel
              </span>
            )}
          </div>
          {canEdit && (
            <button onClick={e => { e.stopPropagation(); onKatDelete() }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, padding: '2px 4px', display: 'flex', alignItems: 'center' }} title="Kategorie löschen">
              <Trash2 size={13} style={{ color: '#e05252' }} />
            </button>
          )}
        </div>
        {/* Share-of-total bar */}
        {displayTotal > 0 && (
          <div style={{ height: 4, borderRadius: 999, background: 'var(--border, #eee)', overflow: 'hidden', marginTop: 9 }}>
            <div style={{ width: `${sharePct}%`, height: '100%', background: kat.color, borderRadius: 999, transition: 'width 0.2s' }} />
          </div>
        )}
      </div>

      {/* Article grid */}
      <div style={{ padding: '14px 16px' }}>
        {artikel.length === 0 && !canEdit && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary, #aaa)', textAlign: 'center', padding: '16px 0', margin: 0 }}>Keine Artikel</p>
        )}

        {artikel.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${isVera ? 280 : 260}px, 1fr))`,
            gap: 10, marginBottom: canEdit ? 10 : 0,
          }}>
            {artikel.map(a => (
              <ArtikelCard
                key={a.id} artikel={a} canEdit={canEdit} isVera={isVera}
                effectiveGuestCount={effectiveGuestCount}
                katAlcoholic={kat.is_alcoholic}
                onChange={onArtikelChange}
                onDelete={() => onArtikelDelete(a.id)}
              />
            ))}
          </div>
        )}

        {canEdit && (
          showAddForm ? (
            <div style={{ background: 'var(--bg, #f5f5f7)', borderRadius: 8, border: '1px dashed var(--border, #ddd)', padding: '12px 14px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', margin: '0 0 10px' }}>Neuer Artikel</p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 10, alignItems: 'end',
              }}>
                <AddField label="Name">
                  <FieldInput value={addName} onChange={setAddName} placeholder="Bezeichnung" />
                </AddField>
                <AddField label="Einheit">
                  <select value={addUnit} onChange={e => setAddUnit(e.target.value)} style={{ width: '100%', height: 40, padding: '0 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </AddField>
                <AddField label="Pro Person">
                  <FieldInput value={addAmt} onChange={setAddAmt} placeholder="0" inputMode="decimal" />
                </AddField>
                <AddField label={isVera ? 'Preis BP (€)' : 'Preis / Einheit (€)'}>
                  <FieldInput value={addPrice} onChange={setAddPrice} placeholder="0,00" inputMode="decimal" />
                </AddField>
                {isVera && (
                  <AddField label="Kalk-Preis (€)">
                    <FieldInput value={addKalk} onChange={setAddKalk} placeholder="0,00" inputMode="decimal" />
                  </AddField>
                )}
                <button onClick={addArtikel} disabled={saving || !addName.trim()} style={{ height: 40, padding: '0 16px', background: '#fff', color: addName.trim() ? 'var(--gold, #B89968)' : '#bbb', border: `1px solid ${addName.trim() ? 'var(--gold, #B89968)' : 'var(--border, #ddd)'}`, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: addName.trim() ? 'pointer' : 'default', fontFamily: 'inherit', opacity: saving ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                  {saving ? '…' : 'Hinzufügen'}
                </button>
              </div>
              <button onClick={() => { setShowAddForm(false); setAddName(''); setAddAmt(''); setAddPrice(''); setAddKalk('') }} style={{ marginTop: 10, padding: '6px 10px', background: 'none', border: '1px solid var(--border, #ddd)', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary, #666)' }}>
                Abbrechen
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '9px 12px', background: 'none', border: '1px dashed var(--border, #ddd)', borderRadius: 8, fontSize: 13, color: 'var(--text-tertiary, #aaa)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={14} /> Artikel hinzufügen
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── Cocktail card ─────────────────────────────────────────────────────────────

function CocktailCard({ cocktail, canEdit, isVera, onChange, onDelete }: {
  cocktail: Cocktail; canEdit: boolean; isVera: boolean; onChange: (c: Cocktail) => void; onDelete: () => void
}) {
  const [open, setOpen]       = useState(false)
  const [draft, setDraft]     = useState(cocktail)
  const [saving, setSaving]   = useState(false)
  const [newIngr, setNewIngr] = useState<Ingredient>({ name: '', amount: '', unit: 'ml' })

  async function save() {
    setSaving(true)
    const { error } = await createClient().from('getraenke_cocktails').update({
      name:              draft.name,
      description:       draft.description,
      is_alcoholic:      draft.is_alcoholic,
      planned_count:     draft.planned_count,
      price_per_unit:    draft.price_per_unit,
      kalkulationspreis: draft.kalkulationspreis,
      ingredients:       draft.ingredients,
    }).eq('id', cocktail.id)
    setSaving(false)
    if (!error) { onChange(draft); setOpen(false) }
  }

  function addIngr() {
    if (!newIngr.name.trim()) return
    setDraft(p => ({ ...p, ingredients: [...p.ingredients, { ...newIngr }] }))
    setNewIngr({ name: '', amount: '', unit: 'ml' })
  }

  const color        = cocktail.is_alcoholic ? '#8B2252' : '#2A9D8F'
  const bpTotal      = (cocktail.price_per_unit ?? 0) * cocktail.planned_count
  const kalkTotal    = (cocktail.kalkulationspreis ?? 0) * cocktail.planned_count
  const displayTotal = isVera ? kalkTotal : bpTotal
  const displayPrice = isVera ? (cocktail.kalkulationspreis ?? 0) : (cocktail.price_per_unit ?? 0)

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border, #e8e8e8)', overflow: 'hidden', background: 'var(--surface, #fff)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', cursor: canEdit ? 'pointer' : 'default', background: `${color}08` }}
        onClick={() => canEdit && setOpen(p => !p)}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{cocktail.name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #aaa)' }}>{cocktail.is_alcoholic ? 'mit Alkohol' : 'alkoholfrei'}</span>
        {displayTotal > 0 ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #666)' }}>
            {fmt(displayPrice)} € × {cocktail.planned_count} = {fmt(displayTotal)} €
          </span>
        ) : cocktail.planned_count > 0 ? (
          <span style={{ fontSize: 11, fontWeight: 700, color }}>{cocktail.planned_count}×</span>
        ) : null}
        {!canEdit && cocktail.ingredients.length > 0 && (
          <button onClick={e => { e.stopPropagation(); setOpen(p => !p) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 11, color: 'var(--text-tertiary, #aaa)' }}>
            {open ? '▲' : '▼'}
          </button>
        )}
        {canEdit && (
          <>
            <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={13} style={{ color: '#e05252' }} />
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary, #aaa)' }}>{open ? '▲' : '▼'}</span>
          </>
        )}
      </div>

      {open && (
        <div style={{ padding: '13px 14px', borderTop: `1px solid ${color}20` }}>
          {canEdit ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 5 }}>Name</label>
                  <FieldInput value={draft.name} onChange={v => setDraft(p => ({ ...p, name: v }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 5 }}>Geplante Menge</label>
                  <FieldInput value={draft.planned_count || ''} onChange={v => setDraft(p => ({ ...p, planned_count: parseInt(v) || 0 }))} type="number" placeholder="0" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isVera ? '1fr 1fr' : '1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 5 }}>
                    {isVera ? 'Preis BP (€)' : 'Preis pro Stück (€)'}
                  </label>
                  <DecimalInput value={draft.price_per_unit} onChange={n => setDraft(p => ({ ...p, price_per_unit: n }))} placeholder="0,00"
                    style={{ width: '100%', height: 40, padding: '0 10px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
                </div>
                {isVera && (
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 5 }}>Kalkulation (€)</label>
                    <DecimalInput value={draft.kalkulationspreis} onChange={n => setDraft(p => ({ ...p, kalkulationspreis: n }))} placeholder="0,00"
                      style={{ width: '100%', height: 40, padding: '0 10px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 5 }}>Beschreibung</label>
                <textarea value={draft.description} onChange={e => setDraft(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Kurze Beschreibung oder Servierhinweis…"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id={`alc-${cocktail.id}`} checked={draft.is_alcoholic} onChange={e => setDraft(p => ({ ...p, is_alcoholic: e.target.checked }))} />
                <label htmlFor={`alc-${cocktail.id}`} style={{ fontSize: 13 }}>Enthält Alkohol</label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 8 }}>Zutaten</label>
                {draft.ingredients.map((ingr, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, flex: 1 }}>{ingr.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>{ingr.amount} {ingr.unit}</span>
                    <button onClick={() => setDraft(p => ({ ...p, ingredients: p.ingredients.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, padding: 2 }}>
                      <X size={12} style={{ color: '#e05252' }} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <FieldInput value={newIngr.name} onChange={v => setNewIngr(p => ({ ...p, name: v }))} placeholder="Zutat" />
                  <FieldInput value={newIngr.amount} onChange={v => setNewIngr(p => ({ ...p, amount: v }))} placeholder="Menge" />
                  <input value={newIngr.unit} onChange={e => setNewIngr(p => ({ ...p, unit: e.target.value }))} placeholder="ml"
                    style={{ width: 54, padding: '6px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                  <button onClick={addIngr} disabled={!newIngr.name.trim()} style={{ padding: '6px 10px', background: newIngr.name.trim() ? color : '#eee', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Plus size={12} style={{ color: newIngr.name.trim() ? '#fff' : '#aaa' }} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={save} disabled={saving} style={{ padding: '7px 16px', background: 'var(--accent, #1a1a1a)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {saving ? '…' : 'Speichern'}
                </button>
                <button onClick={() => { setDraft(cocktail); setOpen(false) }} style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border, #ddd)', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div>
              {cocktail.description && <p style={{ fontSize: 13, color: 'var(--text-secondary, #555)', marginBottom: 8 }}>{cocktail.description}</p>}
              {cocktail.ingredients.length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 6 }}>Zutaten</p>
                  {cocktail.ingredients.map((ingr, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
                      <span>{ingr.name}</span>
                      <span style={{ color: 'var(--text-tertiary, #aaa)' }}>{ingr.amount} {ingr.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Budget footer ─────────────────────────────────────────────────────────────

function BudgetFooter({ mode, kategorien, artikel, cocktails }: {
  mode: Mode; kategorien: Kategorie[]; artikel: Artikel[]; cocktails: Cocktail[]
}) {
  const isVera = mode === 'veranstalter'
  const [showDetails, setShowDetails] = useState(false)

  const katRows = kategorien.map(k => {
    const items   = artikel.filter(a => a.kategorie_id === k.id)
    const kalkSum = items.reduce((s, a) => s + a.total_planned * a.kalkulationspreis, 0)
    const bpSum   = items.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
    const count   = items.reduce((s, a) => s + a.total_planned, 0)
    return { ...k, kalkSum, bpSum, count }
  }).filter(r => isVera ? (r.kalkSum > 0 || r.bpSum > 0) : r.bpSum > 0)

  const uncategorized = artikel.filter(a => !a.kategorie_id)
  const uncatKalk  = uncategorized.reduce((s, a) => s + a.total_planned * a.kalkulationspreis, 0)
  const uncatBp    = uncategorized.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)

  const artikelKalk  = artikel.reduce((s, a) => s + a.total_planned * a.kalkulationspreis, 0)
  const artikelBp    = artikel.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
  const cocktailKalk = cocktails.reduce((s, c) => s + (c.kalkulationspreis ?? 0) * c.planned_count, 0)
  const cocktailBp   = cocktails.reduce((s, c) => s + (c.price_per_unit ?? 0) * c.planned_count, 0)

  const grandKalk = artikelKalk + cocktailKalk
  const grandBp   = artikelBp + cocktailBp

  if (isVera ? grandKalk === 0 && grandBp === 0 : grandBp === 0) return null

  const grandTotal = isVera ? grandKalk : grandBp

  // Stacked-bar / legend segments (categories + sonstige + cocktails)
  const segments: { key: string; name: string; color: string; value: number }[] = [
    ...katRows.map(r => ({ key: r.id, name: r.name, color: r.color, value: isVera ? r.kalkSum : r.bpSum })),
  ]
  if (isVera ? uncatKalk > 0 : uncatBp > 0) {
    segments.push({ key: 'uncat', name: 'Sonstige Getränke', color: '#9aa0a6', value: isVera ? uncatKalk : uncatBp })
  }
  if (isVera ? cocktailKalk > 0 : cocktailBp > 0) {
    segments.push({ key: 'cocktails', name: 'Cocktails', color: '#8B2252', value: isVera ? cocktailKalk : cocktailBp })
  }

  return (
    <div style={{ background: 'var(--surface, #fff)', borderRadius: 12, border: '1px solid var(--border, #e8e8e8)', overflow: 'hidden', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderBottom: '1px solid var(--border, #f0f0f0)', background: 'var(--bg, #f5f5f7)' }}>
        <Calculator size={14} style={{ color: 'var(--text-tertiary, #aaa)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)' }}>
          {isVera ? 'Kalkulation' : 'Budget-Übersicht'}
        </span>
      </div>

      {/* Prominent total + stacked bar + legend */}
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #1a1a1a)', marginBottom: 12 }}>
          {fmt(grandTotal)} €
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--border, #eee)', marginBottom: 12 }}>
          {segments.map(s => (
            <div key={s.key} title={`${s.name}: ${fmt(s.value)} €`}
              style={{ width: `${grandTotal > 0 ? (s.value / grandTotal) * 100 : 0}%`, background: s.color, height: '100%' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
          {segments.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary, #555)' }}>{s.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #1a1a1a)' }}>{fmt(s.value)} €</span>
            </div>
          ))}
        </div>
      </div>

      {/* Details toggle */}
      <div style={{ borderTop: '1px solid var(--border, #f0f0f0)' }}>
        <button onClick={() => setShowDetails(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #666)' }}>
          {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showDetails ? 'Details ausblenden' : 'Details anzeigen'}
        </button>
      </div>

      {showDetails && (
      <div style={{ padding: '4px 0', borderTop: '1px solid var(--border, #f0f0f0)' }}>
        {katRows.map(r => {
          const rowVal = isVera ? r.kalkSum : r.bpSum
          return (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', borderBottom: '1px solid var(--bg, #f8f8f8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color }} />
                <span style={{ fontSize: 13 }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary, #bbb)' }}>({r.count} Stk.)</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(rowVal)} €</span>
            </div>
          )
        })}

        {(isVera ? uncatKalk > 0 : uncatBp > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px', borderBottom: '1px solid var(--bg, #f8f8f8)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary, #888)' }}>Sonstige Getränke</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(isVera ? uncatKalk : uncatBp)} €</span>
          </div>
        )}

        {(isVera ? cocktailKalk > 0 : cocktailBp > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px', borderBottom: '1px solid var(--bg, #f8f8f8)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary, #888)' }}>Cocktails</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(isVera ? cocktailKalk : cocktailBp)} €</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', background: 'var(--bg, #f5f5f7)' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Gesamt</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(isVera ? grandKalk : grandBp)} €</span>
        </div>
      </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GetraenkeTabContent({ eventId, mode, guestCount = 0 }: Props) {
  const [kategorien, setKategorien] = useState<Kategorie[]>([])
  const [artikel, setArtikel]       = useState<Artikel[]>([])
  const [cocktails, setCocktails]   = useState<Cocktail[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'planung' | 'cocktails'>('planung')

  // Catering plan state (Planzahl + billing mode)
  const [cateringPlanId, setCateringPlanId]         = useState<string | null>(null)
  const [planEnabled, setPlanEnabled]               = useState(false)
  const [planCount, setPlanCount]                   = useState(0)
  const [getränkeBilling, setGetränkeBilling]       = useState<'honorar' | 'einzeln'>('honorar')
  const [savingPlan, setSavingPlan]                 = useState(false)

  const [newKatName, setNewKatName]           = useState('')
  const [newKatColor, setNewKatColor]         = useState(CATEGORY_COLORS[0])
  const [newKatAlcoholic, setNewKatAlcoholic] = useState(true)
  const [addingKat, setAddingKat]             = useState(false)
  const [showKatForm, setShowKatForm]         = useState(false)

  const [newCocktailName, setNewCocktailName]           = useState('')
  const [newCocktailAlcoholic, setNewCocktailAlcoholic] = useState(true)
  const [addingCocktail, setAddingCocktail]             = useState(false)

  const canEdit = mode !== 'dienstleister'
  const isVera  = mode === 'veranstalter'
  const effectiveGuestCount = planEnabled && planCount > 0 ? planCount : guestCount

  // Sum of all categories (for per-category share bar) — uses kalk for veranstalter, BP otherwise
  const katGrandTotal = kategorien.reduce((sum, k) => {
    const items = artikel.filter(a => a.kategorie_id === k.id)
    return sum + items.reduce((s, a) => s + a.total_planned * (isVera ? a.kalkulationspreis : a.price_per_unit), 0)
  }, 0)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('getraenke_kategorien').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('getraenke_artikel').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('getraenke_cocktails').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('catering_plans').select('id, plan_guest_count, plan_guest_count_enabled, getraenke_billing').eq('event_id', eventId).maybeSingle(),
    ]).then(([{ data: k }, { data: a }, { data: c }, { data: plan }]) => {
      setKategorien((k ?? []).map(row => ({ ...row, is_alcoholic: row.is_alcoholic ?? true })))
      setArtikel((a ?? []).map(row => ({ ...row, kalkulationspreis: row.kalkulationspreis ?? 0 })))
      setCocktails((c ?? []).map(row => ({
        ...row,
        price_per_unit:    row.price_per_unit ?? 0,
        kalkulationspreis: row.kalkulationspreis ?? 0,
        ingredients:       row.ingredients ?? [],
      })))
      if (plan) {
        setCateringPlanId(plan.id)
        setPlanEnabled(plan.plan_guest_count_enabled ?? false)
        setPlanCount(plan.plan_guest_count ?? 0)
        setGetränkeBilling((plan.getraenke_billing as 'honorar' | 'einzeln') ?? 'honorar')
      }
      setLoading(false)
    })
  }, [eventId])

  async function saveCateringPlan(patch: Record<string, unknown>) {
    setSavingPlan(true)
    const supabase = createClient()
    if (cateringPlanId) {
      await supabase.from('catering_plans').update(patch).eq('id', cateringPlanId)
    } else {
      const { data } = await supabase.from('catering_plans').insert({ event_id: eventId, ...patch }).select('id').single()
      if (data) setCateringPlanId(data.id)
    }
    setSavingPlan(false)
  }

  async function togglePlanEnabled() {
    const next = !planEnabled
    setPlanEnabled(next)
    await saveCateringPlan({ plan_guest_count_enabled: next })
  }

  async function savePlanCount(val: number) {
    setPlanCount(val)
    await saveCateringPlan({ plan_guest_count: val, plan_guest_count_enabled: true })
  }

  async function saveGetränkeBilling(val: 'honorar' | 'einzeln') {
    setGetränkeBilling(val)
    await saveCateringPlan({ getraenke_billing: val })
  }

  async function toggleKatAlcoholic(kat: Kategorie) {
    const next = !kat.is_alcoholic
    await createClient().from('getraenke_kategorien').update({ is_alcoholic: next }).eq('id', kat.id)
    setKategorien(prev => prev.map(k => k.id === kat.id ? { ...k, is_alcoholic: next } : k))
  }

  async function addPresetKategorien() {
    const supabase = createClient()
    const inserts = PRESET_KATEGORIEN.map((p, i) => ({
      event_id: eventId, name: p.name, color: p.color, is_alcoholic: p.is_alcoholic, sort_order: kategorien.length + i,
    }))
    const { data, error } = await supabase.from('getraenke_kategorien').insert(inserts).select()
    if (!error && data) setKategorien(prev => [...prev, ...data as Kategorie[]])
  }

  async function addKategorie() {
    if (!newKatName.trim()) return
    setAddingKat(true)
    const { data, error } = await createClient().from('getraenke_kategorien').insert({
      event_id: eventId, name: newKatName.trim(), color: newKatColor, is_alcoholic: newKatAlcoholic, sort_order: kategorien.length,
    }).select().single()
    setAddingKat(false)
    if (!error && data) {
      setKategorien(prev => [...prev, data as Kategorie])
      setNewKatName(''); setShowKatForm(false)
    }
  }

  async function deleteKategorie(id: string) {
    await createClient().from('getraenke_kategorien').delete().eq('id', id)
    setKategorien(prev => prev.filter(k => k.id !== id))
  }

  async function deleteArtikel(id: string) {
    await createClient().from('getraenke_artikel').delete().eq('id', id)
    setArtikel(prev => prev.filter(a => a.id !== id))
  }

  async function addCocktail() {
    if (!newCocktailName.trim()) return
    setAddingCocktail(true)
    const { data, error } = await createClient().from('getraenke_cocktails').insert({
      event_id: eventId, name: newCocktailName.trim(), is_alcoholic: newCocktailAlcoholic, sort_order: cocktails.length,
    }).select().single()
    setAddingCocktail(false)
    if (!error && data) {
      setCocktails(prev => [...prev, { ...(data as Omit<Cocktail, 'ingredients' | 'price_per_unit' | 'kalkulationspreis'>), ingredients: [], price_per_unit: 0, kalkulationspreis: 0 } as Cocktail])
      setNewCocktailName('')
    }
  }

  async function deleteCocktail(id: string) {
    await createClient().from('getraenke_cocktails').delete().eq('id', id)
    setCocktails(prev => prev.filter(c => c.id !== id))
  }

  if (loading) {
    return <div style={{ padding: '32px', fontSize: 14, color: 'var(--text-tertiary, #aaa)' }}>Wird geladen…</div>
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>Getränke</h1>
      </div>

      {/* Planzahl + Billing widget */}
      {canEdit && (
        <div style={{ background: 'var(--surface, #fff)', borderRadius: 10, border: '1px solid var(--border, #e5e7eb)', padding: '12px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          {/* Planzahl */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
            <Users size={14} style={{ color: 'var(--text-tertiary, #aaa)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 4 }}>Planzahl Gäste</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={togglePlanEnabled}
                  disabled={savingPlan}
                  style={{
                    width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                    background: planEnabled ? 'var(--accent, #1a1a1a)' : 'var(--border, #ddd)',
                    transition: 'background 0.15s', position: 'relative',
                  }}
                >
                  <span style={{
                    display: 'block', width: 12, height: 12, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, left: planEnabled ? 19 : 3, transition: 'left 0.15s',
                  }} />
                </button>
                {planEnabled ? (
                  <input
                    type="number" min={0}
                    value={planCount || ''}
                    onChange={e => savePlanCount(parseInt(e.target.value) || 0)}
                    placeholder="Geplante Gästezahl"
                    style={{ width: 110, padding: '4px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>
                    {guestCount > 0 ? `${guestCount} bestätigte Zusagen` : 'Noch keine Zusagen'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Getränke billing mode (veranstalter only) */}
          {isVera && (
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 6 }}>Abrechnung Getränke</div>
              <div style={{ display: 'flex', gap: 2, background: 'var(--bg, #f5f5f7)', borderRadius: 7, padding: 2, border: '1px solid var(--border, #e5e7eb)', width: 'fit-content' }}>
                {([['honorar', 'Im Honorar'] as const, ['einzeln', 'Einzeln'] as const]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => saveGetränkeBilling(val)}
                    style={{
                      padding: '4px 12px', border: 'none', borderRadius: 5, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500,
                      background: getränkeBilling === val ? '#fff' : 'transparent',
                      color: getränkeBilling === val ? 'var(--text-primary, #1a1a1a)' : 'var(--text-secondary, #888)',
                      boxShadow: getränkeBilling === val ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary, #aaa)', marginTop: 4 }}>
                {getränkeBilling === 'honorar'
                  ? 'Kalkulationskosten fließen negativ in die Veranstaltermarge'
                  : 'Differenz BP-Preis − Kalkulation fließt positiv in die Marge'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab bar + category actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: showKatForm ? 12 : 24 }}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg, #f5f5f7)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '6px 14px', border: 'none', borderRadius: 6, fontSize: 13,
              fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? 'var(--text-primary, #1a1a1a)' : 'var(--text-secondary, #888)',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'background 0.15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Category actions (Mengenplanung tab only) */}
        {canEdit && tab === 'planung' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {kategorien.length === 0 && (
              <button onClick={addPresetKategorien} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#fff', color: 'var(--gold, #B89968)', border: '1px solid var(--gold, #B89968)', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                Standard-Sortiment laden
              </button>
            )}
            <button onClick={() => setShowKatForm(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#fff', color: 'var(--gold, #B89968)', border: '1px solid var(--gold, #B89968)', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              <Plus size={14} /> Neue Kategorie
            </button>
          </div>
        )}
      </div>

      {/* Inline new-category panel (under tab row, Mengenplanung only) */}
      {canEdit && tab === 'planung' && showKatForm && (
        <div style={{ background: 'var(--surface, #fff)', borderRadius: 10, border: '1px solid var(--border, #e5e7eb)', padding: '14px 16px', marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 10 }}>Neue Kategorie</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <FieldInput value={newKatName} onChange={setNewKatName} placeholder="Kategoriename" />
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {CATEGORY_COLORS.map(c => (
                <button key={c} onClick={() => setNewKatColor(c)} style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: newKatColor === c ? '2px solid #333' : '1px solid #ddd', cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input type="checkbox" id="new-kat-alcoholic" checked={newKatAlcoholic} onChange={e => setNewKatAlcoholic(e.target.checked)} />
            <label htmlFor="new-kat-alcoholic" style={{ fontSize: 13, color: 'var(--text-secondary, #666)' }}>Enthält Alkohol</label>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addKategorie} disabled={addingKat || !newKatName.trim()} style={{ padding: '7px 16px', background: '#fff', color: newKatName.trim() ? 'var(--gold, #B89968)' : '#bbb', border: `1px solid ${newKatName.trim() ? 'var(--gold, #B89968)' : 'var(--border, #ddd)'}`, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: newKatName.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              {addingKat ? '…' : 'Erstellen'}
            </button>
            <button onClick={() => setShowKatForm(false)} style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border, #ddd)', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Mengenplanung tab */}
      {tab === 'planung' && (
        <div>
          {kategorien.length === 0 && !showKatForm ? (
            <div style={{ background: 'var(--surface, #fff)', borderRadius: 10, border: '1px dashed var(--border, #ddd)', padding: '32px 24px', textAlign: 'center' }}>
              <GlassWater size={32} style={{ color: 'var(--text-tertiary, #ccc)', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 14, color: 'var(--text-secondary, #888)', margin: 0 }}>Noch keine Getränkekategorien angelegt</p>
              {canEdit && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary, #aaa)', marginTop: 8, marginBottom: 0 }}>
                  Oben rechts „Standard-Sortiment laden“ oder „Neue Kategorie“ wählen.
                </p>
              )}
            </div>
          ) : (
            <>
              {kategorien.map(k => (
                <KategorieSection
                  key={k.id} kat={k}
                  artikel={artikel.filter(a => a.kategorie_id === k.id)}
                  canEdit={canEdit} isVera={isVera}
                  effectiveGuestCount={effectiveGuestCount}
                  grandTotal={katGrandTotal}
                  onArtikelChange={updated => setArtikel(prev => prev.map(a => a.id === updated.id ? updated : a))}
                  onArtikelDelete={deleteArtikel}
                  onArtikelAdd={a => setArtikel(prev => [...prev, a])}
                  onKatDelete={() => deleteKategorie(k.id)}
                  onKatAlcoholicToggle={() => toggleKatAlcoholic(k)}
                />
              ))}

              {artikel.filter(a => !a.kategorie_id).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {artikel.filter(a => !a.kategorie_id).map(a => (
                    <div key={a.id} style={{ fontSize: 13, padding: '6px 14px', background: 'var(--surface, #fff)', borderRadius: 7, border: '1px solid var(--border, #eee)', marginBottom: 4 }}>
                      {a.name}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Cocktailplanung tab */}
      {tab === 'cocktails' && (
        <div>
          {cocktails.length === 0 ? (
            <div style={{ background: 'var(--surface, #fff)', borderRadius: 10, border: '1px dashed var(--border, #ddd)', padding: '32px 24px', textAlign: 'center' }}>
              <Wine size={32} style={{ color: 'var(--text-tertiary, #ccc)', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 14, color: 'var(--text-secondary, #888)' }}>Noch keine Cocktails geplant</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cocktails.map(c => (
                <CocktailCard key={c.id} cocktail={c} canEdit={canEdit} isVera={isVera}
                  onChange={updated => setCocktails(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onDelete={() => deleteCocktail(c.id)} />
              ))}
            </div>
          )}

          {canEdit && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, padding: '10px 14px', background: 'var(--surface, #fff)', borderRadius: 8, border: '1px solid var(--border, #eee)' }}>
              <FieldInput value={newCocktailName} onChange={setNewCocktailName} placeholder="Cocktail-Name…" />
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary, #666)', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={newCocktailAlcoholic} onChange={e => setNewCocktailAlcoholic(e.target.checked)} />
                mit Alkohol
              </label>
              <button onClick={addCocktail} disabled={addingCocktail || !newCocktailName.trim()} style={{
                padding: '6px 14px', background: newCocktailName.trim() ? 'var(--accent, #1a1a1a)' : '#eee',
                color: newCocktailName.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 6, fontSize: 13,
                cursor: newCocktailName.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
              }}>
                {addingCocktail ? '…' : 'Hinzufügen'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Budget footer */}
      <BudgetFooter mode={mode} kategorien={kategorien} artikel={artikel} cocktails={cocktails} />
    </div>
  )
}
