'use client'
import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, X, Check, MapPin, Clock } from 'lucide-react'

type Category = 'Zeremonie' | 'Empfang' | 'Feier' | 'Logistik'

const CATEGORY_COLORS: Record<Category, string> = {
  Zeremonie: '#AF52DE',
  Empfang:   '#FF9500',
  Feier:     '#007AFF',
  Logistik:  '#34C759',
}

interface ChecklistItem {
  text: string
  done: boolean
}

interface Responsibility {
  member_id: string
  initials: string
  task: string
  status: 'done' | 'pending'
}

interface TimelineEntry {
  id: string
  event_id: string
  title: string | null
  location: string | null
  sort_order: number
  start_minutes: number | null
  duration_minutes: number | null
  category: string | null
  checklist: ChecklistItem[]
  responsibilities: Responsibility[]
  created_at: string
}

interface Member {
  id: string
  user_id: string
  role: string
  profiles: { id: string; name: string } | null
}

interface Props {
  eventId: string
  initialEntries: TimelineEntry[]
  members: Member[]
}

function minutesToTime(m: number | null | undefined): string {
  if (m == null) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#fff',
  border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
  fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 5,
}

const CATEGORIES: Category[] = ['Zeremonie', 'Empfang', 'Feier', 'Logistik']

const EMPTY_FORM = {
  title: '', location: '', start_minutes: '',
  duration_minutes: '60', category: 'Feier' as Category,
}

export default function AblaufplanClient({ eventId, initialEntries, members }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [selected, setSelected] = useState<TimelineEntry | null>(null)
  const [filter, setFilter] = useState<Category | 'Alle'>('Alle')
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState<TimelineEntry | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const filtered = filter === 'Alle' ? entries : entries.filter(e => e.category === filter)

  function openAdd() {
    setEditEntry(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(e: TimelineEntry) {
    setEditEntry(e)
    setForm({
      title: e.title ?? '',
      location: e.location ?? '',
      start_minutes: minutesToTime(e.start_minutes),
      duration_minutes: String(e.duration_minutes ?? 60),
      category: (e.category as Category) ?? 'Feier',
    })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      event_id: eventId,
      title: form.title || null,
      location: form.location || null,
      start_minutes: form.start_minutes ? timeToMinutes(form.start_minutes) : null,
      duration_minutes: parseInt(form.duration_minutes) || 60,
      category: form.category,
      sort_order: form.start_minutes ? timeToMinutes(form.start_minutes) : 9999,
    }

    if (editEntry) {
      const { data } = await supabase.from('timeline_entries').update(payload).eq('id', editEntry.id).select().single()
      if (data) {
        const updated = { ...editEntry, ...data }
        setEntries(prev => prev.map(e => e.id === editEntry.id ? updated : e).sort((a, b) => (a.start_minutes ?? 9999) - (b.start_minutes ?? 9999)))
        if (selected?.id === editEntry.id) setSelected(updated)
      }
    } else {
      const { data } = await supabase.from('timeline_entries').insert({ ...payload, checklist: [], responsibilities: [] }).select().single()
      if (data) setEntries(prev => [...prev, data].sort((a, b) => (a.start_minutes ?? 9999) - (b.start_minutes ?? 9999)))
    }

    setShowModal(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('timeline_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function toggleChecklist(entry: TimelineEntry, idx: number) {
    const newList = entry.checklist.map((item, i) => i === idx ? { ...item, done: !item.done } : item)
    await supabase.from('timeline_entries').update({ checklist: newList }).eq('id', entry.id)
    const updated = { ...entry, checklist: newList }
    setEntries(prev => prev.map(e => e.id === entry.id ? updated : e))
    setSelected(updated)
  }

  async function addChecklistItem(entry: TimelineEntry, text: string) {
    if (!text.trim()) return
    const newList = [...entry.checklist, { text: text.trim(), done: false }]
    await supabase.from('timeline_entries').update({ checklist: newList }).eq('id', entry.id)
    const updated = { ...entry, checklist: newList }
    setEntries(prev => prev.map(e => e.id === entry.id ? updated : e))
    setSelected(updated)
  }

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      {/* Left: Timeline list */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 28, fontWeight: 600 }}>Ablaufplan</h1>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            <Plus size={14} /> Punkt hinzufügen
          </button>
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['Alle', ...CATEGORIES] as (Category | 'Alle')[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              data-sel={filter === cat ? '1' : undefined}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 13, border: 'none', cursor: 'pointer',
                background: filter === cat ? (cat === 'Alle' ? 'var(--black)' : CATEGORY_COLORS[cat as Category]) : 'var(--surface2)',
                color: filter === cat ? '#fff' : 'var(--text-mid)',
                fontWeight: filter === cat ? 600 : 400,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Timeline entries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14, fontStyle: 'italic' }}>
              Keine Einträge vorhanden. Füge einen neuen Ablaufpunkt hinzu.
            </div>
          )}
          {filtered.map(entry => {
            const cat = entry.category as Category
            const color = cat ? CATEGORY_COLORS[cat] : '#999'
            const isSelected = selected?.id === entry.id
            return (
              <div
                key={entry.id}
                onClick={() => setSelected(isSelected ? null : entry)}
                style={{
                  display: 'flex', gap: 16, padding: '14px 16px',
                  background: isSelected ? 'var(--gold-pale)' : 'var(--surface)',
                  border: `1px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                  borderLeft: `4px solid ${color}`,
                  borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{minutesToTime(entry.start_minutes)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{entry.duration_minutes ?? '?'} min</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{entry.title ?? 'Unbenannt'}</div>
                  {entry.location && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} />{entry.location}
                    </div>
                  )}
                  {entry.checklist.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                      ✓ {entry.checklist.filter(c => c.done).length}/{entry.checklist.length} Aufgaben
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                    background: color + '20', color,
                  }}>{cat ?? '—'}</span>
                  <button onClick={e => { e.stopPropagation(); openEdit(entry) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--text-dim)' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(entry.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--text-dim)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: Detail panel */}
      {selected && (
        <div style={{ width: 320, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 22, overflowY: 'auto', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 16, fontWeight: 600 }}>{selected.title ?? 'Details'}</h3>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-dim)' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {selected.start_minutes != null && (
              <InfoChip icon={<Clock size={12} />} text={`${minutesToTime(selected.start_minutes)} · ${selected.duration_minutes ?? '?'} min`} />
            )}
            {selected.location && <InfoChip icon={<MapPin size={12} />} text={selected.location} />}
          </div>

          {/* Checklist */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 10 }}>Checkliste</div>
            {selected.checklist.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }} onClick={() => toggleChecklist(selected, i)}>
                <div style={{
                  width: 16, height: 16, borderRadius: 3, border: `2px solid ${item.done ? 'var(--green)' : 'var(--border2)'}`,
                  background: item.done ? 'var(--green)' : 'transparent', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.done && <Check size={10} color="#fff" strokeWidth={3} />}
                </div>
                <span style={{ fontSize: 13, color: item.done ? 'var(--text-dim)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>
                  {item.text}
                </span>
              </div>
            ))}
            <AddChecklistItem onAdd={text => addChecklistItem(selected, text)} />
          </div>

          {/* Responsibilities */}
          {selected.responsibilities.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 10 }}>Verantwortliche</div>
              {selected.responsibilities.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--gold-pale)', color: 'var(--gold)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {r.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{r.task}</div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11,
                    background: r.status === 'done' ? 'var(--green-pale)' : 'var(--surface2)',
                    color: r.status === 'done' ? 'var(--green)' : 'var(--text-dim)',
                  }}>{r.status === 'done' ? 'Erledigt' : 'Ausstehend'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: 28, width: 440, maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 20, fontWeight: 600, marginBottom: 22 }}>
              {editEntry ? 'Punkt bearbeiten' : 'Neuer Ablaufpunkt'}
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Titel</label>
              <input style={inputSt} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Standesamtliche Trauung" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Startzeit</label>
                <input type="time" style={inputSt} value={form.start_minutes} onChange={e => setForm(f => ({ ...f, start_minutes: e.target.value }))} />
              </div>
              <div>
                <label style={labelSt}>Dauer (Minuten)</label>
                <input type="number" min={5} step={5} style={inputSt} value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Ort / Location</label>
              <input style={inputSt} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="z.B. Kapelle, Saal A" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>Kategorie</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat }))}
                    data-sel={form.category === cat ? '1' : undefined}
                    style={{
                      padding: '5px 14px', borderRadius: 20, fontSize: 13, border: 'none', cursor: 'pointer',
                      background: form.category === cat ? CATEGORY_COLORS[cat] : 'var(--surface2)',
                      color: form.category === cat ? '#fff' : 'var(--text-mid)',
                      fontWeight: form.category === cat ? 600 : 400,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: saving ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}>
                {saving ? 'Speichern…' : editEntry ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'var(--surface2)', borderRadius: 12, fontSize: 12, color: 'var(--text-mid)' }}>
      {icon}{text}
    </span>
  )
}

function AddChecklistItem({ onAdd }: { onAdd: (text: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <input
        style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { onAdd(val); setVal('') } }}
        placeholder="Aufgabe hinzufügen…"
      />
      <button
        onClick={() => { onAdd(val); setVal('') }}
        style={{ padding: '6px 10px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 13 }}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
