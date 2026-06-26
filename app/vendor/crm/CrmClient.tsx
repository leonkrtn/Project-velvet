'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Users, Plus, Search, Filter, Download, Upload, RefreshCw,
  Phone, Mail, Calendar, Euro, Tag, ChevronRight, X, Check,
  LayoutGrid, List, Circle, AlertCircle, Star, Building2,
  Pencil, Trash2, CheckSquare, Square, Clock, ArrowRight,
  Heart, Briefcase, PartyPopper, HelpCircle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
type LifecycleStage = 'lead' | 'anfrage' | 'gebucht' | 'ehemalig'
type Source = 'empfehlung' | 'marktplatz' | 'website' | 'messe' | 'sonstige' | 'custom'
type Priority = 'vip' | 'standard' | 'grosskunde'
type EventType = 'hochzeit' | 'firmenevent' | 'privat' | 'sonstige'
type ActivityType = 'note' | 'call' | 'meeting' | 'offer_sent' | 'offer_accepted' | 'offer_declined' | 'stage_change' | 'imported'

interface ContactPerson { id: string; name: string; email: string; phone: string; role: string }
interface Task { id: string; contact_id: string | null; title: string; due_at: string | null; done: boolean; done_at: string | null; created_at: string }
interface Activity { id: string; contact_id: string; activity_type: ActivityType; title: string; body: string; activity_at: string; auto_generated: boolean }

interface Contact {
  id: string
  name: string
  email: string
  phone: string
  address_line1: string
  address_line2: string
  lifecycle_stage: LifecycleStage
  source: Source
  event_type: EventType
  wedding_date: string | null
  deal_value: number | null
  notes: string
  priority: Priority
  custom_tags: string[]
  offer_id: string | null
  event_id: string | null
  anniversary_remind: boolean
  created_at: string
  updated_at: string
  crm_contact_persons?: ContactPerson[]
  crm_tasks?: Task[]
}

// ── Constants ──────────────────────────────────────────────────
const STAGES: { key: LifecycleStage; label: string; color: string; bg: string }[] = [
  { key: 'lead',      label: 'Lead',     color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
  { key: 'anfrage',   label: 'Anfrage',  color: '#B89968', bg: 'rgba(184,153,104,0.12)' },
  { key: 'gebucht',   label: 'Gebucht',  color: '#1E7E34', bg: 'rgba(30,126,52,0.12)' },
  { key: 'ehemalig',  label: 'Ehemalig', color: '#2352C8', bg: 'rgba(35,82,200,0.10)' },
]

const SOURCE_LABELS: Record<Source, string> = {
  empfehlung: 'Empfehlung', marktplatz: 'Marktplatz', website: 'Website',
  messe: 'Messe', sonstige: 'Sonstige', custom: 'Sonstige',
}

const EVENT_TYPE_ICONS: Record<EventType, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  hochzeit: Heart, firmenevent: Briefcase, privat: PartyPopper, sonstige: HelpCircle,
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  hochzeit: 'Hochzeit', firmenevent: 'Firmenevent', privat: 'Privat', sonstige: 'Sonstige',
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  note: 'Notiz', call: 'Anruf', meeting: 'Meeting',
  offer_sent: 'Angebot versendet', offer_accepted: 'Angebot angenommen',
  offer_declined: 'Angebot abgelehnt', stage_change: 'Status geändert', imported: 'Importiert',
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  note: '#6B7280', call: '#2352C8', meeting: '#7C3AED',
  offer_sent: '#B89968', offer_accepted: '#1E7E34',
  offer_declined: '#C5221F', stage_change: '#9333EA', imported: '#9CA3AF',
}

// ── Helpers ────────────────────────────────────────────────────
function formatEur(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('de-DE').format(Math.round(n)) + ' €'
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function relDate(s: string): string {
  const diff = Date.now() - new Date(s).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Heute'
  if (d === 1) return 'Gestern'
  if (d < 7) return `vor ${d} Tagen`
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' })
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function stageFor(key: LifecycleStage) {
  return STAGES.find(s => s.key === key) ?? STAGES[0]
}

function daysUntilAnniversary(weddingDate: string): number | null {
  if (!weddingDate) return null
  const now = new Date()
  const wd = new Date(weddingDate)
  const thisYear = new Date(now.getFullYear(), wd.getMonth(), wd.getDate())
  if (thisYear < now) thisYear.setFullYear(now.getFullYear() + 1)
  return Math.ceil((thisYear.getTime() - now.getTime()) / 86400000)
}

// ── Empty contact form ─────────────────────────────────────────
function emptyContact(): Omit<Contact, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: '', email: '', phone: '', address_line1: '', address_line2: '',
    lifecycle_stage: 'lead', source: 'sonstige', event_type: 'hochzeit',
    wedding_date: null, deal_value: null, notes: '', priority: 'standard',
    custom_tags: [], offer_id: null, event_id: null, anniversary_remind: false,
  }
}

// ── Sub-components ─────────────────────────────────────────────
function StageBadge({ stage }: { stage: LifecycleStage }) {
  const s = stageFor(stage)
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
      color: s.color, background: s.bg,
    }}>{s.label}</span>
  )
}

function PriorityIcon({ p }: { p: Priority }) {
  if (p === 'vip') return <Star size={12} style={{ color: '#F59E0B' }} />
  if (p === 'grosskunde') return <Building2 size={12} style={{ color: '#6366F1' }} />
  return null
}

// ── Contact card (Kanban) ──────────────────────────────────────
function ContactCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const openTasks = contact.crm_tasks?.filter(t => !t.done).length ?? 0
  const anniv = contact.anniversary_remind && contact.wedding_date ? daysUntilAnniversary(contact.wedding_date) : null
  const ETypeIcon = EVENT_TYPE_ICONS[contact.event_type] ?? HelpCircle

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '14px', marginBottom: 10, cursor: 'pointer',
        transition: 'box-shadow .15s, border-color .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
        }}>{initials(contact.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contact.name}
            </p>
            <PriorityIcon p={contact.priority} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <ETypeIcon size={10} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{EVENT_TYPE_LABELS[contact.event_type]}</span>
          </div>
        </div>
      </div>
      {contact.deal_value != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <Euro size={11} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{formatEur(contact.deal_value)}</span>
        </div>
      )}
      {contact.wedding_date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <Calendar size={11} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatDate(contact.wedding_date)}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{relDate(contact.updated_at)}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {anniv != null && anniv <= 30 && (
            <span style={{ fontSize: 10, color: '#E84393', fontWeight: 600 }}>Jub. in {anniv}d</span>
          )}
          {openTasks > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, background: 'rgba(35,82,200,0.12)', color: 'var(--accent)',
              padding: '1px 6px', borderRadius: 100,
            }}>{openTasks} Task{openTasks > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Contact row (List view) ────────────────────────────────────
function ContactRow({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
        cursor: 'pointer', transition: 'background .12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: 'var(--accent)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
      }}>{initials(contact.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{contact.name}</p>
          <PriorityIcon p={contact.priority} />
          <StageBadge stage={contact.lifecycle_stage} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          {[contact.email, contact.phone].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatEur(contact.deal_value)}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(contact.wedding_date)}</span>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </div>
  )
}

// ── Contact Detail Panel ───────────────────────────────────────
function ContactPanel({
  contact, onClose, onUpdated, onDeleted,
}: {
  contact: Contact
  onClose: () => void
  onUpdated: (c: Contact) => void
  onDeleted: (id: string) => void
}) {
  const [tab, setTab] = useState<'info' | 'aktivitaeten' | 'aufgaben'>('info')
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingActs, setLoadingActs] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...contact })
  const [saving, setSaving] = useState(false)
  const [newActivity, setNewActivity] = useState<{ type: ActivityType; title: string; body: string } | null>(null)
  const [newTask, setNewTask] = useState<{ title: string; due_at: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setForm({ ...contact })
  }, [contact])

  useEffect(() => {
    if (tab === 'aktivitaeten') {
      setLoadingActs(true)
      fetch(`/api/vendor/crm/activities?contactId=${contact.id}`)
        .then(r => r.json())
        .then(d => { setActivities(d.activities ?? []); setLoadingActs(false) })
    }
    if (tab === 'aufgaben') {
      fetch(`/api/vendor/crm/tasks?contactId=${contact.id}&done=true`)
        .then(r => r.json())
        .then(d => setTasks(d.tasks ?? []))
    }
  }, [tab, contact.id])

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/vendor/crm/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        deal_value: form.deal_value ? Number(form.deal_value) : null,
        wedding_date: form.wedding_date || null,
      }),
    })
    const json = await res.json()
    if (json.contact) { onUpdated(json.contact); setEditing(false) }
    setSaving(false)
  }

  async function addActivity() {
    if (!newActivity?.title.trim()) return
    const res = await fetch('/api/vendor/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, ...newActivity }),
    })
    const json = await res.json()
    if (json.activity) {
      setActivities(prev => [json.activity, ...prev])
      setNewActivity(null)
    }
  }

  async function deleteActivity(id: string) {
    await fetch(`/api/vendor/crm/activities?id=${id}`, { method: 'DELETE' })
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  async function addTask() {
    if (!newTask?.title.trim()) return
    const res = await fetch('/api/vendor/crm/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, title: newTask.title, due_at: newTask.due_at || null }),
    })
    const json = await res.json()
    if (json.task) { setTasks(prev => [json.task, ...prev]); setNewTask(null) }
  }

  async function toggleTask(task: Task) {
    const res = await fetch(`/api/vendor/crm/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !task.done }),
    })
    const json = await res.json()
    if (json.task) setTasks(prev => prev.map(t => t.id === task.id ? json.task : t))
  }

  async function deleteTask(id: string) {
    await fetch(`/api/vendor/crm/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function deleteContact() {
    setDeleting(true)
    await fetch(`/api/vendor/crm/contacts/${contact.id}`, { method: 'DELETE' })
    onDeleted(contact.id)
  }

  const s = stageFor(form.lifecycle_stage)

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
        {children}
      </div>
    )
  }

  function EditInput({ value, onChange, placeholder, type }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
    return (
      <input
        type={type ?? 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 8,
          border: '1px solid var(--border2)', background: 'var(--bg)',
          fontSize: 13, color: 'var(--text-primary)',
          fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 520,
        height: '100dvh', overflowY: 'auto',
        background: 'var(--surface)',
        boxShadow: '-4px 0 32px rgba(35,82,200,0.12)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700,
            }}>{initials(contact.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{contact.name}</p>
                <PriorityIcon p={contact.priority} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <StageBadge stage={contact.lifecycle_stage} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{SOURCE_LABELS[contact.source]}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                    borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)',
                  }}
                >
                  <Pencil size={13} /> Bearbeiten
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: 'var(--bg)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-secondary)',
                }}
              ><X size={16} /></button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['info', 'aktivitaeten', 'aufgaben'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 4px', border: 'none', background: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: tab === t ? 600 : 450,
                color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {t === 'info' ? 'Info' : t === 'aktivitaeten' ? 'Aktivitäten' : 'Aufgaben'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ── Info tab ── */}
          {tab === 'info' && (
            <div>
              {editing ? (
                <>
                  <Field label="Name">
                    <EditInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="E-Mail">
                      <EditInput value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
                    </Field>
                    <Field label="Telefon">
                      <EditInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
                    </Field>
                  </div>
                  <Field label="Straße & Nr.">
                    <EditInput value={form.address_line1} onChange={v => setForm(f => ({ ...f, address_line1: v }))} />
                  </Field>
                  <Field label="PLZ & Ort">
                    <EditInput value={form.address_line2} onChange={v => setForm(f => ({ ...f, address_line2: v }))} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Status">
                      <select
                        value={form.lifecycle_stage}
                        onChange={e => setForm(f => ({ ...f, lifecycle_stage: e.target.value as LifecycleStage }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit' }}
                      >
                        {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Priorität">
                      <select
                        value={form.priority}
                        onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit' }}
                      >
                        <option value="standard">Standard</option>
                        <option value="vip">VIP</option>
                        <option value="grosskunde">Großkunde</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Quelle">
                      <select
                        value={form.source}
                        onChange={e => setForm(f => ({ ...f, source: e.target.value as Source }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit' }}
                      >
                        {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </Field>
                    <Field label="Typ">
                      <select
                        value={form.event_type}
                        onChange={e => setForm(f => ({ ...f, event_type: e.target.value as EventType }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit' }}
                      >
                        {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Hochzeitsdatum">
                      <EditInput value={form.wedding_date ?? ''} onChange={v => setForm(f => ({ ...f, wedding_date: v || null }))} type="date" />
                    </Field>
                    <Field label="Umsatz (€)">
                      <EditInput value={form.deal_value != null ? String(form.deal_value) : ''} onChange={v => setForm(f => ({ ...f, deal_value: v ? Number(v) : null }))} type="number" />
                    </Field>
                  </div>
                  <Field label="Notizen">
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 8,
                        border: '1px solid var(--border2)', background: 'var(--bg)',
                        fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                      }}
                    />
                  </Field>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 20 }}>
                    <input
                      type="checkbox"
                      checked={form.anniversary_remind}
                      onChange={e => setForm(f => ({ ...f, anniversary_remind: e.target.checked }))}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Jahrestags-Erinnerung aktivieren</span>
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={save}
                      disabled={saving}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 9, border: 'none',
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                      }}
                    >{saving ? 'Speichern…' : 'Speichern'}</button>
                    <button
                      onClick={() => { setEditing(false); setForm({ ...contact }) }}
                      style={{
                        padding: '10px 16px', borderRadius: 9, border: '1px solid var(--border2)',
                        background: 'none', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                        color: 'var(--text-secondary)',
                      }}
                    >Abbrechen</button>
                  </div>
                </>
              ) : (
                <>
                  {/* Read-only info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {contact.email && (
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>E-Mail</p>
                        <a href={`mailto:${contact.email}`} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>{contact.email}</a>
                      </div>
                    )}
                    {contact.phone && (
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Telefon</p>
                        <a href={`tel:${contact.phone}`} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>{contact.phone}</a>
                      </div>
                    )}
                    {contact.wedding_date && (
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Hochzeitsdatum</p>
                        <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{formatDate(contact.wedding_date)}</p>
                      </div>
                    )}
                    {contact.deal_value != null && (
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Umsatz</p>
                        <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>{formatEur(contact.deal_value)}</p>
                      </div>
                    )}
                    {(contact.address_line1 || contact.address_line2) && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Adresse</p>
                        <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                          {[contact.address_line1, contact.address_line2].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                  {contact.notes && (
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notizen</p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{contact.notes}</p>
                    </div>
                  )}
                  {contact.anniversary_remind && contact.wedding_date && (() => {
                    const days = daysUntilAnniversary(contact.wedding_date)
                    if (days == null) return null
                    return (
                      <div style={{ background: 'rgba(232,67,147,0.07)', border: '1px solid rgba(232,67,147,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Heart size={14} style={{ color: '#E84393', flexShrink: 0 }} />
                        <p style={{ fontSize: 13, color: '#C2355D', margin: 0 }}>
                          Jahrestag in <strong>{days} Tag{days !== 1 ? 'en' : ''}</strong>
                        </p>
                      </div>
                    )
                  })()}
                  {/* Quick actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                        borderRadius: 8, border: '1px solid var(--border2)',
                        background: 'var(--bg)', textDecoration: 'none',
                        fontSize: 13, color: 'var(--text-secondary)',
                      }}>
                        <Mail size={13} /> E-Mail
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                        borderRadius: 8, border: '1px solid var(--border2)',
                        background: 'var(--bg)', textDecoration: 'none',
                        fontSize: 13, color: 'var(--text-secondary)',
                      }}>
                        <Phone size={13} /> Anrufen
                      </a>
                    )}
                  </div>
                  {/* Additional persons */}
                  {(contact.crm_contact_persons?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Weitere Personen</p>
                      {contact.crm_contact_persons!.map(p => (
                        <div key={p.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)',
                          }}>{initials(p.name)}</div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{p.name}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>{[p.email, p.phone].filter(Boolean).join(' · ')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Danger zone */}
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={deleteContact}
                      disabled={deleting}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                        borderRadius: 8, border: '1px solid rgba(197,34,31,0.3)',
                        background: 'rgba(197,34,31,0.05)', cursor: deleting ? 'wait' : 'pointer',
                        fontSize: 12, color: '#C5221F', fontFamily: 'inherit',
                      }}
                    >
                      <Trash2 size={13} /> Kontakt löschen
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Aktivitäten tab ── */}
          {tab === 'aktivitaeten' && (
            <div>
              {/* New activity form */}
              {newActivity ? (
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid var(--border2)' }}>
                  <select
                    value={newActivity.type}
                    onChange={e => setNewActivity(a => a ? { ...a, type: e.target.value as ActivityType } : null)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', marginBottom: 8 }}
                  >
                    {(['note', 'call', 'meeting'] as const).map(t => (
                      <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Titel"
                    value={newActivity.title}
                    onChange={e => setNewActivity(a => a ? { ...a, title: e.target.value } : null)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }}
                  />
                  <textarea
                    placeholder="Details (optional)"
                    value={newActivity.body}
                    onChange={e => setNewActivity(a => a ? { ...a, body: e.target.value } : null)}
                    rows={2}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addActivity} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Hinzufügen</button>
                    <button onClick={() => setNewActivity(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewActivity({ type: 'note', title: '', body: '' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    borderRadius: 9, border: '1px dashed var(--border2)',
                    background: 'none', cursor: 'pointer', fontSize: 13,
                    color: 'var(--text-secondary)', fontFamily: 'inherit', marginBottom: 16, width: '100%',
                  }}
                >
                  <Plus size={14} /> Aktivität hinzufügen
                </button>
              )}

              {loadingActs ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />)}
                </div>
              ) : activities.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Noch keine Aktivitäten.</p>
              ) : (
                <div style={{ position: 'relative' }}>
                  {activities.map((act, i) => (
                    <div key={act.id} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: ACTIVITY_COLORS[act.activity_type] + '22',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Circle size={10} style={{ color: ACTIVITY_COLORS[act.activity_type] }} />
                        </div>
                        {i < activities.length - 1 && (
                          <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>{act.title}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                              {ACTIVITY_LABELS[act.activity_type]} · {relDate(act.activity_at)}
                            </p>
                            {act.body && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{act.body}</p>}
                          </div>
                          {!act.auto_generated && (
                            <button
                              onClick={() => deleteActivity(act.id)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', flexShrink: 0 }}
                            ><Trash2 size={12} /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Aufgaben tab ── */}
          {tab === 'aufgaben' && (
            <div>
              {newTask ? (
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid var(--border2)' }}>
                  <input
                    placeholder="Aufgabe"
                    value={newTask.title}
                    onChange={e => setNewTask(t => t ? { ...t, title: e.target.value } : null)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }}
                  />
                  <input
                    type="date"
                    value={newTask.due_at}
                    onChange={e => setNewTask(t => t ? { ...t, due_at: e.target.value } : null)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addTask} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Hinzufügen</button>
                    <button onClick={() => setNewTask(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewTask({ title: '', due_at: '' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    borderRadius: 9, border: '1px dashed var(--border2)',
                    background: 'none', cursor: 'pointer', fontSize: 13,
                    color: 'var(--text-secondary)', fontFamily: 'inherit', marginBottom: 16, width: '100%',
                  }}
                >
                  <Plus size={14} /> Aufgabe hinzufügen
                </button>
              )}
              {tasks.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Keine Aufgaben.</p>
              ) : (
                tasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <button onClick={() => toggleTask(task)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: task.done ? '#1E7E34' : 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }}>
                      {task.done ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, color: task.done ? 'var(--text-tertiary)' : 'var(--text-primary)', margin: 0, textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</p>
                      {task.due_at && (
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Clock size={10} /> {formatDate(task.due_at)}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteTask(task.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── New Contact Modal ──────────────────────────────────────────
function NewContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Contact) => void }) {
  const [form, setForm] = useState(emptyContact())
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/vendor/crm/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (json.contact) onCreated(json.contact)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{
        position: 'relative', zIndex: 1, background: 'var(--surface)', borderRadius: 16,
        padding: '28px', width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(35,82,200,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Neuer Kontakt</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>

        {[
          { label: 'Name *', field: 'name', type: 'text' },
          { label: 'E-Mail', field: 'email', type: 'email' },
          { label: 'Telefon', field: 'phone', type: 'tel' },
        ].map(({ label, field, type }) => (
          <div key={field} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
            <input
              type={type}
              value={(form as unknown as Record<string, string | null>)[field] as string ?? ''}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Status</label>
            <select
              value={form.lifecycle_stage}
              onChange={e => setForm(f => ({ ...f, lifecycle_stage: e.target.value as LifecycleStage }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 14, fontFamily: 'inherit' }}
            >
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Quelle</label>
            <select
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value as Source }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 14, fontFamily: 'inherit' }}
            >
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Hochzeitsdatum</label>
            <input
              type="date"
              value={form.wedding_date ?? ''}
              onChange={e => setForm(f => ({ ...f, wedding_date: e.target.value || null }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Umsatz (€)</label>
            <input
              type="number"
              value={form.deal_value != null ? String(form.deal_value) : ''}
              onChange={e => setForm(f => ({ ...f, deal_value: e.target.value ? Number(e.target.value) : null }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={submit}
            disabled={saving || !form.name.trim()}
            style={{
              flex: 1, padding: '11px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: (saving || !form.name.trim()) ? 'not-allowed' : 'pointer',
              opacity: !form.name.trim() ? 0.5 : 1, fontFamily: 'inherit',
            }}
          >{saving ? 'Erstellen…' : 'Kontakt erstellen'}</button>
          <button
            onClick={onClose}
            style={{
              padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border2)',
              background: 'none', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              color: 'var(--text-secondary)',
            }}
          >Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

// ── Main CrmClient ─────────────────────────────────────────────
export default function CrmClient() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<LifecycleStage | ''>('')
  const [showFilters, setShowFilters] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<Source | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [importing, setImporting] = useState(false)
  const [autoImporting, setAutoImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (stageFilter) params.set('stage', stageFilter)
    if (sourceFilter) params.set('source', sourceFilter)
    if (priorityFilter) params.set('priority', priorityFilter)
    const res = await fetch(`/api/vendor/crm/contacts?${params}`)
    const json = await res.json()
    setContacts(json.contacts ?? [])
    setLoading(false)
  }, [search, stageFilter, sourceFilter, priorityFilter])

  useEffect(() => { load() }, [load])

  // Debounced search
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => load(), 350)
      return () => clearTimeout(t)
    }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const byStage = useMemo(() => {
    const map: Record<LifecycleStage, Contact[]> = { lead: [], anfrage: [], gebucht: [], ehemalig: [] }
    for (const c of contacts) map[c.lifecycle_stage].push(c)
    return map
  }, [contacts])

  const totalValue = useMemo(() => contacts.reduce((s, c) => s + (c.deal_value ?? 0), 0), [contacts])

  function handleCreated(c: Contact) {
    setContacts(prev => [c, ...prev])
    setShowNew(false)
  }

  function handleUpdated(c: Contact) {
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, ...c } : x))
    setSelectedContact(c)
  }

  function handleDeleted(id: string) {
    setContacts(prev => prev.filter(c => c.id !== id))
    setSelectedContact(null)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/vendor/crm/import', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.imported > 0) await load()
    setImporting(false)
    e.target.value = ''
  }

  async function handleAutoImport() {
    setAutoImporting(true)
    const res = await fetch('/api/vendor/crm/auto-import', { method: 'POST' })
    const json = await res.json()
    if (json.imported > 0) await load()
    setAutoImporting(false)
  }

  const anniversaryAlerts = useMemo(() => {
    return contacts.filter(c => {
      if (!c.anniversary_remind || !c.wedding_date) return false
      const days = daysUntilAnniversary(c.wedding_date)
      return days != null && days <= 30
    }).sort((a, b) => {
      const da = daysUntilAnniversary(a.wedding_date!) ?? 999
      const db = daysUntilAnniversary(b.wedding_date!) ?? 999
      return da - db
    })
  }, [contacts])

  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>

      {/* ── Anniversary alerts ── */}
      {anniversaryAlerts.length > 0 && (
        <div style={{ background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Heart size={16} style={{ color: '#E84393', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#C2355D', margin: '0 0 4px' }}>Bevorstehende Jahrestage</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {anniversaryAlerts.slice(0, 4).map(c => {
                const days = daysUntilAnniversary(c.wedding_date!)!
                return (
                  <span
                    key={c.id}
                    onClick={() => setSelectedContact(c)}
                    style={{ fontSize: 12, color: '#C2355D', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {c.name} (in {days}d)
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>CRM</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              {contacts.length} Kontakt{contacts.length !== 1 ? 'e' : ''} · {formatEur(totalValue)} Gesamtwert
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleAutoImport}
              disabled={autoImporting}
              title="Aus akzeptierten Angeboten importieren"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)',
                fontSize: 13, cursor: autoImporting ? 'wait' : 'pointer', color: 'var(--text-secondary)',
                fontFamily: 'inherit',
              }}
            >
              <RefreshCw size={14} style={{ animation: autoImporting ? 'crm-spin 1s linear infinite' : 'none' }} />
              <span className="crm-btn-label">Auto-Import</span>
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)',
                fontSize: 13, cursor: importing ? 'wait' : 'pointer', color: 'var(--text-secondary)',
                fontFamily: 'inherit',
              }}
            >
              <Upload size={14} /><span className="crm-btn-label">CSV Import</span>
            </button>
            <a
              href="/api/vendor/crm/export"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)',
                fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
              }}
            >
              <Download size={14} /><span className="crm-btn-label">Export</span>
            </a>
            <button
              onClick={() => setShowNew(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Plus size={14} /> Neu
            </button>
          </div>
        </div>

        {/* ── Search & filters ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              placeholder="Name, E-Mail oder Telefon suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10,
                border: '1px solid var(--border2)', background: 'var(--bg)',
                fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              borderRadius: 10, border: `1px solid ${showFilters || sourceFilter || priorityFilter ? 'var(--accent)' : 'var(--border2)'}`,
              background: showFilters ? 'var(--accent-light)' : 'var(--bg)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              color: showFilters ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Filter size={13} /> Filter
            {(sourceFilter || priorityFilter) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block' }} />}
          </button>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden' }}>
            {([['kanban', LayoutGrid], ['list', List]] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '9px 12px', border: 'none',
                  background: view === v ? 'var(--accent)' : 'var(--bg)',
                  color: view === v ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              ><Icon size={15} /></button>
            ))}
          </div>
        </div>

        {/* Stage pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: showFilters ? 12 : 16, flexWrap: 'wrap' }}>
          {([['', 'Alle']] as [string, string][]).concat(STAGES.map(s => [s.key, s.label])).map(([k, label]) => {
            const count = k ? byStage[k as LifecycleStage]?.length ?? 0 : contacts.length
            const active = stageFilter === k
            return (
              <button
                key={k}
                onClick={() => setStageFilter(k as LifecycleStage | '')}
                style={{
                  padding: '5px 12px', borderRadius: 100,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
                  background: active ? 'var(--accent)' : 'var(--bg)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {label}
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '0 5px', borderRadius: 100,
                  background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg)',
                  border: active ? 'none' : '1px solid var(--border2)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Extra filters */}
        {showFilters && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value as Source | '')}
              style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit' }}
            >
              <option value="">Alle Quellen</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as Priority | '')}
              style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit' }}
            >
              <option value="">Alle Prioritäten</option>
              <option value="vip">VIP</option>
              <option value="standard">Standard</option>
              <option value="grosskunde">Großkunde</option>
            </select>
            {(sourceFilter || priorityFilter) && (
              <button
                onClick={() => { setSourceFilter(''); setPriorityFilter('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}
              ><X size={13} /> Zurücksetzen</button>
            )}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[0,1,2,3].map(col => (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton" style={{ height: 32, borderRadius: 8 }} />
                {[0,1].map(i => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />)}
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ opacity: 0.25, marginBottom: 12 }}><Users size={36} /></div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Noch keine Kontakte</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
              Lege deinen ersten Kontakt an oder importiere eine CSV-Datei.
            </p>
            <button
              onClick={() => setShowNew(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            ><Plus size={15} /> Ersten Kontakt anlegen</button>
          </div>
        ) : view === 'kanban' ? (
          /* ── Kanban ── */
          <div className="crm-kanban" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {STAGES.map(stage => {
              const cols = stageFilter ? (stageFilter === stage.key ? byStage[stage.key] : []) : byStage[stage.key]
              return (
                <div key={stage.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, padding: '6px 8px', borderRadius: 8, background: stage.bg }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.label}</span>
                    <span style={{ fontSize: 11, color: stage.color, opacity: 0.7, marginLeft: 'auto' }}>{cols.length}</span>
                  </div>
                  {cols.map(c => (
                    <ContactCard key={c.id} contact={c} onClick={() => setSelectedContact(c)} />
                  ))}
                  {cols.length === 0 && (
                    <div style={{ padding: '20px 8px', textAlign: 'center' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Keine Kontakte</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* ── List ── */
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', padding: '8px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kontakt</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Umsatz · Datum</span>
            </div>
            {contacts.map(c => <ContactRow key={c.id} contact={c} onClick={() => setSelectedContact(c)} />)}
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {selectedContact && (
        <ContactPanel
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      {/* ── New contact modal ── */}
      {showNew && <NewContactModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}

      {/* Hidden file input for CSV import */}
      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleImport} />

      <style>{`
        @keyframes crm-spin { to { transform: rotate(360deg); } }
        @media(max-width:900px) { .crm-kanban { grid-template-columns: repeat(2,1fr) !important; } }
        @media(max-width:540px) { .crm-kanban { grid-template-columns: 1fr !important; } .crm-btn-label { display: none !important; } }
      `}</style>
    </div>
  )
}
