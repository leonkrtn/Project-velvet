'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronRight,
  GlassWater, Wine, Beer, Coffee, Layers, Calculator,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Kategorie {
  id: string
  event_id: string
  name: string
  color: string
  sort_order: number
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
  notes: string
  sort_order: number
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
  { name: 'Bier',        color: '#E8A020' },
  { name: 'Wein',        color: '#8B2252' },
  { name: 'Sekt / Prosecco', color: '#C9A84C' },
  { name: 'Spirituosen', color: '#5C4033' },
  { name: 'Softdrinks',  color: '#2A9D8F' },
  { name: 'Wasser',      color: '#457B9D' },
]

const UNITS = ['Flasche', 'Liter', 'Dose', 'Glas', 'Krug', 'Kasten', 'Stück']

const CATEGORY_COLORS = [
  '#E8A020', '#8B2252', '#C9A84C', '#5C4033', '#2A9D8F', '#457B9D',
  '#B8943E', '#E76F51', '#264653', '#6A4C93', '#1982C4', '#8AC926',
]

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

function InlineInput({
  value, onChange, placeholder, type = 'text', style,
}: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; style?: React.CSSProperties }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      style={{
        padding: '5px 8px', border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 5, fontSize: 13, fontFamily: 'inherit',
        outline: 'none', background: '#fff', boxSizing: 'border-box',
        ...style,
      }}
    />
  )
}

// ── Kategorie section ─────────────────────────────────────────────────────────

function KategorieSection({
  kat, artikel, canEdit, guestCount, onArtikelChange, onArtikelDelete, onArtikelAdd, onKatDelete,
}: {
  kat: Kategorie
  artikel: Artikel[]
  canEdit: boolean
  guestCount: number
  onArtikelChange: (a: Artikel) => void
  onArtikelDelete: (id: string) => void
  onArtikelAdd: (a: Artikel) => void
  onKatDelete: () => void
}) {
  const [open, setOpen] = useState(true)
  const [addName, setAddName]     = useState('')
  const [addUnit, setAddUnit]     = useState('Flasche')
  const [addAmt, setAddAmt]       = useState('')
  const [addPrice, setAddPrice]   = useState('')
  const [saving, setSaving]       = useState(false)

  const totalBudget = artikel.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)

  async function addArtikel() {
    if (!addName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const perPerson = parseFloat(addAmt) || 0
    const total = perPerson > 0 && guestCount > 0 ? Math.ceil(perPerson * guestCount) : 0
    const { data, error } = await supabase.from('getraenke_artikel').insert({
      event_id: kat.event_id,
      kategorie_id: kat.id,
      name: addName.trim(),
      unit: addUnit,
      amount_per_person: perPerson,
      total_planned: total,
      price_per_unit: parseFloat(addPrice) || 0,
      sort_order: artikel.length,
    }).select().single()
    setSaving(false)
    if (!error && data) {
      onArtikelAdd(data as Artikel)
      setAddName(''); setAddAmt(''); setAddPrice(''); setAddUnit('Flasche')
    }
  }

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border, #e5e7eb)', overflow: 'hidden', background: '#fff', marginBottom: 12 }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', background: `${kat.color}12`, borderBottom: open ? `1px solid ${kat.color}30` : undefined }}
        onClick={() => setOpen(p => !p)}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: kat.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', flex: 1 }}>{kat.name}</span>
        <span style={{ fontSize: 12, color: '#666' }}>{artikel.length} Artikel · {fmt(totalBudget)} €</span>
        {canEdit && (
          <button
            onClick={e => { e.stopPropagation(); onKatDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, padding: '2px 4px', display: 'flex', alignItems: 'center' }}
            title="Kategorie löschen"
          >
            <Trash2 size={13} style={{ color: '#e05252' }} />
          </button>
        )}
        {open ? <ChevronDown size={14} style={{ color: '#999' }} /> : <ChevronRight size={14} style={{ color: '#999' }} />}
      </div>

      {open && (
        <>
          {/* Column header */}
          {artikel.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 80px 80px 32px', gap: 6, padding: '6px 14px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
              {['Bezeichnung', 'Einheit', 'Pers.', 'Gesamt', 'Preis/Stk', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>{h}</span>
              ))}
            </div>
          )}

          {/* Artikel rows */}
          {artikel.map(a => (
            <ArtikelRow key={a.id} artikel={a} canEdit={canEdit} guestCount={guestCount} onChange={onArtikelChange} onDelete={() => onArtikelDelete(a.id)} />
          ))}

          {/* Add row */}
          {canEdit && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 80px 80px 32px', gap: 6, padding: '8px 14px', borderTop: artikel.length > 0 ? '1px solid #f0f0f0' : undefined, background: '#fafafa' }}>
              <InlineInput value={addName} onChange={setAddName} placeholder="Bezeichnung" style={{ width: '100%' }} />
              <select
                value={addUnit}
                onChange={e => setAddUnit(e.target.value)}
                style={{ padding: '5px 6px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 5, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              >
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
              <InlineInput value={addAmt} onChange={setAddAmt} placeholder="0" type="number" style={{ width: '100%' }} />
              <InlineInput
                value={addAmt && guestCount > 0 ? String(Math.ceil(parseFloat(addAmt) * guestCount)) : ''}
                onChange={() => {}}
                placeholder="Auto"
                style={{ width: '100%', background: '#f5f5f5', color: '#888' }}
              />
              <InlineInput value={addPrice} onChange={setAddPrice} placeholder="0,00" type="number" style={{ width: '100%' }} />
              <button
                onClick={addArtikel}
                disabled={saving || !addName.trim()}
                style={{ background: addName.trim() ? kat.color : '#eee', border: 'none', borderRadius: 5, cursor: addName.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? <span style={{ fontSize: 10 }}>…</span> : <Plus size={13} style={{ color: addName.trim() ? '#fff' : '#aaa' }} />}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ArtikelRow({ artikel, canEdit, guestCount, onChange, onDelete }: {
  artikel: Artikel; canEdit: boolean; guestCount: number; onChange: (a: Artikel) => void; onDelete: () => void
}) {
  const [draft, setDraft] = useState(artikel)
  const debouncedDraft    = useDebounce(draft, 600)
  const savedRef          = useRef(artikel)

  useEffect(() => {
    if (JSON.stringify(debouncedDraft) === JSON.stringify(savedRef.current)) return
    savedRef.current = debouncedDraft
    const supabase = createClient()
    supabase.from('getraenke_artikel').update({
      name: debouncedDraft.name,
      unit: debouncedDraft.unit,
      amount_per_person: debouncedDraft.amount_per_person,
      total_planned: debouncedDraft.total_planned,
      price_per_unit: debouncedDraft.price_per_unit,
      notes: debouncedDraft.notes,
    }).eq('id', artikel.id).then(({ error }) => {
      if (!error) onChange(debouncedDraft)
    })
  }, [debouncedDraft]) // eslint-disable-line react-hooks/exhaustive-deps

  function setField<K extends keyof Artikel>(key: K, val: Artikel[K]) {
    setDraft(p => {
      const next = { ...p, [key]: val }
      // auto-recalculate total when amount_per_person changes
      if (key === 'amount_per_person' && guestCount > 0) {
        const perP = typeof val === 'number' ? val : parseFloat(val as string) || 0
        next.total_planned = Math.ceil(perP * guestCount)
      }
      return next
    })
  }

  const lineTotal = draft.total_planned * draft.price_per_unit

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 80px 80px 32px', gap: 6, padding: '6px 14px', borderBottom: '1px solid #f8f8f8', alignItems: 'center' }}>
      {canEdit ? (
        <InlineInput value={draft.name} onChange={v => setField('name', v)} style={{ width: '100%' }} />
      ) : (
        <span style={{ fontSize: 13 }}>{draft.name}</span>
      )}
      {canEdit ? (
        <select
          value={draft.unit}
          onChange={e => setField('unit', e.target.value)}
          style={{ padding: '5px 6px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 5, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
        >
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
      ) : (
        <span style={{ fontSize: 12, color: '#666' }}>{draft.unit}</span>
      )}
      {canEdit ? (
        <InlineInput value={draft.amount_per_person || ''} onChange={v => setField('amount_per_person', parseFloat(v) || 0)} type="number" style={{ width: '100%' }} />
      ) : (
        <span style={{ fontSize: 12, color: '#666' }}>{draft.amount_per_person}</span>
      )}
      {canEdit ? (
        <InlineInput value={draft.total_planned || ''} onChange={v => setField('total_planned', parseInt(v) || 0)} type="number" style={{ width: '100%' }} />
      ) : (
        <span style={{ fontSize: 12, color: '#666' }}>{draft.total_planned}</span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {canEdit ? (
          <InlineInput value={draft.price_per_unit || ''} onChange={v => setField('price_per_unit', parseFloat(v) || 0)} type="number" style={{ width: '100%' }} />
        ) : (
          <span style={{ fontSize: 12, color: '#666' }}>{fmt(draft.price_per_unit)} €</span>
        )}
        {lineTotal > 0 && (
          <span style={{ fontSize: 10, color: '#aaa' }}>= {fmt(lineTotal)} €</span>
        )}
      </div>
      {canEdit ? (
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, display: 'flex', alignItems: 'center', padding: 2 }}>
          <Trash2 size={13} style={{ color: '#e05252' }} />
        </button>
      ) : <div />}
    </div>
  )
}

// ── Cocktail section ──────────────────────────────────────────────────────────

function CocktailCard({ cocktail, canEdit, onChange, onDelete }: {
  cocktail: Cocktail; canEdit: boolean; onChange: (c: Cocktail) => void; onDelete: () => void
}) {
  const [open, setOpen]         = useState(false)
  const [draft, setDraft]       = useState(cocktail)
  const [saving, setSaving]     = useState(false)
  const [newIngr, setNewIngr]   = useState<Ingredient>({ name: '', amount: '', unit: 'ml' })

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('getraenke_cocktails').update({
      name: draft.name,
      description: draft.description,
      is_alcoholic: draft.is_alcoholic,
      planned_count: draft.planned_count,
      ingredients: draft.ingredients,
    }).eq('id', cocktail.id)
    setSaving(false)
    if (!error) { onChange(draft); setOpen(false) }
  }

  function addIngr() {
    if (!newIngr.name.trim()) return
    setDraft(p => ({ ...p, ingredients: [...p.ingredients, { ...newIngr }] }))
    setNewIngr({ name: '', amount: '', unit: 'ml' })
  }

  function removeIngr(i: number) {
    setDraft(p => ({ ...p, ingredients: p.ingredients.filter((_, idx) => idx !== i) }))
  }

  const color = cocktail.is_alcoholic ? '#8B2252' : '#2A9D8F'

  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', overflow: 'hidden', background: '#fff' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', cursor: 'pointer', background: `${color}08` }}
        onClick={() => canEdit ? setOpen(p => !p) : undefined}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{cocktail.name}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{cocktail.is_alcoholic ? 'mit Alkohol' : 'alkoholfrei'}</span>
        {cocktail.planned_count > 0 && (
          <span style={{ fontSize: 11, color: color, fontWeight: 600 }}>{cocktail.planned_count}×</span>
        )}
        {!canEdit && cocktail.ingredients.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
          >
            {open ? <ChevronDown size={14} style={{ color: '#999' }} /> : <ChevronRight size={14} style={{ color: '#999' }} />}
          </button>
        )}
        {canEdit && (
          <>
            <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={13} style={{ color: '#e05252' }} />
            </button>
            {open ? <ChevronDown size={14} style={{ color: '#999' }} /> : <ChevronRight size={14} style={{ color: '#999' }} />}
          </>
        )}
      </div>

      {open && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${color}20` }}>
          {canEdit ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name</label>
                  <InlineInput value={draft.name} onChange={v => setDraft(p => ({ ...p, name: v }))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Geplante Menge</label>
                  <InlineInput value={draft.planned_count || ''} onChange={v => setDraft(p => ({ ...p, planned_count: parseInt(v) || 0 }))} type="number" placeholder="0" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Beschreibung</label>
                <textarea
                  value={draft.description}
                  onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="Kurze Beschreibung oder Servierhinweis…"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 5, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id={`alc-${cocktail.id}`} checked={draft.is_alcoholic} onChange={e => setDraft(p => ({ ...p, is_alcoholic: e.target.checked }))} />
                <label htmlFor={`alc-${cocktail.id}`} style={{ fontSize: 13 }}>Enthält Alkohol</label>
              </div>

              {/* Ingredients */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Zutaten</label>
                {draft.ingredients.map((ingr, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, flex: 1 }}>{ingr.name}</span>
                    <span style={{ fontSize: 12, color: '#888' }}>{ingr.amount} {ingr.unit}</span>
                    <button onClick={() => removeIngr(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, padding: 2 }}>
                      <X size={12} style={{ color: '#e05252' }} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                  <InlineInput value={newIngr.name} onChange={v => setNewIngr(p => ({ ...p, name: v }))} placeholder="Zutat" style={{ flex: 2 }} />
                  <InlineInput value={newIngr.amount} onChange={v => setNewIngr(p => ({ ...p, amount: v }))} placeholder="Menge" style={{ flex: 1 }} />
                  <InlineInput value={newIngr.unit} onChange={v => setNewIngr(p => ({ ...p, unit: v }))} placeholder="ml" style={{ width: 50 }} />
                  <button onClick={addIngr} disabled={!newIngr.name.trim()} style={{ padding: '5px 8px', background: newIngr.name.trim() ? color : '#eee', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Plus size={12} style={{ color: newIngr.name.trim() ? '#fff' : '#aaa' }} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={save} disabled={saving} style={{ padding: '6px 14px', background: color, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {saving ? '…' : 'Speichern'}
                </button>
                <button onClick={() => { setDraft(cocktail); setOpen(false) }} style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>
              </div>
            </div>
          ) : (
            /* Read-only view */
            <div>
              {cocktail.description && <p style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>{cocktail.description}</p>}
              {cocktail.ingredients.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: 6 }}>Zutaten</p>
                  {cocktail.ingredients.map((ingr, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
                      <span>{ingr.name}</span>
                      <span style={{ color: '#888' }}>{ingr.amount} {ingr.unit}</span>
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

// ── Budget summary ────────────────────────────────────────────────────────────

function BudgetSummary({ kategorien, artikel }: { kategorien: Kategorie[]; artikel: Artikel[] }) {
  const rows = kategorien.map(k => {
    const items = artikel.filter(a => a.kategorie_id === k.id)
    const total = items.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
    return { ...k, total, count: items.reduce((s, a) => s + a.total_planned, 0) }
  }).filter(r => r.total > 0 || r.count > 0)
  const uncategorized = artikel.filter(a => !a.kategorie_id)
  const uncatTotal = uncategorized.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
  const grandTotal = artikel.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)

  if (grandTotal === 0) return null

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border, #e5e7eb)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <Calculator size={14} style={{ color: '#888' }} />
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>Budget-Übersicht</span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', borderBottom: '1px solid #f8f8f8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color }} />
              <span style={{ fontSize: 13 }}>{r.name}</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>({r.count} Stk.)</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(r.total)} €</span>
          </div>
        ))}
        {uncatTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px', borderBottom: '1px solid #f8f8f8' }}>
            <span style={{ fontSize: 13, color: '#888' }}>Sonstige</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(uncatTotal)} €</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fafafa' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Gesamt</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#B8943E' }}>{fmt(grandTotal)} €</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GetraenkeTabContent({ eventId, mode, guestCount = 0 }: Props) {
  const [kategorien, setKategorien] = useState<Kategorie[]>([])
  const [artikel, setArtikel]       = useState<Artikel[]>([])
  const [cocktails, setCocktails]   = useState<Cocktail[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'planung' | 'cocktails' | 'budget'>('planung')

  const [newKatName, setNewKatName]   = useState('')
  const [newKatColor, setNewKatColor] = useState(CATEGORY_COLORS[0])
  const [addingKat, setAddingKat]     = useState(false)
  const [showKatForm, setShowKatForm] = useState(false)

  const [newCocktailName, setNewCocktailName]       = useState('')
  const [newCocktailAlcoholic, setNewCocktailAlcoholic] = useState(true)
  const [addingCocktail, setAddingCocktail]         = useState(false)

  const canEdit = mode !== 'dienstleister'

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('getraenke_kategorien').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('getraenke_artikel').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('getraenke_cocktails').select('*').eq('event_id', eventId).order('sort_order'),
    ]).then(([{ data: k }, { data: a }, { data: c }]) => {
      setKategorien(k ?? [])
      setArtikel(a ?? [])
      setCocktails(c ?? [])
      setLoading(false)
    })
  }, [eventId])

  async function addPresetKategorien() {
    const supabase = createClient()
    const inserts = PRESET_KATEGORIEN.map((p, i) => ({
      event_id: eventId, name: p.name, color: p.color, sort_order: kategorien.length + i,
    }))
    const { data, error } = await supabase.from('getraenke_kategorien').insert(inserts).select()
    if (!error && data) setKategorien(prev => [...prev, ...data as Kategorie[]])
  }

  async function addKategorie() {
    if (!newKatName.trim()) return
    setAddingKat(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('getraenke_kategorien').insert({
      event_id: eventId, name: newKatName.trim(), color: newKatColor, sort_order: kategorien.length,
    }).select().single()
    setAddingKat(false)
    if (!error && data) {
      setKategorien(prev => [...prev, data as Kategorie])
      setNewKatName(''); setShowKatForm(false)
    }
  }

  async function deleteKategorie(id: string) {
    const supabase = createClient()
    await supabase.from('getraenke_kategorien').delete().eq('id', id)
    setKategorien(prev => prev.filter(k => k.id !== id))
  }

  async function deleteArtikel(id: string) {
    const supabase = createClient()
    await supabase.from('getraenke_artikel').delete().eq('id', id)
    setArtikel(prev => prev.filter(a => a.id !== id))
  }

  async function addCocktail() {
    if (!newCocktailName.trim()) return
    setAddingCocktail(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('getraenke_cocktails').insert({
      event_id: eventId, name: newCocktailName.trim(), is_alcoholic: newCocktailAlcoholic, sort_order: cocktails.length,
    }).select().single()
    setAddingCocktail(false)
    if (!error && data) {
      setCocktails(prev => [...prev, { ...(data as Omit<Cocktail, 'ingredients'>), ingredients: [] } as Cocktail])
      setNewCocktailName('')
    }
  }

  async function deleteCocktail(id: string) {
    const supabase = createClient()
    await supabase.from('getraenke_cocktails').delete().eq('id', id)
    setCocktails(prev => prev.filter(c => c.id !== id))
  }

  const TABS = [
    { key: 'planung', label: 'Mengenplanung' },
    { key: 'cocktails', label: 'Cocktailplanung' },
    { key: 'budget', label: 'Budget' },
  ] as const

  if (loading) {
    return <div style={{ padding: 32, color: '#888', fontSize: 14 }}>Wird geladen…</div>
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>Getränke</h1>
        {guestCount > 0 && (
          <span style={{ fontSize: 12, color: '#888', background: '#f5f5f5', borderRadius: 20, padding: '4px 12px' }}>
            {guestCount} Personen
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: '#f5f5f5', borderRadius: 8, padding: 3 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '7px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
              cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#1a1a1a' : '#888',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mengenplanung tab */}
      {tab === 'planung' && (
        <div>
          {kategorien.length === 0 && !showKatForm ? (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px dashed #ddd', padding: '32px 24px', textAlign: 'center' }}>
              <GlassWater size={32} style={{ color: '#ccc', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>Noch keine Getränkekategorien angelegt</p>
              {canEdit && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={addPresetKategorien} style={{ padding: '8px 16px', background: '#fff', color: '#B8943E', border: '1px solid rgba(184, 148, 62, 0.5)', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Standard-Kategorien laden
                  </button>
                  <button onClick={() => setShowKatForm(true)} style={{ padding: '8px 16px', background: 'none', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#666' }}>
                    Manuell anlegen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {kategorien.map(k => (
                <KategorieSection
                  key={k.id}
                  kat={k}
                  artikel={artikel.filter(a => a.kategorie_id === k.id)}
                  canEdit={canEdit}
                  guestCount={guestCount}
                  onArtikelChange={updated => setArtikel(prev => prev.map(a => a.id === updated.id ? updated : a))}
                  onArtikelDelete={deleteArtikel}
                  onArtikelAdd={a => setArtikel(prev => [...prev, a])}
                  onKatDelete={() => deleteKategorie(k.id)}
                />
              ))}

              {/* Uncategorized items */}
              {artikel.filter(a => !a.kategorie_id).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {artikel.filter(a => !a.kategorie_id).map(a => (
                    <div key={a.id} style={{ fontSize: 13, padding: '6px 14px', background: '#fff', borderRadius: 7, border: '1px solid #eee', marginBottom: 4 }}>
                      {a.name}
                    </div>
                  ))}
                </div>
              )}

              {/* Add kategorie */}
              {canEdit && (
                showKatForm ? (
                  <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border, #e5e7eb)', padding: '14px 16px', marginTop: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: 10 }}>Neue Kategorie</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <InlineInput value={newKatName} onChange={setNewKatName} placeholder="Kategoriename" style={{ flex: 1 }} />
                      <div style={{ display: 'flex', gap: 4 }}>
                        {CATEGORY_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewKatColor(c)}
                            style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: newKatColor === c ? '2px solid #333' : '1px solid #ddd', cursor: 'pointer', padding: 0 }}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={addKategorie} disabled={addingKat || !newKatName.trim()} style={{ padding: '6px 14px', background: newKatColor, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {addingKat ? '…' : 'Erstellen'}
                      </button>
                      <button onClick={() => setShowKatForm(false)} style={{ padding: '6px 10px', background: 'none', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowKatForm(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'none', border: '1px dashed #ddd', borderRadius: 8, fontSize: 13, color: '#888', cursor: 'pointer', fontFamily: 'inherit', width: '100%', marginTop: 4 }}
                  >
                    <Plus size={14} /> Kategorie hinzufügen
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* Cocktailplanung tab */}
      {tab === 'cocktails' && (
        <div>
          {cocktails.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px dashed #ddd', padding: '32px 24px', textAlign: 'center' }}>
              <Wine size={32} style={{ color: '#ccc', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, color: '#888' }}>Noch keine Cocktails geplant</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cocktails.map(c => (
                <CocktailCard
                  key={c.id}
                  cocktail={c}
                  canEdit={canEdit}
                  onChange={updated => setCocktails(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onDelete={() => deleteCocktail(c.id)}
                />
              ))}
            </div>
          )}

          {canEdit && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
              <InlineInput
                value={newCocktailName}
                onChange={setNewCocktailName}
                placeholder="Cocktail-Name…"
                style={{ flex: 1 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={newCocktailAlcoholic} onChange={e => setNewCocktailAlcoholic(e.target.checked)} />
                mit Alkohol
              </label>
              <button
                onClick={addCocktail}
                disabled={addingCocktail || !newCocktailName.trim()}
                style={{ padding: '6px 14px', background: newCocktailName.trim() ? '#8B2252' : '#eee', color: newCocktailName.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 6, fontSize: 13, cursor: newCocktailName.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
              >
                {addingCocktail ? '…' : 'Hinzufügen'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Budget tab */}
      {tab === 'budget' && (
        <div>
          {artikel.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0) === 0 ? (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px dashed #ddd', padding: '32px 24px', textAlign: 'center' }}>
              <Calculator size={32} style={{ color: '#ccc', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, color: '#888' }}>Noch keine Preise in der Mengenplanung hinterlegt</p>
            </div>
          ) : (
            <BudgetSummary kategorien={kategorien} artikel={artikel} />
          )}
        </div>
      )}
    </div>
  )
}
