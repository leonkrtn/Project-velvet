'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Trash2, X, GlassWater, Wine, Beer, Calculator,
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

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

function FieldInput({
  value, onChange, placeholder, type = 'text',
}: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      style={{
        width: '100%', padding: '6px 8px',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
        outline: 'none', background: '#fff', boxSizing: 'border-box',
      }}
    />
  )
}

// ── Artikel card ──────────────────────────────────────────────────────────────

function ArtikelCard({
  artikel, canEdit, guestCount, onChange, onDelete,
}: {
  artikel: Artikel; canEdit: boolean; guestCount: number
  onChange: (a: Artikel) => void; onDelete: () => void
}) {
  const [draft, setDraft]       = useState(artikel)
  const debouncedDraft          = useDebounce(draft, 600)
  const savedRef                = useRef(artikel)

  useEffect(() => {
    if (JSON.stringify(debouncedDraft) === JSON.stringify(savedRef.current)) return
    savedRef.current = debouncedDraft
    createClient().from('getraenke_artikel').update({
      name:              debouncedDraft.name,
      unit:              debouncedDraft.unit,
      amount_per_person: debouncedDraft.amount_per_person,
      total_planned:     debouncedDraft.total_planned,
      price_per_unit:    debouncedDraft.price_per_unit,
      notes:             debouncedDraft.notes,
    }).eq('id', artikel.id).then(({ error }) => {
      if (!error) onChange(debouncedDraft)
    })
  }, [debouncedDraft]) // eslint-disable-line react-hooks/exhaustive-deps

  function setField<K extends keyof Artikel>(key: K, val: Artikel[K]) {
    setDraft(p => {
      const next = { ...p, [key]: val }
      if (key === 'amount_per_person' && guestCount > 0) {
        const perP = typeof val === 'number' ? val : parseFloat(val as string) || 0
        next.total_planned = perP > 0 ? Math.ceil(perP * guestCount) : 0
      }
      return next
    })
  }

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
    <div style={{
      background: 'var(--surface, #fff)',
      border: '1px solid var(--border, #e8e8e8)',
      borderRadius: 10,
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {canEdit ? (
          <input
            value={draft.name}
            onChange={e => setField('name', e.target.value)}
            style={{
              flex: 1, fontSize: 14, fontWeight: 600, color: '#1a1a1a',
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'inherit', padding: 0,
            }}
            placeholder="Bezeichnung"
          />
        ) : (
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{draft.name}</span>
        )}
        {canEdit && (
          <button
            onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <Trash2 size={12} style={{ color: '#e05252' }} />
          </button>
        )}
      </div>

      {/* 3 info blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {/* Block 1: Gesamt (read-only) + Einheit */}
        <div style={{ background: 'var(--bg, #f5f5f7)', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 4 }}>Gesamt</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #1a1a1a)', lineHeight: 1.2 }}>
            {draft.total_planned || <span style={{ color: '#ccc' }}>—</span>}
          </div>
          {canEdit ? (
            <select
              value={draft.unit}
              onChange={e => setField('unit', e.target.value)}
              style={{ fontSize: 11, color: 'var(--text-secondary, #888)', border: 'none', background: 'transparent', padding: 0, marginTop: 3, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%' }}
            >
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)', marginTop: 3 }}>{draft.unit}</div>
          )}
        </div>

        {/* Block 2: Pro Person (editable) */}
        <div style={{ background: 'var(--bg, #f5f5f7)', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 4 }}>Pro Person</div>
          {canEdit ? (
            <input
              type="number"
              value={draft.amount_per_person || ''}
              onChange={e => setField('amount_per_person', parseFloat(e.target.value) || 0)}
              placeholder="0"
              style={{
                width: '100%', fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #1a1a1a)',
                border: 'none', background: 'transparent', padding: 0, outline: 'none', fontFamily: 'inherit',
              }}
            />
          ) : (
            <div style={{ fontSize: 17, fontWeight: 700 }}>{draft.amount_per_person || '—'}</div>
          )}
        </div>

        {/* Block 3: Preis pro Stück */}
        <div style={{ background: 'var(--bg, #f5f5f7)', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 4 }}>Preis / Stk</div>
          {canEdit ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <input
                type="number"
                value={draft.price_per_unit || ''}
                onChange={e => setField('price_per_unit', parseFloat(e.target.value) || 0)}
                placeholder="0"
                style={{
                  flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700,
                  border: 'none', background: 'transparent', padding: 0, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #aaa)', flexShrink: 0 }}>€</span>
            </div>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(draft.price_per_unit)} €</div>
          )}
          {lineTotal > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text-tertiary, #bbb)', marginTop: 3 }}>= {fmt(lineTotal)} €</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Kategorie section ─────────────────────────────────────────────────────────

function KategorieSection({
  kat, artikel, canEdit, guestCount,
  onArtikelChange, onArtikelDelete, onArtikelAdd, onKatDelete,
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
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName]         = useState('')
  const [addUnit, setAddUnit]         = useState('Flasche')
  const [addAmt, setAddAmt]           = useState('')
  const [addPrice, setAddPrice]       = useState('')
  const [saving, setSaving]           = useState(false)

  const totalBudget = artikel.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)

  async function addArtikel() {
    if (!addName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const perPerson = parseFloat(addAmt) || 0
    const total = perPerson > 0 && guestCount > 0 ? Math.ceil(perPerson * guestCount) : 0
    const { data, error } = await supabase.from('getraenke_artikel').insert({
      event_id:         kat.event_id,
      kategorie_id:     kat.id,
      name:             addName.trim(),
      unit:             addUnit,
      amount_per_person: perPerson,
      total_planned:    total,
      price_per_unit:   parseFloat(addPrice) || 0,
      sort_order:       artikel.length,
    }).select().single()
    setSaving(false)
    if (!error && data) {
      onArtikelAdd(data as Artikel)
      setAddName(''); setAddAmt(''); setAddPrice(''); setAddUnit('Flasche')
      setShowAddForm(false)
    }
  }

  return (
    <div style={{
      background: 'var(--surface, #fff)',
      borderRadius: 12,
      border: '1px solid var(--border, #e8e8e8)',
      borderLeft: `4px solid ${kat.color}`,
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      {/* ── Category header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '13px 16px',
        borderBottom: artikel.length > 0 || canEdit ? '1px solid var(--border, #f0f0f0)' : undefined,
      }}>
        {/* Alkohol/Alkoholfrei icon */}
        {kat.is_alcoholic
          ? <Wine size={15} style={{ color: kat.color, flexShrink: 0 }} />
          : <GlassWater size={15} style={{ color: kat.color, flexShrink: 0 }} />
        }
        <span style={{ fontSize: 15, fontWeight: 700, flex: 1, color: 'var(--text-primary, #1a1a1a)' }}>
          {kat.name}
        </span>
        {(artikel.length > 0 || totalBudget > 0) && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary, #aaa)' }}>
            {artikel.length} Artikel{totalBudget > 0 ? ` · ${fmt(totalBudget)} €` : ''}
          </span>
        )}
        {canEdit && (
          <button
            onClick={e => { e.stopPropagation(); onKatDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.35, padding: '2px 4px', display: 'flex', alignItems: 'center' }}
            title="Kategorie löschen"
          >
            <Trash2 size={13} style={{ color: '#e05252' }} />
          </button>
        )}
      </div>

      {/* ── Article grid ── */}
      <div style={{ padding: '14px 16px' }}>
        {artikel.length === 0 && !canEdit && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary, #aaa)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
            Keine Artikel
          </p>
        )}

        {artikel.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
            marginBottom: canEdit ? 10 : 0,
          }}>
            {artikel.map(a => (
              <ArtikelCard
                key={a.id}
                artikel={a}
                canEdit={canEdit}
                guestCount={guestCount}
                onChange={onArtikelChange}
                onDelete={() => onArtikelDelete(a.id)}
              />
            ))}
          </div>
        )}

        {/* ── Add artikel ── */}
        {canEdit && (
          showAddForm ? (
            <div style={{
              marginTop: artikel.length > 0 ? 0 : 0,
              background: 'var(--bg, #f5f5f7)',
              borderRadius: 8,
              border: '1px dashed var(--border, #ddd)',
              padding: '12px 14px',
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', margin: '0 0 10px' }}>
                Neuer Artikel
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 8 }}>
                <FieldInput value={addName} onChange={setAddName} placeholder="Bezeichnung" />
                <select
                  value={addUnit}
                  onChange={e => setAddUnit(e.target.value)}
                  style={{ padding: '6px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
                >
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <FieldInput value={addAmt} onChange={setAddAmt} placeholder="Menge pro Person" type="number" />
                <FieldInput value={addPrice} onChange={setAddPrice} placeholder="Preis / Stk (€)" type="number" />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={addArtikel}
                  disabled={saving || !addName.trim()}
                  style={{
                    padding: '6px 14px', background: addName.trim() ? 'var(--accent, #1a1a1a)' : '#e0e0e0',
                    color: addName.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 6,
                    fontSize: 13, cursor: addName.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? '…' : 'Hinzufügen'}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setAddName(''); setAddAmt(''); setAddPrice('') }}
                  style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border, #ddd)', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary, #666)' }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', padding: '9px 12px',
                background: 'none', border: '1px dashed var(--border, #ddd)',
                borderRadius: 8, fontSize: 13, color: 'var(--text-tertiary, #aaa)',
                cursor: 'pointer', fontFamily: 'inherit',
                marginTop: artikel.length > 0 ? 0 : 0,
              }}
            >
              <Plus size={14} /> Artikel hinzufügen
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── Cocktail card ─────────────────────────────────────────────────────────────

function CocktailCard({ cocktail, canEdit, onChange, onDelete }: {
  cocktail: Cocktail; canEdit: boolean; onChange: (c: Cocktail) => void; onDelete: () => void
}) {
  const [open, setOpen]       = useState(false)
  const [draft, setDraft]     = useState(cocktail)
  const [saving, setSaving]   = useState(false)
  const [newIngr, setNewIngr] = useState<Ingredient>({ name: '', amount: '', unit: 'ml' })

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('getraenke_cocktails').update({
      name:           draft.name,
      description:    draft.description,
      is_alcoholic:   draft.is_alcoholic,
      planned_count:  draft.planned_count,
      price_per_unit: draft.price_per_unit,
      ingredients:    draft.ingredients,
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
  const cocktailTotal = (cocktail.price_per_unit ?? 0) > 0 && cocktail.planned_count > 0
    ? (cocktail.price_per_unit ?? 0) * cocktail.planned_count : 0

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border, #e8e8e8)', overflow: 'hidden', background: 'var(--surface, #fff)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', cursor: canEdit ? 'pointer' : 'default', background: `${color}08` }}
        onClick={() => canEdit && setOpen(p => !p)}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{cocktail.name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #aaa)' }}>{cocktail.is_alcoholic ? 'mit Alkohol' : 'alkoholfrei'}</span>
        {cocktailTotal > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #666)' }}>
            {fmt(cocktail.price_per_unit)} € × {cocktail.planned_count} = {fmt(cocktailTotal)} €
          </span>
        )}
        {cocktail.planned_count > 0 && cocktailTotal === 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color }}>{cocktail.planned_count}×</span>
        )}
        {!canEdit && cocktail.ingredients.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 11, color: 'var(--text-tertiary, #aaa)' }}
          >
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

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 5 }}>Preis pro Stück (€)</label>
                <FieldInput value={draft.price_per_unit || ''} onChange={v => setDraft(p => ({ ...p, price_per_unit: parseFloat(v) || 0 }))} type="number" placeholder="0,00" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 5 }}>Beschreibung</label>
                <textarea
                  value={draft.description}
                  onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="Kurze Beschreibung oder Servierhinweis…"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id={`alc-${cocktail.id}`} checked={draft.is_alcoholic} onChange={e => setDraft(p => ({ ...p, is_alcoholic: e.target.checked }))} />
                <label htmlFor={`alc-${cocktail.id}`} style={{ fontSize: 13 }}>Enthält Alkohol</label>
              </div>

              {/* Ingredients */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 8 }}>Zutaten</label>
                {draft.ingredients.map((ingr, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, flex: 1 }}>{ingr.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>{ingr.amount} {ingr.unit}</span>
                    <button onClick={() => removeIngr(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, padding: 2 }}>
                      <X size={12} style={{ color: '#e05252' }} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <FieldInput value={newIngr.name} onChange={v => setNewIngr(p => ({ ...p, name: v }))} placeholder="Zutat" />
                  <FieldInput value={newIngr.amount} onChange={v => setNewIngr(p => ({ ...p, amount: v }))} placeholder="Menge" />
                  <input
                    value={newIngr.unit}
                    onChange={e => setNewIngr(p => ({ ...p, unit: e.target.value }))}
                    placeholder="ml"
                    style={{ width: 54, padding: '6px 8px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <button
                    onClick={addIngr}
                    disabled={!newIngr.name.trim()}
                    style={{ padding: '6px 10px', background: newIngr.name.trim() ? color : '#eee', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Plus size={12} style={{ color: newIngr.name.trim() ? '#fff' : '#aaa' }} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{ padding: '7px 16px', background: 'var(--accent, #1a1a1a)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {saving ? '…' : 'Speichern'}
                </button>
                <button
                  onClick={() => { setDraft(cocktail); setOpen(false) }}
                  style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border, #ddd)', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
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

function BudgetFooter({ kategorien, artikel, cocktails }: {
  kategorien: Kategorie[]; artikel: Artikel[]; cocktails: Cocktail[]
}) {
  const artikelRows = kategorien.map(k => {
    const items = artikel.filter(a => a.kategorie_id === k.id)
    const total = items.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
    return { ...k, total, count: items.reduce((s, a) => s + a.total_planned, 0) }
  }).filter(r => r.total > 0)

  const uncategorized = artikel.filter(a => !a.kategorie_id)
  const uncatTotal    = uncategorized.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
  const artikelTotal  = artikel.reduce((s, a) => s + a.total_planned * a.price_per_unit, 0)
  const cocktailTotal = cocktails.reduce((s, c) => s + (c.price_per_unit ?? 0) * c.planned_count, 0)
  const grandTotal    = artikelTotal + cocktailTotal

  if (grandTotal === 0) return null

  return (
    <div style={{ background: 'var(--surface, #fff)', borderRadius: 12, border: '1px solid var(--border, #e8e8e8)', overflow: 'hidden', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderBottom: '1px solid var(--border, #f0f0f0)', background: 'var(--bg, #f5f5f7)' }}>
        <Calculator size={14} style={{ color: 'var(--text-tertiary, #aaa)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)' }}>Budget-Übersicht</span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {artikelRows.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', borderBottom: '1px solid var(--bg, #f8f8f8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color }} />
              <span style={{ fontSize: 13 }}>{r.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #bbb)' }}>({r.count} Stk.)</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(r.total)} €</span>
          </div>
        ))}
        {uncatTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px', borderBottom: '1px solid var(--bg, #f8f8f8)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary, #888)' }}>Sonstige Getränke</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(uncatTotal)} €</span>
          </div>
        )}
        {cocktailTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px', borderBottom: '1px solid var(--bg, #f8f8f8)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary, #888)' }}>Cocktails</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(cocktailTotal)} €</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', background: 'var(--bg, #f5f5f7)' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Gesamt</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(grandTotal)} €</span>
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

  const [newKatName, setNewKatName]         = useState('')
  const [newKatColor, setNewKatColor]       = useState(CATEGORY_COLORS[0])
  const [newKatAlcoholic, setNewKatAlcoholic] = useState(true)
  const [addingKat, setAddingKat]           = useState(false)
  const [showKatForm, setShowKatForm]       = useState(false)

  const [newCocktailName, setNewCocktailName]               = useState('')
  const [newCocktailAlcoholic, setNewCocktailAlcoholic]     = useState(true)
  const [addingCocktail, setAddingCocktail]                 = useState(false)

  const canEdit = mode !== 'dienstleister'

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('getraenke_kategorien').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('getraenke_artikel').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('getraenke_cocktails').select('*').eq('event_id', eventId).order('sort_order'),
    ]).then(([{ data: k }, { data: a }, { data: c }]) => {
      setKategorien((k ?? []).map(row => ({ ...row, is_alcoholic: row.is_alcoholic ?? true })))
      setArtikel(a ?? [])
      setCocktails((c ?? []).map(row => ({ ...row, price_per_unit: row.price_per_unit ?? 0, ingredients: row.ingredients ?? [] })))
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
    const supabase = createClient()
    const { data, error } = await supabase.from('getraenke_cocktails').insert({
      event_id: eventId, name: newCocktailName.trim(), is_alcoholic: newCocktailAlcoholic, sort_order: cocktails.length,
    }).select().single()
    setAddingCocktail(false)
    if (!error && data) {
      setCocktails(prev => [...prev, { ...(data as Omit<Cocktail, 'ingredients' | 'price_per_unit'>), ingredients: [], price_per_unit: 0 } as Cocktail])
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>Getränke</h1>
        {guestCount > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #888)', background: 'var(--bg, #f5f5f7)', borderRadius: 20, padding: '4px 12px' }}>
            {guestCount} Personen
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: 'var(--bg, #f5f5f7)', borderRadius: 8, padding: 3 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '7px 12px', border: 'none', borderRadius: 6, fontSize: 13,
              fontFamily: 'inherit', cursor: 'pointer',
              fontWeight: tab === t.key ? 600 : 400,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? 'var(--text-primary, #1a1a1a)' : 'var(--text-secondary, #888)',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Mengenplanung tab ── */}
      {tab === 'planung' && (
        <div>
          {kategorien.length === 0 && !showKatForm ? (
            <div style={{ background: 'var(--surface, #fff)', borderRadius: 10, border: '1px dashed var(--border, #ddd)', padding: '32px 24px', textAlign: 'center' }}>
              <GlassWater size={32} style={{ color: 'var(--text-tertiary, #ccc)', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: 14, color: 'var(--text-secondary, #888)', marginBottom: 16 }}>Noch keine Getränkekategorien angelegt</p>
              {canEdit && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={addPresetKategorien}
                    style={{ padding: '8px 16px', background: '#fff', color: '#B8943E', border: '1px solid #B8943E', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Standard-Kategorien laden
                  </button>
                  <button
                    onClick={() => setShowKatForm(true)}
                    style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border, #ddd)', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary, #666)' }}
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
                />
              ))}

              {/* Uncategorized items */}
              {artikel.filter(a => !a.kategorie_id).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {artikel.filter(a => !a.kategorie_id).map(a => (
                    <div key={a.id} style={{ fontSize: 13, padding: '6px 14px', background: 'var(--surface, #fff)', borderRadius: 7, border: '1px solid var(--border, #eee)', marginBottom: 4 }}>
                      {a.name}
                    </div>
                  ))}
                </div>
              )}

              {/* Add kategorie */}
              {canEdit && (
                showKatForm ? (
                  <div style={{ background: 'var(--surface, #fff)', borderRadius: 10, border: '1px solid var(--border, #e5e7eb)', padding: '14px 16px', marginTop: 4 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary, #aaa)', marginBottom: 10 }}>Neue Kategorie</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <FieldInput value={newKatName} onChange={setNewKatName} placeholder="Kategoriename" />
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {CATEGORY_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewKatColor(c)}
                            style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: newKatColor === c ? '2px solid #333' : '1px solid #ddd', cursor: 'pointer', padding: 0 }}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <input type="checkbox" id="new-kat-alcoholic" checked={newKatAlcoholic} onChange={e => setNewKatAlcoholic(e.target.checked)} />
                      <label htmlFor="new-kat-alcoholic" style={{ fontSize: 13, color: 'var(--text-secondary, #666)' }}>Enthält Alkohol</label>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={addKategorie}
                        disabled={addingKat || !newKatName.trim()}
                        style={{ padding: '6px 14px', background: newKatColor, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {addingKat ? '…' : 'Erstellen'}
                      </button>
                      <button
                        onClick={() => setShowKatForm(false)}
                        style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border, #ddd)', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowKatForm(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '9px 14px', background: 'none', border: '1px dashed var(--border, #ddd)',
                      borderRadius: 8, fontSize: 13, color: 'var(--text-secondary, #888)',
                      cursor: 'pointer', fontFamily: 'inherit', width: '100%', marginTop: 4,
                    }}
                  >
                    <Plus size={14} /> Kategorie hinzufügen
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* ── Cocktailplanung tab ── */}
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, padding: '10px 14px', background: 'var(--surface, #fff)', borderRadius: 8, border: '1px solid var(--border, #eee)' }}>
              <FieldInput value={newCocktailName} onChange={setNewCocktailName} placeholder="Cocktail-Name…" />
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary, #666)', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={newCocktailAlcoholic} onChange={e => setNewCocktailAlcoholic(e.target.checked)} />
                mit Alkohol
              </label>
              <button
                onClick={addCocktail}
                disabled={addingCocktail || !newCocktailName.trim()}
                style={{
                  padding: '6px 14px',
                  background: newCocktailName.trim() ? 'var(--accent, #1a1a1a)' : '#eee',
                  color: newCocktailName.trim() ? '#fff' : '#aaa',
                  border: 'none', borderRadius: 6, fontSize: 13, cursor: newCocktailName.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
                }}
              >
                {addingCocktail ? '…' : 'Hinzufügen'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Budget footer */}
      <BudgetFooter kategorien={kategorien} artikel={artikel} cocktails={cocktails} />
    </div>
  )
}
