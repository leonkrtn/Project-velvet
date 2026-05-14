'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, X, Check, MapPin, Clock } from 'lucide-react'
import TimeInput from '@/components/ui/TimeInput'

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

interface AssignedStaff {
  id: string
  name: string
  role_category: string | null
}

interface AssignedVendor {
  id: string
  name: string
  category: string | null
}

interface AssignedMember {
  id: string
  name: string
  role: string
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
  assigned_staff: AssignedStaff[]
  assigned_vendors: AssignedVendor[]
  assigned_members: AssignedMember[]
  created_at: string
}

interface Member {
  id: string
  user_id: string
  role: string
  profiles: { id: string; name: string } | null
}

interface StaffRow { id: string; name: string; role_category: string | null }
interface VendorRow { id: string; name: string; category: string | null }

interface Props {
  eventId: string
  initialEntries: TimelineEntry[]
  members: Member[]
  staff: StaffRow[]
  vendors: VendorRow[]
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
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5,
}

const CATEGORIES: Category[] = ['Zeremonie', 'Empfang', 'Feier', 'Logistik']

const EMPTY_FORM = {
  title: '', location: '', start_minutes: '',
  duration_minutes: '60', category: 'Feier' as Category,
}

export default function AblaufplanClient({ eventId, initialEntries, members, staff: initialStaff, vendors }: Props) {
  const [entries, setEntries] = useState(initialEntries.map(e => ({
    ...e,
    assigned_staff: e.assigned_staff ?? [],
    assigned_vendors: e.assigned_vendors ?? [],
    assigned_members: e.assigned_members ?? [],
  })))
  const [selected, setSelected] = useState<TimelineEntry | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelSaved, setPanelSaved] = useState(false)

  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const panelSaveTimer = useRef<ReturnType<typeof setTimeout>>()
  const [filter, setFilter] = useState<Category | 'Alle'>('Alle')
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff)
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState<TimelineEntry | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('organizer_staff').select('id, name, role_category').eq('organizer_id', user.id).order('name')
        .then(({ data }) => { if (data) setStaff(data) })
    })
  }, [])

  const filtered = filter === 'Alle' ? entries : entries.filter(e => e.category === filter)

  function selectEntry(entry: TimelineEntry | null) {
    clearTimeout(panelSaveTimer.current)
    setSelected(entry)
  }

  function updatePanel(updated: TimelineEntry) {
    setSelected(updated)
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
    clearTimeout(panelSaveTimer.current)
    panelSaveTimer.current = setTimeout(async () => {
      const s = selectedRef.current
      if (!s) return
      setPanelSaving(true)
      await supabase.from('timeline_entries').update({
        checklist: s.checklist,
        assigned_staff: s.assigned_staff,
        assigned_vendors: s.assigned_vendors,
        assigned_members: s.assigned_members,
      }).eq('id', s.id)
      setPanelSaving(false)
      setPanelSaved(true)
      setTimeout(() => setPanelSaved(false), 2500)
    }, 800)
  }

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
        if (selected?.id === editEntry.id) { setSelected(updated) }
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
    if (selected?.id === id) selectEntry(null)
  }

  function toggleChecklist(entry: TimelineEntry, idx: number) {
    const newList = entry.checklist.map((item, i) => i === idx ? { ...item, done: !item.done } : item)
    updatePanel({ ...entry, checklist: newList })
  }

  function deleteChecklistItem(entry: TimelineEntry, idx: number) {
    updatePanel({ ...entry, checklist: entry.checklist.filter((_, i) => i !== idx) })
  }

  function addChecklistItem(entry: TimelineEntry, text: string) {
    if (!text.trim()) return
    updatePanel({ ...entry, checklist: [...entry.checklist, { text: text.trim(), done: false }] })
  }

  function addStaff(entry: TimelineEntry, s: StaffRow) {
    if (entry.assigned_staff.some(a => a.id === s.id)) return
    updatePanel({ ...entry, assigned_staff: [...entry.assigned_staff, { id: s.id, name: s.name, role_category: s.role_category }] })
  }

  function removeStaff(entry: TimelineEntry, id: string) {
    updatePanel({ ...entry, assigned_staff: entry.assigned_staff.filter(a => a.id !== id) })
  }

  function addVendor(entry: TimelineEntry, v: VendorRow) {
    if (entry.assigned_vendors.some(a => a.id === v.id)) return
    updatePanel({ ...entry, assigned_vendors: [...entry.assigned_vendors, { id: v.id, name: v.name, category: v.category }] })
  }

  function removeVendor(entry: TimelineEntry, id: string) {
    updatePanel({ ...entry, assigned_vendors: entry.assigned_vendors.filter(a => a.id !== id) })
  }

  function addMember(entry: TimelineEntry, m: Member) {
    if (entry.assigned_members.some(a => a.id === m.id)) return
    const name = m.profiles?.name ?? '—'
    updatePanel({ ...entry, assigned_members: [...entry.assigned_members, { id: m.id, name, role: m.role }] })
  }

  function removeMember(entry: TimelineEntry, id: string) {
    updatePanel({ ...entry, assigned_members: entry.assigned_members.filter(a => a.id !== id) })
  }

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      {/* Left: Timeline list */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Ablaufplan</h1>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
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
                background: filter === cat ? (cat === 'Alle' ? 'var(--black)' : CATEGORY_COLORS[cat as Category]) : '#F5F5F7',
                color: filter === cat ? '#fff' : 'var(--text-primary)',
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
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, fontStyle: 'italic' }}>
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
                onClick={() => selectEntry(isSelected ? null : entry)}
                style={{
                  display: 'flex', gap: 16, padding: '14px 16px',
                  background: isSelected ? 'var(--accent-light)' : 'var(--surface)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderLeft: `4px solid ${color}`,
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{minutesToTime(entry.start_minutes)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{entry.duration_minutes ?? '?'} min</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{entry.title ?? 'Unbenannt'}</div>
                  {entry.location && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} />{entry.location}
                    </div>
                  )}
                  {entry.checklist.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      ✓ {entry.checklist.filter(c => c.done).length}/{entry.checklist.length} Aufgaben
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                    background: color + '20', color,
                  }}>{cat ?? '—'}</span>
                  <button onClick={e => { e.stopPropagation(); openEdit(entry) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--text-tertiary)' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(entry.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--text-tertiary)' }}>
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
        <div style={{ width: 320, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 22, overflowY: 'auto', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{selected.title ?? 'Details'}</h3>
            <button onClick={() => selectEntry(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
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
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Checkliste</div>
            {selected.checklist.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }} onClick={() => toggleChecklist(selected, i)}>
                <div style={{
                  width: 16, height: 16, borderRadius: 3, border: `2px solid ${item.done ? 'var(--green)' : 'var(--border2)'}`,
                  background: item.done ? 'var(--green)' : 'transparent', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.done && <Check size={10} color="#fff" strokeWidth={3} />}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: item.done ? 'var(--text-tertiary)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>
                  {item.text}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); deleteChecklistItem(selected, i) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <AddChecklistItem onAdd={text => addChecklistItem(selected, text)} />
          </div>

          {/* Responsibilities */}
          {selected.responsibilities.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Verantwortliche</div>
              {selected.responsibilities.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {r.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{r.task}</div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11,
                    background: r.status === 'done' ? 'var(--green-pale)' : '#F5F5F7',
                    color: r.status === 'done' ? 'var(--green)' : 'var(--text-tertiary)',
                  }}>{r.status === 'done' ? 'Erledigt' : 'Ausstehend'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Mitarbeiter */}
          {staff.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Mitarbeiter</div>
              {(selected.assigned_staff ?? []).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#E8F4FD', color: '#2563EB', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initials(a.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    {a.role_category && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.role_category}</div>}
                  </div>
                  <button onClick={() => removeStaff(selected, a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', opacity: 0.5 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              {(() => {
                const unassigned = staff.filter(s => !(selected.assigned_staff ?? []).some(a => a.id === s.id))
                if (unassigned.length === 0) return null
                return (
                  <select
                    value=""
                    onChange={e => { const s = staff.find(x => x.id === e.target.value); if (s) addStaff(selected, s) }}
                    style={{ width: '100%', padding: '6px 10px', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12.5, background: '#fff', color: 'var(--text-tertiary)', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', marginTop: 4 }}
                  >
                    <option value="">+ Mitarbeiter hinzufügen …</option>
                    {unassigned.map(s => <option key={s.id} value={s.id}>{s.name}{s.role_category ? ` · ${s.role_category}` : ''}</option>)}
                  </select>
                )
              })()}
            </div>
          )}

          {/* Beteiligte */}
          {members.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Beteiligte</div>
              {(selected.assigned_members ?? []).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#FFF3E0', color: '#E65100', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initials(a.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.role}</div>
                  </div>
                  <button onClick={() => removeMember(selected, a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', opacity: 0.5 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              {(() => {
                const unassigned = members.filter(m => !(selected.assigned_members ?? []).some(a => a.id === m.id) && m.profiles)
                if (unassigned.length === 0) return null
                return (
                  <select
                    value=""
                    onChange={e => { const m = members.find(x => x.id === e.target.value); if (m) addMember(selected, m) }}
                    style={{ width: '100%', padding: '6px 10px', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12.5, background: '#fff', color: 'var(--text-tertiary)', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', marginTop: 4 }}
                  >
                    <option value="">+ Mitglied hinzufügen …</option>
                    {unassigned.map(m => <option key={m.id} value={m.id}>{m.profiles?.name} · {m.role}</option>)}
                  </select>
                )
              })()}
            </div>
          )}

          {/* Dienstleister */}
          {vendors.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Dienstleister</div>
              {(selected.assigned_vendors ?? []).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#F3EEFF', color: '#7C3AED', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initials(a.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    {a.category && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.category}</div>}
                  </div>
                  <button onClick={() => removeVendor(selected, a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', opacity: 0.5 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              {(() => {
                const unassigned = vendors.filter(v => !(selected.assigned_vendors ?? []).some(a => a.id === v.id))
                if (unassigned.length === 0) return null
                return (
                  <select
                    value=""
                    onChange={e => { const v = vendors.find(x => x.id === e.target.value); if (v) addVendor(selected, v) }}
                    style={{ width: '100%', padding: '6px 10px', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12.5, background: '#fff', color: 'var(--text-tertiary)', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', marginTop: 4 }}
                  >
                    <option value="">+ Dienstleister hinzufügen …</option>
                    {unassigned.map(v => <option key={v.id} value={v.id}>{v.name}{v.category ? ` · ${v.category}` : ''}</option>)}
                  </select>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 440, maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 22 }}>
              {editEntry ? 'Punkt bearbeiten' : 'Neuer Ablaufpunkt'}
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Titel</label>
              <input style={inputSt} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Standesamtliche Trauung" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Startzeit</label>
                <TimeInput style={inputSt} value={form.start_minutes} onChange={v => setForm(f => ({ ...f, start_minutes: v }))} />
              </div>
              <div>
                <label style={labelSt}>Dauer (Minuten)</label>
                <input type="number" min={5} step={5} style={inputSt} value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
              </div>
            </div>

            {/* Neighbor entries — always rendered to avoid layout shift */}
            {(() => {
              const inputMin = form.start_minutes ? timeToMinutes(form.start_minutes) : null
              const others = entries.filter(e => e.id !== editEntry?.id && e.start_minutes != null)
              const before = inputMin != null
                ? others.filter(e => (e.start_minutes ?? 0) <= inputMin).sort((a, b) => (b.start_minutes ?? 0) - (a.start_minutes ?? 0))[0] ?? null
                : null
              const after = inputMin != null
                ? others.filter(e => (e.start_minutes ?? 0) > inputMin).sort((a, b) => (a.start_minutes ?? 0) - (b.start_minutes ?? 0))[0] ?? null
                : null
              const hasTime = inputMin != null
              return (
                <div style={{ marginBottom: 14, background: '#F8F8FA', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {(['before', 'after'] as const).map((side, i) => {
                    const entry = side === 'before' ? before : after
                    const label = side === 'before' ? 'Davor' : 'Danach'
                    const endMin = entry && entry.start_minutes != null && entry.duration_minutes != null
                      ? entry.start_minutes + entry.duration_minutes : null
                    const cat = entry?.category as Category | undefined
                    const color = cat ? CATEGORY_COLORS[cat] : '#999'
                    return (
                      <div key={side} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', width: 46, flexShrink: 0 }}>{label}</span>
                        {!hasTime ? (
                          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Uhrzeit eingeben …</span>
                        ) : entry ? (
                          <>
                            <span style={{ width: 3, height: 28, borderRadius: 2, background: color, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title ?? 'Unbenannt'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                                {minutesToTime(entry.start_minutes)}{endMin != null ? ` – ${minutesToTime(endMin)}` : ''}
                              </div>
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

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
                      background: form.category === cat ? CATEGORY_COLORS[cat] : '#F5F5F7',
                      color: form.category === cat ? '#fff' : 'var(--text-primary)',
                      fontWeight: form.category === cat ? 600 : 400,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}>
                {saving ? 'Speichern…' : editEntry ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(panelSaving || panelSaved) && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 100,
          background: panelSaved ? 'var(--green)' : 'var(--surface)',
          color: panelSaved ? '#fff' : 'var(--text-secondary)',
          padding: '8px 16px', borderRadius: 'var(--radius-sm)',
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          border: panelSaved ? 'none' : '1px solid var(--border)',
          pointerEvents: 'none',
        }}>
          {panelSaving ? 'Speichert…' : 'Gespeichert ✓'}
        </div>
      )}
    </div>
  )
}

function InfoChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#F5F5F7', borderRadius: 12, fontSize: 12, color: 'var(--text-primary)' }}>
      {icon}{text}
    </span>
  )
}

function AddChecklistItem({ onAdd }: { onAdd: (text: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <input
        style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { onAdd(val); setVal('') } }}
        placeholder="Aufgabe hinzufügen…"
      />
      <button
        onClick={() => { onAdd(val); setVal('') }}
        style={{ padding: '6px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13 }}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
