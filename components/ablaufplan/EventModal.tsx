'use client'
import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Check, MapPin, Clock, Pencil, Trash2 } from 'lucide-react'
import { CATEGORY_COLORS } from './DayCalendar'

// ─── Types ────────────────────────────────────────────────────────────────────
export type Category = 'Zeremonie' | 'Empfang' | 'Feier' | 'Logistik'
export const CATEGORIES: Category[] = ['Zeremonie', 'Empfang', 'Feier', 'Logistik']

export interface ChecklistItem { text: string; done: boolean }
export interface AssignedStaff  { id: string; name: string; role_category: string | null }
export interface AssignedVendor { id: string; name: string; category: string | null }
export interface AssignedMember { id: string; name: string; role: string }

export interface AblaufplanDay {
  id: string
  event_id: string
  day_index: number
  name: string
  start_hour: number
  end_hour: number
}

export interface TimelineEntry {
  id: string
  event_id: string
  title: string | null
  location: string | null
  sort_order: number
  start_minutes: number | null
  duration_minutes: number | null
  category: string | null
  day_index: number
  checklist: ChecklistItem[]
  assigned_staff: AssignedStaff[]
  assigned_vendors: AssignedVendor[]
  assigned_members: AssignedMember[]
  created_at: string
}

export interface Member {
  id: string; user_id: string; role: string
  profiles: { id: string; name: string } | null
}
export interface StaffRow  { id: string; name: string; role_category: string | null }
export interface VendorRow { id: string; name: string; category: string | null }

interface FormState {
  title: string
  location: string
  start_minutes: string   // "HH:MM" string
  duration_minutes: number
  category: Category
  day_index: number
}

interface Props {
  entry: TimelineEntry | null          // null = create mode
  prefill?: { startMinutes: number; duration: number }
  activeDay: number
  days: AblaufplanDay[]
  eventId: string
  members: Member[]
  staff: StaffRow[]
  vendors: VendorRow[]
  role?: 'veranstalter' | 'brautpaar' | 'dienstleister'
  readOnly?: boolean
  onSave:   (data: Partial<TimelineEntry> & { event_id: string }) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onChecklistChange?: (id: string, checklist: ChecklistItem[]) => Promise<void>
  onAssignmentsChange?: (id: string, patch: Partial<Pick<TimelineEntry, 'assigned_staff' | 'assigned_vendors' | 'assigned_members'>>) => Promise<void>
  onClose: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function minutesToTime(m: number | null | undefined): string {
  if (m == null) return ''
  const h   = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function timeToMinutes(t: string): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return null
  return h * 60 + (m || 0)
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 5,
}
const inputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#fff',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

function AddChecklistItem({ onAdd }: { onAdd: (text: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <input
        style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val); setVal('') } }}
        placeholder="Aufgabe hinzufügen…"
      />
      <button
        type="button"
        onClick={() => { if (val.trim()) { onAdd(val); setVal('') } }}
        style={{ padding: '7px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}

function AvatarChip({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: bg, color, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {label}
    </div>
  )
}

// ─── Main EventModal ──────────────────────────────────────────────────────────
export default function EventModal({
  entry, prefill, activeDay, days, eventId,
  members, staff, vendors,
  role = 'veranstalter', readOnly = false,
  onSave, onDelete, onChecklistChange, onAssignmentsChange, onClose,
}: Props) {
  const isCreate = !entry
  const canWrite = !readOnly && role !== 'dienstleister'
  const canDelete = !readOnly && (role === 'veranstalter') && !!entry

  // Form state
  const [form, setForm] = useState<FormState>(() => ({
    title:            entry?.title            ?? '',
    location:         entry?.location         ?? '',
    start_minutes:    minutesToTime(entry?.start_minutes ?? prefill?.startMinutes),
    duration_minutes: entry?.duration_minutes ?? prefill?.duration ?? 60,
    category:         (entry?.category as Category) ?? 'Feier',
    day_index:        entry?.day_index ?? activeDay,
  }))

  // Checklist state (editable even when viewing existing entry)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(entry?.checklist ?? [])
  const [editMode,  setEditMode]  = useState(false) // for checklist delete

  // Assignment state (for existing entries, editable without saving form)
  const [assignedStaff,   setAssignedStaff]   = useState<AssignedStaff[]>(entry?.assigned_staff   ?? [])
  const [assignedVendors, setAssignedVendors] = useState<AssignedVendor[]>(entry?.assigned_vendors ?? [])
  const [assignedMembers, setAssignedMembers] = useState<AssignedMember[]>(entry?.assigned_members ?? [])

  const [saving,  setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Auto-save checklist for existing entries
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>()
  function scheduleChecklistSave(newList: ChecklistItem[]) {
    if (!entry || !onChecklistChange) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      onChecklistChange(entry.id, newList)
    }, 600)
  }

  // Auto-save assignments for existing entries
  const autoSaveAssignTimer = useRef<ReturnType<typeof setTimeout>>()
  function scheduleAssignmentSave(patch: Partial<Pick<TimelineEntry, 'assigned_staff' | 'assigned_vendors' | 'assigned_members'>>) {
    if (!entry || !onAssignmentsChange) return
    clearTimeout(autoSaveAssignTimer.current)
    autoSaveAssignTimer.current = setTimeout(() => {
      onAssignmentsChange(entry.id, patch)
    }, 600)
  }

  useEffect(() => () => {
    clearTimeout(autoSaveTimer.current)
    clearTimeout(autoSaveAssignTimer.current)
  }, [])

  // Keyboard: close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Checklist ────────────────────────────────────────────────────────────
  function toggleItem(i: number) {
    if (!canWrite && role === 'dienstleister') return // vendors can't edit checklist
    const next = checklist.map((x, idx) => idx === i ? { ...x, done: !x.done } : x)
    setChecklist(next)
    scheduleChecklistSave(next)
  }
  function deleteItem(i: number) {
    const next = checklist.filter((_, idx) => idx !== i)
    setChecklist(next)
    scheduleChecklistSave(next)
  }
  function addItem(text: string) {
    const next = [...checklist, { text, done: false }]
    setChecklist(next)
    scheduleChecklistSave(next)
  }

  // ── Assignments ───────────────────────────────────────────────────────────
  function addStaff(s: StaffRow) {
    if (assignedStaff.some(a => a.id === s.id)) return
    const next = [...assignedStaff, { id: s.id, name: s.name, role_category: s.role_category }]
    setAssignedStaff(next)
    scheduleAssignmentSave({ assigned_staff: next })
  }
  function removeStaff(id: string) {
    const next = assignedStaff.filter(a => a.id !== id)
    setAssignedStaff(next)
    scheduleAssignmentSave({ assigned_staff: next })
  }
  function addVendor(v: VendorRow) {
    if (assignedVendors.some(a => a.id === v.id)) return
    const next = [...assignedVendors, { id: v.id, name: v.name, category: v.category }]
    setAssignedVendors(next)
    scheduleAssignmentSave({ assigned_vendors: next })
  }
  function removeVendor(id: string) {
    const next = assignedVendors.filter(a => a.id !== id)
    setAssignedVendors(next)
    scheduleAssignmentSave({ assigned_vendors: next })
  }
  function addMember(m: Member) {
    if (assignedMembers.some(a => a.id === m.id)) return
    const name = m.profiles?.name ?? '—'
    const next = [...assignedMembers, { id: m.id, name, role: m.role }]
    setAssignedMembers(next)
    scheduleAssignmentSave({ assigned_members: next })
  }
  function removeMember(id: string) {
    const next = assignedMembers.filter(a => a.id !== id)
    setAssignedMembers(next)
    scheduleAssignmentSave({ assigned_members: next })
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    const startMin = timeToMinutes(form.start_minutes)
    await onSave({
      ...(entry ?? {}),
      event_id:         eventId,
      title:            form.title || null,
      location:         form.location || null,
      start_minutes:    startMin,
      duration_minutes: form.duration_minutes,
      category:         form.category,
      day_index:        form.day_index,
      sort_order:       startMin ?? 9999,
      checklist,
      assigned_staff:   assignedStaff,
      assigned_vendors: assignedVendors,
      assigned_members: assignedMembers,
    })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!entry || !onDelete) return
    setDeleting(true)
    await onDelete(entry.id)
    setDeleting(false)
    onClose()
  }

  const catColor = CATEGORY_COLORS[form.category] ?? '#888'

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', width: 520, maxWidth: '100%', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
            {isCreate ? 'Neuer Ablaufpunkt' : canWrite ? 'Punkt bearbeiten' : 'Ablaufpunkt'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Checklist edit-mode toggle — only for write roles */}
            {!isCreate && canWrite && checklist.length > 0 && (
              <button
                type="button"
                onClick={() => setEditMode(v => !v)}
                title={editMode ? 'Bearbeitungsmodus beenden' : 'Checkliste bearbeiten'}
                style={{
                  padding: '5px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: editMode ? 'var(--accent-light)' : 'transparent',
                  color: editMode ? 'var(--accent)' : 'var(--text-tertiary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Pencil size={11} />
                {editMode ? 'Fertig' : 'Bearbeiten'}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#FF3B30', display: 'flex', alignItems: 'center' }}
                title="Ablaufpunkt löschen"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-tertiary)', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: '18px 24px 24px' }}>
          {/* ── Category pills ── */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                disabled={!canWrite}
                onClick={() => setForm(f => ({ ...f, category: cat }))}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12.5,
                  border: `1.5px solid ${form.category === cat ? CATEGORY_COLORS[cat] : 'var(--border)'}`,
                  background: form.category === cat ? CATEGORY_COLORS[cat] + '1A' : 'transparent',
                  color: form.category === cat ? CATEGORY_COLORS[cat] : 'var(--text-tertiary)',
                  fontWeight: form.category === cat ? 700 : 400,
                  cursor: canWrite ? 'pointer' : 'default',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* ── Title ── */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Titel</label>
            <input
              style={{ ...inputSt, borderLeft: `3px solid ${catColor}` }}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="z.B. Standesamtliche Trauung"
              disabled={!canWrite}
              autoFocus={isCreate}
            />
          </div>

          {/* ── Time + Duration ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Startzeit</label>
              <div style={{ position: 'relative' }}>
                <Clock size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                <input
                  type="time"
                  style={{ ...inputSt, paddingLeft: 30 }}
                  value={form.start_minutes}
                  onChange={e => setForm(f => ({ ...f, start_minutes: e.target.value }))}
                  disabled={!canWrite}
                />
              </div>
            </div>
            <div>
              <label style={labelSt}>Dauer (Minuten)</label>
              <input
                type="number" min={5} step={5}
                style={inputSt}
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 60 }))}
                disabled={!canWrite}
              />
            </div>
          </div>

          {/* ── Location ── */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Ort / Location</label>
            <div style={{ position: 'relative' }}>
              <MapPin size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input
                style={{ ...inputSt, paddingLeft: 30 }}
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="z.B. Kapelle, Saal A"
                disabled={!canWrite}
              />
            </div>
          </div>

          {/* ── Day selector (only if multiple days) ── */}
          {days.length > 1 && canWrite && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Tag</label>
              <select
                style={{ ...inputSt }}
                value={form.day_index}
                onChange={e => setForm(f => ({ ...f, day_index: parseInt(e.target.value) }))}
              >
                {days.map(d => (
                  <option key={d.day_index} value={d.day_index}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── Checkliste ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Checkliste {checklist.length > 0 && `(${checklist.filter(c => c.done).length}/${checklist.length})`}</span>
            </div>
            {checklist.map((item, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }}
                onClick={() => toggleItem(i)}
              >
                <div style={{
                  width: 17, height: 17, borderRadius: 4,
                  border: `2px solid ${item.done ? 'var(--green)' : 'var(--border2)'}`,
                  background: item.done ? 'var(--green)' : 'transparent',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.done && <Check size={10} color="#fff" strokeWidth={3} />}
                </div>
                <span style={{ flex: 1, fontSize: 13.5, color: item.done ? 'var(--text-tertiary)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>
                  {item.text}
                </span>
                {editMode && canWrite && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); deleteItem(i) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#FF3B30', display: 'flex', alignItems: 'center', opacity: 0.7 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
            {canWrite && <AddChecklistItem onAdd={addItem} />}
          </div>

          {/* ── Mitarbeiter ── */}
          {staff.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Mitarbeiter</div>
              {assignedStaff.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <AvatarChip color="#2563EB" bg="#E8F4FD" label={initials(a.name)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                    {a.role_category && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.role_category}</div>}
                  </div>
                  {canWrite && (
                    <button type="button" onClick={() => removeStaff(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-tertiary)', display: 'flex', opacity: 0.5 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {canWrite && (() => {
                const unassigned = staff.filter(s => !assignedStaff.some(a => a.id === s.id))
                if (!unassigned.length) return null
                return (
                  <select value="" onChange={e => { const s = staff.find(x => x.id === e.target.value); if (s) addStaff(s) }}
                    style={{ width: '100%', padding: '6px 10px', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12.5, background: '#fff', color: 'var(--text-tertiary)', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', marginTop: 4 }}>
                    <option value="">+ Mitarbeiter hinzufügen…</option>
                    {unassigned.map(s => <option key={s.id} value={s.id}>{s.name}{s.role_category ? ` · ${s.role_category}` : ''}</option>)}
                  </select>
                )
              })()}
            </div>
          )}

          {/* ── Beteiligte ── */}
          {members.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Beteiligte</div>
              {assignedMembers.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <AvatarChip color="#E65100" bg="#FFF3E0" label={initials(a.name)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.role}</div>
                  </div>
                  {canWrite && (
                    <button type="button" onClick={() => removeMember(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-tertiary)', display: 'flex', opacity: 0.5 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {canWrite && (() => {
                const unassigned = members.filter(m => !assignedMembers.some(a => a.id === m.id) && m.profiles)
                if (!unassigned.length) return null
                return (
                  <select value="" onChange={e => { const m = members.find(x => x.id === e.target.value); if (m) addMember(m) }}
                    style={{ width: '100%', padding: '6px 10px', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12.5, background: '#fff', color: 'var(--text-tertiary)', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', marginTop: 4 }}>
                    <option value="">+ Mitglied hinzufügen…</option>
                    {unassigned.map(m => <option key={m.id} value={m.id}>{m.profiles?.name} · {m.role}</option>)}
                  </select>
                )
              })()}
            </div>
          )}

          {/* ── Dienstleister ── */}
          {vendors.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Dienstleister</div>
              {assignedVendors.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <AvatarChip color="#7C3AED" bg="#F3EEFF" label={initials(a.name)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                    {a.category && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.category}</div>}
                  </div>
                  {canWrite && (
                    <button type="button" onClick={() => removeVendor(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-tertiary)', display: 'flex', opacity: 0.5 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {canWrite && (() => {
                const unassigned = vendors.filter(v => !assignedVendors.some(a => a.id === v.id))
                if (!unassigned.length) return null
                return (
                  <select value="" onChange={e => { const v = vendors.find(x => x.id === e.target.value); if (v) addVendor(v) }}
                    style={{ width: '100%', padding: '6px 10px', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12.5, background: '#fff', color: 'var(--text-tertiary)', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', marginTop: 4 }}>
                    <option value="">+ Dienstleister hinzufügen…</option>
                    {unassigned.map(v => <option key={v.id} value={v.id}>{v.name}{v.category ? ` · ${v.category}` : ''}</option>)}
                  </select>
                )
              })()}
            </div>
          )}

          {/* ── Actions ── */}
          {canWrite && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={onClose}
                style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>
                Abbrechen
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                style={{ padding: '9px 22px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: saving ? 'wait' : 'pointer', fontSize: 14, fontWeight: 600 }}>
                {saving ? 'Speichern…' : isCreate ? 'Hinzufügen' : 'Speichern'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
