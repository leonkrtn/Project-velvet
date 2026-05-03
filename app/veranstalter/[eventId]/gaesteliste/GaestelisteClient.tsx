'use client'
import React, { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Search, X } from 'lucide-react'

interface Guest {
  id: string
  name: string
  status: string
  side: string | null
  allergy_tags: string[]
  allergy_custom: string | null
  meal_choice: string | null
}

interface Props {
  eventId: string
  initialGuests: Guest[]
  mealOptions: string[]
}

const STATUS_OPTIONS = ['angelegt', 'eingeladen', 'zugesagt', 'abgesagt']
const STATUS_LABELS: Record<string, string> = {
  angelegt: 'Angelegt', eingeladen: 'Eingeladen', zugesagt: 'Zugesagt', abgesagt: 'Abgesagt',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  zugesagt: { bg: '#EAF5EE', color: '#3D7A56' },
  abgesagt: { bg: '#FDEAEA', color: '#A04040' },
  eingeladen: { bg: '#FFF8E6', color: '#B8860B' },
  angelegt: { bg: '#F0F0F0', color: '#666' },
}
const SIDE_OPTIONS = ['Braut', 'Bräutigam', 'Beide']
const ALLERGY_TAGS = ['Glutenfrei', 'Laktosefrei', 'Vegan', 'Vegetarisch', 'Nussallergie', 'Sonstige']

export default function GaestelisteClient({ eventId, initialGuests, mealOptions }: Props) {
  const supabase = createClient()
  const [guests, setGuests] = useState<Guest[]>(initialGuests)
  const [query, setQuery] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<Partial<Guest>>({})

  const filtered = guests.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
  const zugesagt = guests.filter(g => g.status === 'zugesagt').length

  const openEdit = useCallback((g: Guest) => {
    setEditId(g.id)
    setForm({ name: g.name, status: g.status, side: g.side, allergy_tags: g.allergy_tags ?? [], allergy_custom: g.allergy_custom, meal_choice: g.meal_choice })
    setShowAdd(false)
  }, [])

  const openAdd = useCallback(() => {
    setEditId(null)
    setForm({ name: '', status: 'angelegt', side: null, allergy_tags: [], allergy_custom: null, meal_choice: null })
    setShowAdd(true)
  }, [])

  const closeForm = useCallback(() => {
    setEditId(null)
    setShowAdd(false)
    setForm({})
  }, [])

  const saveGuest = useCallback(async () => {
    if (!form.name?.trim()) return
    setSaving(true)
    try {
      if (editId) {
        const { error } = await supabase.from('guests').update({
          name: form.name!.trim(),
          status: form.status ?? 'angelegt',
          side: form.side ?? null,
          allergy_tags: form.allergy_tags ?? [],
          allergy_custom: form.allergy_custom ?? null,
          meal_choice: form.meal_choice ?? null,
        }).eq('id', editId)
        if (!error) {
          setGuests(prev => prev.map(g => g.id === editId ? { ...g, ...form, name: form.name!.trim() } as Guest : g))
        }
      } else {
        const { data, error } = await supabase.from('guests').insert({
          event_id: eventId,
          name: form.name!.trim(),
          status: form.status ?? 'angelegt',
          side: form.side ?? null,
          allergy_tags: form.allergy_tags ?? [],
          allergy_custom: form.allergy_custom ?? null,
          meal_choice: form.meal_choice ?? null,
        }).select('id, name, status, side, allergy_tags, allergy_custom, meal_choice').single()
        if (!error && data) {
          setGuests(prev => [...prev, data as Guest].sort((a, b) => a.name.localeCompare(b.name)))
        }
      }
      closeForm()
    } finally {
      setSaving(false)
    }
  }, [editId, form, eventId, supabase, closeForm])

  const deleteGuest = useCallback(async (id: string) => {
    const { error } = await supabase.from('guests').delete().eq('id', id)
    if (!error) {
      setGuests(prev => prev.filter(g => g.id !== id))
      if (editId === id) closeForm()
    }
  }, [editId, supabase, closeForm])

  const toggleAllergyTag = useCallback((tag: string) => {
    setForm(prev => {
      const tags = prev.allergy_tags ?? []
      return { ...prev, allergy_tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] }
    })
  }, [])

  const formPanel = (showAdd || editId) ? (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{editId ? 'Gast bearbeiten' : 'Neuer Gast'}</h3>
        <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Name</label>
          <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Status</label>
          <select value={form.status ?? 'angelegt'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Seite</label>
          <select value={form.side ?? ''} onChange={e => setForm(f => ({ ...f, side: e.target.value || null }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }}>
            <option value="">—</option>
            {SIDE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Essenswahl</label>
          <select value={form.meal_choice ?? ''} onChange={e => setForm(f => ({ ...f, meal_choice: e.target.value || null }))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }}>
            <option value="">—</option>
            {mealOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>Allergien</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALLERGY_TAGS.map(tag => {
            const active = (form.allergy_tags ?? []).includes(tag)
            return (
              <button key={tag} type="button" onClick={() => toggleAllergyTag(tag)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                background: active ? '#FEF2F2' : '#fff',
                borderColor: active ? 'rgba(220,38,38,0.3)' : 'var(--border)',
                color: active ? '#DC2626' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400, fontFamily: 'inherit',
              }}>{tag}</button>
            )
          })}
        </div>
        <input value={form.allergy_custom ?? ''} onChange={e => setForm(f => ({ ...f, allergy_custom: e.target.value || null }))}
          placeholder="Sonstiges…" style={{ marginTop: 8, width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {editId && (
          <button onClick={() => deleteGuest(editId)} style={{ padding: '8px 14px', background: '#FEF2F2', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={13} /> Löschen
          </button>
        )}
        <button onClick={closeForm} style={{ padding: '8px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
        <button onClick={saveGuest} disabled={saving || !form.name?.trim()} style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 500, opacity: saving || !form.name?.trim() ? 0.6 : 1 }}>
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  ) : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Gästeliste</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{zugesagt} zugesagt · {guests.length} gesamt</p>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          <Plus size={15} /> Gast hinzufügen
        </button>
      </div>

      {formPanel}

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Gast suchen…"
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 160px', padding: '10px 20px', background: '#F5F5F7', borderBottom: '1px solid var(--border)' }}>
          {['Name', 'Seite', 'Menü', 'Allergien'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{h}</span>
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>Keine Gäste gefunden</div>
        )}
        {filtered.map(g => {
          const st = STATUS_STYLE[g.status] ?? STATUS_STYLE.angelegt
          return (
            <div key={g.id} onClick={() => openEdit(g)} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 160px', padding: '12px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>
                  {STATUS_LABELS[g.status] ?? g.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.side ?? '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{g.meal_choice ?? '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {[...(g.allergy_tags ?? []), g.allergy_custom].filter(Boolean).join(', ') || '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
