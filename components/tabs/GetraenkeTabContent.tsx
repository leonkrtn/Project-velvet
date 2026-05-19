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
  price_per_unit: number
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
  { name: 'Bier',             color: '#E8A020', is_alcoholic: true  },
  { name: 'Wein',             color: '#8B2252', is_alcoholic: true  },
  { name: 'Sekt / Prosecco',  color: '#C9A84C', is_alcoholic: true  },
  { name: 'Spirituosen',      color: '#5C4033', is_alcoholic: true  },
  { name: 'Softdrinks',       color: '#2A9D8F', is_alcoholic: false },
  { name: 'Wasser',           color: '#457B9D', is_alcoholic: false },
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
  kat, artikel, canEdit, guestCount, onArtikelChange, onArtikelDelete, onArtikelAdd, onKatDelete, onKatUpdate,
}: {
  kat: Kategorie
  artikel: Artikel[]
  canEdit: boolean
  guestCount: number
  onArtikelChange: (a: Artikel) => void
  onArtikelDelete: (id: string) => void
  onArtikelAdd: (a: Artikel) => void
  onKatDelete: () => void
  onKatUpdate?: (updated: Kategorie) => void
}) {
  const [open, setOpen] = useState(true)
  const [addName, setAddName]     = useState('')
  const [addUnit, setAddUnit]     = useState('Flasche')
  const [addAmt, setAddAmt]       = useState('')
  const [addPrice, setAddPrice]   = useState('')
  const [saving, setSaving]       = useState(false)

  const totalBudget = artikel.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)

  async function toggleAlcoholic(e: React.MouseEvent) {
    e.stopPropagation()
    if (!canEdit) return
    const newVal = !kat.is_alcoholic
    const supabase = createClient()
    const { error } = await supabase
      .from('getraenke_kategorien')
      .update({ is_alcoholic: newVal })
      .eq('id', kat.id)
    if (!error && onKatUpdate) {
      onKatUpdate({ ...kat, is_alcoholic: newVal })
    }
  }

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
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white mb-3">
      {/* Header */}
      <div
        style={{ background: `${kat.color}12`, borderBottom: open ? `1px solid ${kat.color}30` : undefined }}
        className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer"
        onClick={() => setOpen(p => !p)}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: kat.color, flexShrink: 0 }} />
        <span className="text-sm font-bold text-gray-900 flex-1">{kat.name}</span>

        {/* is_alcoholic badge */}
        <button
          onClick={toggleAlcoholic}
          className={[
            'text-xs font-medium px-2 py-0.5 rounded-full border transition-all',
            canEdit ? 'cursor-pointer' : 'cursor-default',
            kat.is_alcoholic
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : 'bg-teal-50 text-teal-700 border-teal-200',
          ].join(' ')}
          title={canEdit ? 'Klicken zum Umschalten' : undefined}
        >
          {kat.is_alcoholic ? 'Alkohol' : 'Alkoholfrei'}
        </button>

        <span className="text-xs text-gray-500">{artikel.length} Artikel · {fmt(totalBudget)} €</span>
        {canEdit && (
          <button
            onClick={e => { e.stopPropagation(); onKatDelete() }}
            className="bg-transparent border-0 cursor-pointer opacity-35 p-0.5 flex items-center"
            title="Kategorie löschen"
          >
            <Trash2 size={13} style={{ color: '#e05252' }} />
          </button>
        )}
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </div>

      {open && (
        <>
          {/* Column header */}
          {artikel.length > 0 && (
            <div className="grid gap-1.5 px-3.5 py-1.5 bg-gray-50 border-b border-gray-100" style={{ gridTemplateColumns: '1fr 90px 70px 80px 80px 32px' }}>
              {['Bezeichnung', 'Einheit', 'Pers.', 'Gesamt', 'Preis/Stk', ''].map((h, i) => (
                <span key={i} className="text-xs font-bold uppercase tracking-wider text-gray-400">{h}</span>
              ))}
            </div>
          )}

          {/* Artikel rows */}
          {artikel.map(a => (
            <ArtikelRow key={a.id} artikel={a} canEdit={canEdit} guestCount={guestCount} onChange={onArtikelChange} onDelete={() => onArtikelDelete(a.id)} />
          ))}

          {/* Add row */}
          {canEdit && (
            <div className="grid gap-1.5 px-3.5 py-2 bg-gray-50" style={{ gridTemplateColumns: '1fr 90px 70px 80px 80px 32px', borderTop: artikel.length > 0 ? '1px solid #f0f0f0' : undefined }}>
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
                {saving ? <span className="text-xs">…</span> : <Plus size={13} style={{ color: addName.trim() ? '#fff' : '#aaa' }} />}
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

  // auto-sync total_planned when guestCount changes externally
  useEffect(() => {
    if (draft.amount_per_person > 0 && guestCount > 0) {
      const computed = Math.ceil(draft.amount_per_person * guestCount)
      if (computed !== draft.total_planned) {
        setDraft(p => ({ ...p, total_planned: computed }))
      }
    }
  }, [guestCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const lineTotal = draft.total_planned * draft.price_per_unit

  return (
    <div className="grid gap-1.5 px-3.5 py-1.5 border-b border-gray-50 items-center" style={{ gridTemplateColumns: '1fr 90px 70px 80px 80px 32px' }}>
      {canEdit ? (
        <InlineInput value={draft.name} onChange={v => setField('name', v)} style={{ width: '100%' }} />
      ) : (
        <span className="text-sm">{draft.name}</span>
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
        <span className="text-xs text-gray-500">{draft.unit}</span>
      )}
      {canEdit ? (
        <InlineInput value={draft.amount_per_person || ''} onChange={v => setField('amount_per_person', parseFloat(v) || 0)} type="number" style={{ width: '100%' }} />
      ) : (
        <span className="text-xs text-gray-500">{draft.amount_per_person}</span>
      )}
      {/* total_planned: read-only, auto-computed */}
      <div className="flex flex-col gap-0">
        <span className="text-xs text-gray-400 px-2 py-1 rounded bg-gray-50 border border-gray-100 text-center">
          {draft.total_planned || '—'}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {canEdit ? (
          <InlineInput value={draft.price_per_unit || ''} onChange={v => setField('price_per_unit', parseFloat(v) || 0)} type="number" style={{ width: '100%' }} />
        ) : (
          <span className="text-xs text-gray-500">{fmt(draft.price_per_unit)} €</span>
        )}
        {lineTotal > 0 && (
          <span className="text-xs text-gray-300">= {fmt(lineTotal)} €</span>
        )}
      </div>
      {canEdit ? (
        <button onClick={onDelete} className="bg-transparent border-0 cursor-pointer opacity-35 flex items-center p-0.5">
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
      price_per_unit: draft.price_per_unit,
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
  const cocktailTotal = cocktail.price_per_unit > 0 && cocktail.planned_count > 0
    ? cocktail.price_per_unit * cocktail.planned_count
    : 0

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      <div
        style={{ background: `${color}08` }}
        className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer"
        onClick={() => canEdit ? setOpen(p => !p) : undefined}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span className="text-sm font-semibold flex-1">{cocktail.name}</span>
        <span className="text-xs text-gray-400">{cocktail.is_alcoholic ? 'mit Alkohol' : 'alkoholfrei'}</span>
        {cocktailTotal > 0 && (
          <span className="text-xs font-medium text-gray-500">
            {fmt(cocktail.price_per_unit)} € × {cocktail.planned_count} = {fmt(cocktailTotal)} €
          </span>
        )}
        {cocktail.planned_count > 0 && cocktailTotal === 0 && (
          <span className="text-xs font-semibold" style={{ color }}>{cocktail.planned_count}×</span>
        )}
        {!canEdit && cocktail.ingredients.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
            className="bg-transparent border-0 cursor-pointer flex items-center p-0.5"
          >
            {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          </button>
        )}
        {canEdit && (
          <>
            <button onClick={e => { e.stopPropagation(); onDelete() }} className="bg-transparent border-0 cursor-pointer opacity-35 p-1 flex items-center">
              <Trash2 size={13} style={{ color: '#e05252' }} />
            </button>
            {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          </>
        )}
      </div>

      {open && (
        <div className="px-3.5 py-3" style={{ borderTop: `1px solid ${color}20` }}>
          {canEdit ? (
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Name</label>
                  <InlineInput value={draft.name} onChange={v => setDraft(p => ({ ...p, name: v }))} style={{ width: '100%' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Geplante Menge</label>
                  <InlineInput value={draft.planned_count || ''} onChange={v => setDraft(p => ({ ...p, planned_count: parseInt(v) || 0 }))} type="number" placeholder="0" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Preis pro Stück (€)</label>
                <InlineInput value={draft.price_per_unit || ''} onChange={v => setDraft(p => ({ ...p, price_per_unit: parseFloat(v) || 0 }))} type="number" placeholder="0,00" style={{ width: '100%' }} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Beschreibung</label>
                <textarea
                  value={draft.description}
                  onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="Kurze Beschreibung oder Servierhinweis…"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 5, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id={`alc-${cocktail.id}`} checked={draft.is_alcoholic} onChange={e => setDraft(p => ({ ...p, is_alcoholic: e.target.checked }))} />
                <label htmlFor={`alc-${cocktail.id}`} className="text-sm">Enthält Alkohol</label>
              </div>

              {/* Ingredients */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Zutaten</label>
                {draft.ingredients.map((ingr, i) => (
                  <div key={i} className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs flex-1">{ingr.name}</span>
                    <span className="text-xs text-gray-400">{ingr.amount} {ingr.unit}</span>
                    <button onClick={() => removeIngr(i)} className="bg-transparent border-0 cursor-pointer opacity-40 p-0.5">
                      <X size={12} style={{ color: '#e05252' }} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-1.5 mt-1.5">
                  <InlineInput value={newIngr.name} onChange={v => setNewIngr(p => ({ ...p, name: v }))} placeholder="Zutat" style={{ flex: 2 }} />
                  <InlineInput value={newIngr.amount} onChange={v => setNewIngr(p => ({ ...p, amount: v }))} placeholder="Menge" style={{ flex: 1 }} />
                  <InlineInput value={newIngr.unit} onChange={v => setNewIngr(p => ({ ...p, unit: v }))} placeholder="ml" style={{ width: 50 }} />
                  <button onClick={addIngr} disabled={!newIngr.name.trim()} style={{ padding: '5px 8px', background: newIngr.name.trim() ? color : '#eee', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Plus size={12} style={{ color: newIngr.name.trim() ? '#fff' : '#aaa' }} />
                  </button>
                </div>
              </div>

              <div className="flex gap-1.5">
                <button onClick={save} disabled={saving} style={{ padding: '6px 14px', background: color, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {saving ? '…' : 'Speichern'}
                </button>
                <button onClick={() => { setDraft(cocktail); setOpen(false) }} className="px-2.5 py-1.5 bg-transparent border border-gray-200 rounded-md text-sm cursor-pointer">Abbrechen</button>
              </div>
            </div>
          ) : (
            /* Read-only view */
            <div>
              {cocktail.description && <p className="text-sm text-gray-600 mb-2">{cocktail.description}</p>}
              {cocktail.ingredients.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">Zutaten</p>
                  {cocktail.ingredients.map((ingr, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-gray-50 text-xs">
                      <span>{ingr.name}</span>
                      <span className="text-gray-400">{ingr.amount} {ingr.unit}</span>
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

function BudgetFooter({ kategorien, artikel, cocktails }: { kategorien: Kategorie[]; artikel: Artikel[]; cocktails: Cocktail[] }) {
  const artikelRows = kategorien.map(k => {
    const items = artikel.filter(a => a.kategorie_id === k.id)
    const total = items.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
    return { ...k, total, count: items.reduce((s, a) => s + a.total_planned, 0) }
  }).filter(r => r.total > 0 || r.count > 0)

  const uncategorized  = artikel.filter(a => !a.kategorie_id)
  const uncatTotal     = uncategorized.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
  const artikelTotal   = artikel.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
  const cocktailTotal  = cocktails.reduce((s, c) => s + (c.price_per_unit ?? 0) * c.planned_count, 0)
  const grandTotal     = artikelTotal + cocktailTotal

  if (grandTotal === 0) return null

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <Calculator size={14} className="text-gray-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Budget-Übersicht</span>
      </div>
      <div className="py-1">
        {artikelRows.map(r => (
          <div key={r.id} className="flex justify-between items-center px-4 py-1.5 border-b border-gray-50">
            <div className="flex items-center gap-1.5">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color }} />
              <span className="text-sm">{r.name}</span>
              <span className="text-xs text-gray-300">({r.count} Stk.)</span>
            </div>
            <span className="text-sm font-semibold">{fmt(r.total)} €</span>
          </div>
        ))}
        {uncatTotal > 0 && (
          <div className="flex justify-between px-4 py-1.5 border-b border-gray-50">
            <span className="text-sm text-gray-500">Sonstige Getränke</span>
            <span className="text-sm font-semibold">{fmt(uncatTotal)} €</span>
          </div>
        )}
        {cocktailTotal > 0 && (
          <div className="flex justify-between px-4 py-1.5 border-b border-gray-50">
            <span className="text-sm text-gray-500">Cocktails</span>
            <span className="text-sm font-semibold">{fmt(cocktailTotal)} €</span>
          </div>
        )}
        <div className="flex justify-between px-4 py-2.5 bg-gray-50">
          <span className="text-sm font-bold">Gesamt</span>
          <span className="text-sm font-bold text-gray-800">{fmt(grandTotal)} €</span>
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
  const [tab, setTab]               = useState<'planung' | 'cocktails'>('planung')

  const [newKatName, setNewKatName]     = useState('')
  const [newKatColor, setNewKatColor]   = useState(CATEGORY_COLORS[0])
  const [newKatAlcoholic, setNewKatAlcoholic] = useState(true)
  const [addingKat, setAddingKat]       = useState(false)
  const [showKatForm, setShowKatForm]   = useState(false)

  const [newCocktailName, setNewCocktailName]           = useState('')
  const [newCocktailAlcoholic, setNewCocktailAlcoholic] = useState(true)
  const [addingCocktail, setAddingCocktail]             = useState(false)

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
      event_id: eventId, name: p.name, color: p.color, is_alcoholic: p.is_alcoholic, sort_order: kategorien.length + i,
    }))
    const { data, error } = await supabase.from('getraenke_kategorien').insert(inserts).select()
    if (!error && data) setKategorien(prev => [...prev, ...data as Kategorie[]])
  }

  async function addKategorie() {
    if (!newKatName.trim()) return
    setAddingKat(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('getraenke_kategorien').insert({
      event_id: eventId, name: newKatName.trim(), color: newKatColor, is_alcoholic: newKatAlcoholic, sort_order: kategorien.length,
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

  if (loading) {
    return <div className="p-8 text-sm text-gray-400">Wird geladen…</div>
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight m-0">Getränke</h1>
        {guestCount > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">
            {guestCount} Personen
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 mb-6 bg-gray-100 rounded-lg p-0.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ fontFamily: 'inherit' }}
            className={[
              'flex-1 px-3 py-1.5 border-0 rounded-md text-sm cursor-pointer transition-all',
              tab === t.key
                ? 'bg-white text-gray-900 font-semibold shadow-sm'
                : 'bg-transparent text-gray-500 font-normal',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mengenplanung tab */}
      {tab === 'planung' && (
        <div>
          {kategorien.length === 0 && !showKatForm ? (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 px-6 py-8 text-center">
              <GlassWater size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">Noch keine Getränkekategorien angelegt</p>
              {canEdit && (
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={addPresetKategorien}
                    style={{ background: '#fff', color: '#B8943E', border: '1px solid #B8943E', fontFamily: 'inherit' }}
                    className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                  >
                    Standard-Kategorien laden
                  </button>
                  <button
                    onClick={() => setShowKatForm(true)}
                    style={{ fontFamily: 'inherit' }}
                    className="px-4 py-2 bg-transparent border border-gray-200 rounded-lg text-sm cursor-pointer text-gray-600"
                  >
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
                  onKatUpdate={updated => setKategorien(prev => prev.map(k2 => k2.id === updated.id ? updated : k2))}
                />
              ))}

              {/* Uncategorized items */}
              {artikel.filter(a => !a.kategorie_id).length > 0 && (
                <div className="mt-2">
                  {artikel.filter(a => !a.kategorie_id).map(a => (
                    <div key={a.id} className="text-sm px-3.5 py-1.5 bg-white rounded-lg border border-gray-100 mb-1">
                      {a.name}
                    </div>
                  ))}
                </div>
              )}

              {/* Add kategorie */}
              {canEdit && (
                showKatForm ? (
                  <div className="bg-white rounded-lg border border-gray-200 px-4 py-3.5 mt-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-2.5">Neue Kategorie</p>
                    <div className="flex gap-2 items-center mb-2.5">
                      <InlineInput value={newKatName} onChange={setNewKatName} placeholder="Kategoriename" style={{ flex: 1 }} />
                      <div className="flex gap-1">
                        {CATEGORY_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewKatColor(c)}
                            style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: newKatColor === c ? '2px solid #333' : '1px solid #ddd', cursor: 'pointer', padding: 0 }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <input
                        type="checkbox"
                        id="new-kat-alcoholic"
                        checked={newKatAlcoholic}
                        onChange={e => setNewKatAlcoholic(e.target.checked)}
                      />
                      <label htmlFor="new-kat-alcoholic" className="text-sm text-gray-600">Enthält Alkohol</label>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={addKategorie}
                        disabled={addingKat || !newKatName.trim()}
                        style={{ background: newKatColor, color: '#fff', border: 'none', fontFamily: 'inherit' }}
                        className="px-3.5 py-1.5 rounded-md text-sm cursor-pointer"
                      >
                        {addingKat ? '…' : 'Erstellen'}
                      </button>
                      <button
                        onClick={() => setShowKatForm(false)}
                        className="px-2.5 py-1.5 bg-transparent border border-gray-200 rounded-md text-sm cursor-pointer"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowKatForm(true)}
                    style={{ fontFamily: 'inherit' }}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-transparent border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer w-full mt-1"
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
            <div className="bg-white rounded-lg border border-dashed border-gray-300 px-6 py-8 text-center">
              <Wine size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Noch keine Cocktails geplant</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
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
            <div className="flex gap-2 items-center mt-3 px-3.5 py-2.5 bg-white rounded-lg border border-gray-100">
              <InlineInput
                value={newCocktailName}
                onChange={setNewCocktailName}
                placeholder="Cocktail-Name…"
                style={{ flex: 1 }}
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                <input type="checkbox" checked={newCocktailAlcoholic} onChange={e => setNewCocktailAlcoholic(e.target.checked)} />
                mit Alkohol
              </label>
              <button
                onClick={addCocktail}
                disabled={addingCocktail || !newCocktailName.trim()}
                style={{ background: newCocktailName.trim() ? '#8B2252' : '#eee', color: newCocktailName.trim() ? '#fff' : '#aaa', border: 'none', fontFamily: 'inherit' }}
                className="px-3.5 py-1.5 rounded-md text-sm cursor-pointer"
              >
                {addingCocktail ? '…' : 'Hinzufügen'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Budget footer — always visible below tabs */}
      <BudgetFooter kategorien={kategorien} artikel={artikel} cocktails={cocktails} />
    </div>
  )
}
