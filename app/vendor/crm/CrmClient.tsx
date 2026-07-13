'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Users, Plus, Search, Filter, Download, Upload, RefreshCw,
  Phone, Mail, Calendar, Euro, X, Check,
  Star, Building2,
  Pencil, Trash2, CheckSquare, Square, Clock,
  Heart, Briefcase, PartyPopper, HelpCircle,
  MapPin, MessageSquare, User, Circle, ChevronDown, ChevronUp, ArrowUpDown,
  LayoutGrid, List, ListChecks, Copy, MessageCircle, UserPlus,
} from 'lucide-react'
import CrmImportDialog from '@/components/vendor/CrmImportDialog'
import ToggleSwitch from '@/components/ui/ToggleSwitch'

// ── Types ──────────────────────────────────────────────────────
type LifecycleStage = 'lead' | 'anfrage' | 'gebucht' | 'ehemalig'
type Source = 'empfehlung' | 'marktplatz' | 'website' | 'messe' | 'sonstige' | 'custom'
type Priority = 'vip' | 'standard' | 'grosskunde'
type EventType = 'hochzeit' | 'firmenevent' | 'privat' | 'sonstige'
type ActivityType = 'note' | 'call' | 'meeting' | 'offer_sent' | 'offer_accepted' | 'offer_declined' | 'stage_change' | 'imported'

interface ContactPerson { id: string; name: string; email: string; phone: string; role: string }
interface Task { id: string; contact_id: string | null; title: string; due_at: string | null; done: boolean; done_at: string | null }
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
  pending_offer_value: number | null
  couple_budget: number | null
  notes: string
  priority: Priority
  custom_tags: string[]
  offer_id: string | null
  event_id: string | null
  request_id: string | null
  partner_contact_id: string | null
  anniversary_remind: boolean
  guest_count: number | null
  location: string
  event_title: string
  request_message: string
  home_street: string
  home_postal_code: string
  home_city: string
  birthday: string | null
  created_at: string
  updated_at: string
  crm_contact_persons?: ContactPerson[]
  crm_tasks?: Task[]
}

// ── Constants ──────────────────────────────────────────────────
const STAGES: { key: LifecycleStage; label: string; color: string; bg: string; dot: string }[] = [
  { key: 'lead',     label: 'Lead',     color: '#6B7280', bg: 'rgba(107,114,128,0.10)', dot: '#9CA3AF' },
  { key: 'anfrage',  label: 'Anfrage',  color: '#B89968', bg: 'rgba(184,153,104,0.13)', dot: '#B89968' },
  { key: 'gebucht',  label: 'Gebucht',  color: '#1E7E34', bg: 'rgba(30,126,52,0.12)',   dot: '#22C55E' },
  { key: 'ehemalig', label: 'Ehemalig', color: '#2352C8', bg: 'rgba(35,82,200,0.10)',   dot: '#2352C8' },
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

function formatDateShort(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' })
}

function relDate(s: string): string {
  const diff = Date.now() - new Date(s).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Heute'
  if (d === 1) return 'Gestern'
  if (d < 7) return `vor ${d} Tagen`
  if (d < 30) return `vor ${Math.floor(d / 7)} Wo.`
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' })
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function stageFor(key: LifecycleStage) {
  return STAGES.find(s => s.key === key) ?? STAGES[0]
}

function daysUntilAnniversary(weddingDate: string): number | null {
  const now = new Date()
  const wd = new Date(weddingDate)
  const thisYear = new Date(now.getFullYear(), wd.getMonth(), wd.getDate())
  if (thisYear < now) thisYear.setFullYear(now.getFullYear() + 1)
  return Math.ceil((thisYear.getTime() - now.getTime()) / 86400000)
}

function daysUntilBirthday(birthday: string): number | null {
  const now = new Date()
  const bd = new Date(birthday)
  const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate())
  if (thisYear < now) thisYear.setFullYear(now.getFullYear() + 1)
  return Math.ceil((thisYear.getTime() - now.getTime()) / 86400000)
}

function emptyContact(): Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'crm_contact_persons' | 'crm_tasks'> {
  return {
    name: '', email: '', phone: '', address_line1: '', address_line2: '',
    lifecycle_stage: 'lead', source: 'sonstige', event_type: 'hochzeit',
    wedding_date: null, deal_value: null, pending_offer_value: null, couple_budget: null,
    notes: '', priority: 'standard', custom_tags: [],
    offer_id: null, event_id: null, request_id: null, partner_contact_id: null,
    anniversary_remind: false, guest_count: null, location: '', event_title: '', request_message: '',
    home_street: '', home_postal_code: '', home_city: '', birthday: null,
  }
}

// ── Stage Badge ────────────────────────────────────────────────
function StageBadge({ stage, small }: { stage: LifecycleStage; small?: boolean }) {
  const s = stageFor(stage)
  return (
    <span style={{
      fontSize: small ? 10 : 11, fontWeight: 600,
      padding: small ? '1px 6px' : '2px 8px', borderRadius: 100,
      color: s.color, background: s.bg, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

// ── Field label in panel ───────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
      {children}
    </p>
  )
}

// ── Info Cell ──────────────────────────────────────────────────
function InfoCell({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  if (!value) return null
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {href
        ? <a href={href} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>{value}</a>
        : <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{value}</p>
      }
    </div>
  )
}

// ── Person card (couple / additional persons) ──────────────────
function PersonView({ name, role, email, phone, accent }: { name: string; role: string; email: string; phone: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 11px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: accent ? 'var(--accent)' : 'var(--surface)', border: accent ? 'none' : '1px solid var(--border2)', color: accent ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
        {initials(name || '?')}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || '—'}</p>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 100, flexShrink: 0 }}>{role}</span>
        </div>
        {(email || phone) && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {email && <a href={`mailto:${email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{email}</a>}
            {phone && <a href={`tel:${phone}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{phone}</a>}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Contact Row (list) ─────────────────────────────────────────
function ContactRow({ contact, selected, onClick, onStageChange }: {
  contact: Contact; selected: boolean; onClick: () => void
  onStageChange?: (stage: LifecycleStage) => void
}) {
  const s = stageFor(contact.lifecycle_stage)
  const eventLine = contact.event_title || EVENT_TYPE_LABELS[contact.event_type]

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: selected ? 'var(--accent-light)' : 'transparent',
        transition: 'background .1s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(35,82,200,0.04)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: selected ? 'var(--accent)' : 'rgba(35,82,200,0.12)',
        color: selected ? '#fff' : 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
      }}>{initials(contact.name)}</div>

      {/* Name (fett) + Event (klein, darf abgeschnitten werden) — alles andere in der Detailansicht */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.name}
        </p>
        {eventLine && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {eventLine}
          </p>
        )}
      </div>

      {/* Stage */}
      <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {onStageChange ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select
              value={contact.lifecycle_stage}
              onChange={e => onStageChange(e.target.value as LifecycleStage)}
              style={{
                appearance: 'none', WebkitAppearance: 'none',
                fontSize: 11, fontWeight: 600,
                padding: '2px 18px 2px 8px', borderRadius: 100,
                color: s.color, background: s.bg, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
            </select>
            <ChevronDown size={9} style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', color: s.color, pointerEvents: 'none' }} />
          </div>
        ) : (
          <StageBadge stage={contact.lifecycle_stage} />
        )}
      </div>
    </div>
  )
}

// ── Kanban Card ────────────────────────────────────────────────
function KanbanCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const ETypeIcon = EVENT_TYPE_ICONS[contact.event_type] ?? HelpCircle
  const openTasks = contact.crm_tasks?.filter(t => !t.done).length ?? 0
  const anniv = contact.anniversary_remind && contact.wedding_date ? daysUntilAnniversary(contact.wedding_date) : null

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('crm-contact-id', contact.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '14px', marginBottom: 8, cursor: 'grab',
        transition: 'box-shadow .15s, border-color .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'rgba(35,82,200,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ display: 'flex', gap: 9, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'rgba(35,82,200,0.12)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}>{initials(contact.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {contact.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <ETypeIcon size={10} style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{EVENT_TYPE_LABELS[contact.event_type]}</span>
          </div>
        </div>
      </div>
      {(contact.email || contact.phone) && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.email || contact.phone}
        </div>
      )}
      {contact.wedding_date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
          <Calendar size={10} /> {formatDateShort(contact.wedding_date)}
          {contact.guest_count && <span> · {contact.guest_count} Gäste</span>}
        </div>
      )}
      {contact.deal_value != null && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{formatEur(contact.deal_value)}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{relDate(contact.updated_at)}</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {anniv != null && anniv <= 30 && <span style={{ fontSize: 10, color: '#E84393', fontWeight: 600 }}>Jub. {anniv}d</span>}
          {openTasks > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(35,82,200,0.12)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 100 }}>{openTasks}T</span>}
        </div>
      </div>
    </div>
  )
}

// ── Contact Detail Panel ───────────────────────────────────────
function ContactPanel({
  contact, onClose, onUpdated, onDeleted, onOpenById,
}: {
  contact: Contact
  onClose: () => void
  onUpdated: (c: Contact) => void
  onDeleted: (id: string) => void
  onOpenById?: (id: string) => void
}) {
  const [tab, setTab] = useState<'info' | 'aktivitaeten' | 'aufgaben'>('info')
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingActs, setLoadingActs] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...contact })
  const [saving, setSaving] = useState(false)
  const [stageChanging, setStageChanging] = useState(false)
  const [newActivity, setNewActivity] = useState<{ type: ActivityType; title: string; body: string } | null>(null)
  const [newTask, setNewTask] = useState<{ title: string; due_at: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [persons, setPersons] = useState<Omit<ContactPerson, 'id'>[]>(
    (contact.crm_contact_persons ?? []).map(p => ({ name: p.name, email: p.email, phone: p.phone, role: p.role }))
  )
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    setForm({ ...contact })
    setPersons((contact.crm_contact_persons ?? []).map(p => ({ name: p.name, email: p.email, phone: p.phone, role: p.role })))
  }, [contact])

  // Aktivitäten und Aufgaben beide direkt laden (für Tab-Zähler + schnellen Wechsel)
  useEffect(() => {
    setLoadingActs(true)
    fetch(`/api/vendor/crm/activities?contactId=${contact.id}`)
      .then(r => r.json())
      .then(d => { setActivities(d.activities ?? []); setLoadingActs(false) })
      .catch(() => setLoadingActs(false))
    fetch(`/api/vendor/crm/tasks?contactId=${contact.id}&done=true`)
      .then(r => r.json())
      .then(d => setTasks(d.tasks ?? []))
      .catch(() => {})
  }, [contact.id])

  async function save() {
    setSaving(true)
    const cleanPersons = persons.filter(p => p.name.trim() || p.email.trim() || p.phone.trim())
    const res = await fetch(`/api/vendor/crm/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        deal_value: form.deal_value ? Number(form.deal_value) : null,
        couple_budget: form.couple_budget ? Number(form.couple_budget) : null,
        guest_count: form.guest_count ? Number(form.guest_count) : null,
        wedding_date: form.wedding_date || null,
        additional_persons: cleanPersons,
      }),
    })
    const json = await res.json()
    if (json.contact) {
      onUpdated({ ...contact, ...json.contact, crm_contact_persons: cleanPersons.map((p, i) => ({ id: `tmp-${i}`, ...p })) })
      setEditing(false)
    }
    setSaving(false)
  }

  function addPerson() { setPersons(ps => [...ps, { name: '', email: '', phone: '', role: 'partner' }]) }
  function updatePerson(i: number, patch: Partial<Omit<ContactPerson, 'id'>>) { setPersons(ps => ps.map((p, idx) => idx === i ? { ...p, ...patch } : p)) }
  function removePerson(i: number) { setPersons(ps => ps.filter((_, idx) => idx !== i)) }
  async function copyToClipboard(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(c => (c === key ? null : c)), 1400) } catch { /* ignore */ }
  }
  function roleLabel(role: string): string {
    const map: Record<string, string> = { partner: 'Partner/in', additional: 'Weitere Person', planner: 'Planer/in', trauzeuge: 'Trauzeuge/in', family: 'Familie' }
    return map[role] ?? (role || 'Person')
  }

  async function quickChangeStage(newStage: LifecycleStage) {
    if (newStage === contact.lifecycle_stage || stageChanging) return
    setStageChanging(true)
    const res = await fetch(`/api/vendor/crm/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lifecycle_stage: newStage }),
    })
    const json = await res.json()
    if (json.contact) onUpdated({ ...contact, ...json.contact })
    setStageChanging(false)
  }

  async function addActivity() {
    if (!newActivity?.title.trim()) return
    const res = await fetch('/api/vendor/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, ...newActivity }),
    })
    const json = await res.json()
    if (json.activity) { setActivities(prev => [json.activity, ...prev]); setNewActivity(null) }
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

  function SI(label: string, field: keyof typeof form, type = 'text') {
    return (
      <div key={field} style={{ marginBottom: 12 }}>
        <FieldLabel>{label}</FieldLabel>
        <input
          type={type}
          value={(form[field] as string) ?? ''}
          onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>
    )
  }

  const selStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const miniInput: React.CSSProperties = { padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--surface)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' }

  const anniv = contact.anniversary_remind && contact.wedding_date ? daysUntilAnniversary(contact.wedding_date) : null

  return (
    <div className="crm-lb-overlay" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,25,45,0.45)', backdropFilter: 'blur(2px)' }} />
      <div className="crm-lb" style={{
        position: 'relative', zIndex: 1, width: '80vw', height: '85vh',
        maxWidth: 1040, maxHeight: 900,
        background: 'var(--surface)', borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(20,25,45,0.35)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* ── Header ── */}
        <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 13, flexShrink: 0,
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, fontWeight: 700,
            }}>{initials(contact.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{contact.name}</h2>
                {contact.priority === 'vip' && <Star size={13} style={{ color: '#F59E0B' }} />}
                {contact.priority === 'grosskunde' && <Building2 size={13} style={{ color: '#6366F1' }} />}
              </div>
              {(contact.crm_contact_persons?.length ?? 0) > 0 && (
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Heart size={11} style={{ color: '#E84393', flexShrink: 0 }} />
                  {[contact.name, ...(contact.crm_contact_persons ?? []).map(p => p.name)].filter(Boolean).join('  &  ')}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {(() => {
                  const st = stageFor(contact.lifecycle_stage)
                  return (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <select
                        value={contact.lifecycle_stage}
                        onChange={e => quickChangeStage(e.target.value as LifecycleStage)}
                        disabled={stageChanging || editing}
                        title="Status ändern"
                        style={{
                          appearance: 'none', WebkitAppearance: 'none',
                          fontSize: 11, fontWeight: 600,
                          padding: '2px 20px 2px 8px', borderRadius: 100,
                          color: st.color, background: st.bg, border: 'none',
                          cursor: editing ? 'default' : 'pointer',
                          fontFamily: 'inherit', whiteSpace: 'nowrap',
                          opacity: stageChanging ? 0.6 : 1,
                        }}
                      >
                        {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      <ChevronDown size={9} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: st.color, pointerEvents: 'none' }} />
                    </div>
                  )
                })()}
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{SOURCE_LABELS[contact.source]}</span>
                {contact.event_title && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {contact.event_title}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!editing && (
                <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                  <Pencil size={12} /> Bearbeiten
                </button>
              )}
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Quick action buttons */}
          {!editing && (contact.email || contact.phone) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {contact.email && (
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--bg)', overflow: 'hidden' }}>
                  <a href={`mailto:${contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', textDecoration: 'none', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Mail size={13} /> {contact.email}
                  </a>
                  <button onClick={() => copyToClipboard(contact.email, 'h-email')} title="E-Mail kopieren" style={{ padding: '7px 9px', border: 'none', borderLeft: '1px solid var(--border2)', background: 'none', cursor: 'pointer', color: copied === 'h-email' ? '#1E7E34' : 'var(--text-tertiary)', display: 'flex' }}>
                    {copied === 'h-email' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              )}
              {contact.phone && (
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--bg)', overflow: 'hidden' }}>
                  <a href={`tel:${contact.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', textDecoration: 'none', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Phone size={13} /> {contact.phone}
                  </a>
                  <a href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ padding: '7px 9px', borderLeft: '1px solid var(--border2)', color: '#1E7E34', display: 'flex' }}>
                    <MessageCircle size={13} />
                  </a>
                  <button onClick={() => copyToClipboard(contact.phone, 'h-phone')} title="Telefon kopieren" style={{ padding: '7px 9px', border: 'none', borderLeft: '1px solid var(--border2)', background: 'none', cursor: 'pointer', color: copied === 'h-phone' ? '#1E7E34' : 'var(--text-tertiary)', display: 'flex' }}>
                    {copied === 'h-phone' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Anniversary alert */}
          {anniv != null && anniv <= 30 && (
            <div style={{ background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.22)', borderRadius: 9, padding: '8px 12px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Heart size={13} style={{ color: '#E84393', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#C2355D', margin: 0 }}>Jahrestag in <strong>{anniv} Tag{anniv !== 1 ? 'en' : ''}</strong> — {formatDate(contact.wedding_date)}</p>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 4, marginTop: 2 }}>
            {(['info', 'aktivitaeten', 'aufgaben'] as const).map(t => {
              const openTasks = tasks.filter(x => !x.done).length
              const count = t === 'aktivitaeten' ? activities.length : t === 'aufgaben' ? openTasks : 0
              const label = t === 'info' ? 'Info' : t === 'aktivitaeten' ? 'Aktivitäten' : 'Aufgaben'
              return (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: '0 0 auto', padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: tab === t ? 700 : 500,
                  color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {label}
                  {count > 0 && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, background: tab === t ? 'var(--accent)' : 'var(--border)', color: tab === t ? '#fff' : 'var(--text-secondary)', padding: '0 6px', borderRadius: 100, minWidth: 16, textAlign: 'center' }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="crm-lb-content" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>

          {/* ── INFO TAB ── */}
          {tab === 'info' && (
            editing ? (
              <div>
                {SI('Name', 'name')}
                <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SI('E-Mail', 'email', 'email')}
                  {SI('Telefon', 'phone', 'tel')}
                </div>
                {SI('Straße & Hausnummer', 'address_line1')}
                {SI('PLZ & Ort', 'address_line2')}
                {SI('Wohnstraße', 'home_street')}
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10 }}>
                  {SI('Wohn-PLZ', 'home_postal_code')}
                  {SI('Wohnort', 'home_city')}
                </div>
                <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ marginBottom: 12 }}>
                    <FieldLabel>Status</FieldLabel>
                    <select value={form.lifecycle_stage} onChange={e => setForm(f => ({ ...f, lifecycle_stage: e.target.value as LifecycleStage }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit' }}>
                      {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <FieldLabel>Priorität</FieldLabel>
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit' }}>
                      <option value="standard">Standard</option>
                      <option value="vip">VIP</option>
                      <option value="grosskunde">Großkunde</option>
                    </select>
                  </div>
                </div>
                <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SI('Hochzeitsdatum', 'wedding_date', 'date')}
                  {SI('Umsatz (€)', 'deal_value', 'number')}
                </div>
                {SI('Geburtstag', 'birthday', 'date')}
                <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ marginBottom: 12 }}>
                    <FieldLabel>Quelle</FieldLabel>
                    <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as Source }))} style={selStyle}>
                      {Object.entries(SOURCE_LABELS).filter(([k]) => k !== 'custom').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <FieldLabel>Event-Typ</FieldLabel>
                    <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value as EventType }))} style={selStyle}>
                      {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                {SI('Veranstaltungsort', 'location')}
                {SI('Event-Titel', 'event_title')}
                <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SI('Gästeanzahl', 'guest_count', 'number')}
                  {SI('Paar-Budget (€)', 'couple_budget', 'number')}
                </div>

                {/* ── Personen / Brautpaar bearbeiten ── */}
                <div style={{ marginBottom: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <FieldLabel>Weitere Personen (Partner/in etc.)</FieldLabel>
                    <button type="button" onClick={addPerson} style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border2)', background: 'var(--bg)', borderRadius: 7, padding: '4px 9px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                      <UserPlus size={12} /> Person
                    </button>
                  </div>
                  {persons.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 6px' }}>Noch keine weiteren Personen erfasst.</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {persons.map((p, i) => (
                      <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'var(--bg)' }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input placeholder="Name" value={p.name} onChange={e => updatePerson(i, { name: e.target.value })} style={{ ...miniInput, flex: 1 }} />
                          <input placeholder="Rolle" value={p.role} onChange={e => updatePerson(i, { role: e.target.value })} style={{ ...miniInput, width: 120 }} />
                          <button type="button" onClick={() => removePerson(i)} title="Entfernen" style={{ border: '1px solid var(--border2)', background: 'var(--surface)', borderRadius: 7, padding: '0 9px', cursor: 'pointer', color: '#C5221F', flexShrink: 0 }}><Trash2 size={13} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <input placeholder="E-Mail" value={p.email} onChange={e => updatePerson(i, { email: e.target.value })} style={miniInput} />
                          <input placeholder="Telefon" value={p.phone} onChange={e => updatePerson(i, { phone: e.target.value })} style={miniInput} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <FieldLabel>Notizen</FieldLabel>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <ToggleSwitch checked={form.anniversary_remind} onChange={v => setForm(f => ({ ...f, anniversary_remind: v }))} size="sm" aria-label="Jahrestags-Erinnerung" />
                  Jahrestags-Erinnerung
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={save} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                    {saving ? 'Speichern…' : 'Speichern'}
                  </button>
                  <button onClick={() => { setEditing(false); setForm({ ...contact }) }} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid var(--border2)', background: 'none', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* ── Adresse & Geburtstag — E-Mail/Telefon stehen bereits oben in den
                     Schnellaktionen, daher hier nicht nochmal doppelt. ── */}
                {(contact.home_city || contact.address_line1 || contact.address_line2 || contact.birthday) && (
                  <section style={{ marginBottom: 22 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Adresse &amp; Geburtstag</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {contact.home_city && (
                        <div style={{ gridColumn: '1/-1' }}>
                          <FieldLabel>Wohnadresse</FieldLabel>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                            {[contact.home_street, [contact.home_postal_code, contact.home_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      )}
                      {!contact.home_city && (contact.address_line1 || contact.address_line2) && (
                        <div style={{ gridColumn: '1/-1' }}>
                          <FieldLabel>Adresse</FieldLabel>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                            {[contact.address_line1, contact.address_line2].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      )}
                      {contact.birthday && (
                        <div style={{ gridColumn: '1/-1' }}>
                          <FieldLabel>Geburtstag</FieldLabel>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                            {formatDate(contact.birthday)}
                            {(() => { const d = daysUntilBirthday(contact.birthday); return d != null && d <= 14 ? <span style={{ marginLeft: 8, fontSize: 11, color: '#D97706', fontWeight: 600 }}> — in {d} Tagen</span> : null })()}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* ── Personen / Brautpaar ── */}
                <section style={{ marginBottom: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                      {contact.event_type === 'hochzeit' ? 'Brautpaar / Personen' : 'Personen'}
                    </p>
                    {!editing && (
                      <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent)', fontFamily: 'inherit', fontWeight: 600 }}>
                        <Pencil size={11} /> Bearbeiten
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    {/* Person 1 = Hauptkontakt */}
                    <PersonView name={contact.name} role="Hauptkontakt" email={contact.email} phone={contact.phone} accent />
                    {(contact.crm_contact_persons ?? []).map(p => (
                      <PersonView key={p.id} name={p.name} role={roleLabel(p.role)} email={p.email} phone={p.phone} />
                    ))}
                  </div>
                  {(contact.crm_contact_persons?.length ?? 0) === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '10px 0 0' }}>
                      Nur der Hauptkontakt ist erfasst. Über &bdquo;Bearbeiten&ldquo; kannst du Partner/in und weitere Personen mit eigenen Namen &amp; Kontaktdaten ergänzen.
                    </p>
                  )}
                </section>

                {/* ── Veranstaltungsinfo ── */}
                {(contact.wedding_date || contact.location || contact.event_title || contact.guest_count != null || contact.deal_value != null || contact.pending_offer_value != null || contact.couple_budget != null) && (
                  <section style={{ marginBottom: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Veranstaltung</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <InfoCell label="Datum" value={formatDate(contact.wedding_date)} />
                      {contact.guest_count != null && <InfoCell label="Gästeanzahl" value={`${contact.guest_count} Personen`} />}
                      <InfoCell label="Typ" value={EVENT_TYPE_LABELS[contact.event_type]} />
                      {contact.deal_value != null && <InfoCell label="Umsatz" value={formatEur(contact.deal_value)} />}
                      {contact.pending_offer_value != null && contact.deal_value == null && (
                        <div>
                          <FieldLabel>Angebotsvolumen</FieldLabel>
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>{formatEur(contact.pending_offer_value)} (noch offen)</p>
                        </div>
                      )}
                      {contact.couple_budget != null && (
                        <div>
                          <FieldLabel>Paar-Gesamtbudget</FieldLabel>
                          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>{formatEur(contact.couple_budget)}</p>
                        </div>
                      )}
                      {contact.location && <div style={{ gridColumn: '1/-1' }}><InfoCell label="Veranstaltungsort" value={contact.location} /></div>}
                    </div>
                  </section>
                )}

                {/* ── Anfrage-Nachricht ── */}
                {contact.request_message && (
                  <section style={{ marginBottom: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Anfrage-Nachricht</p>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <MessageSquare size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {contact.request_message}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* ── Notizen ── */}
                {contact.notes && (
                  <section style={{ marginBottom: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Notizen</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {contact.notes}
                    </p>
                  </section>
                )}

                {/* ── Partner-Verlinkung ── */}
                {contact.partner_contact_id && (
                  <section style={{ marginBottom: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Verknüpfte Person</p>
                    <button
                      onClick={() => onOpenById?.(contact.partner_contact_id!)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 13 }}
                    >
                      <User size={13} style={{ color: 'var(--accent)' }} />
                      <span>Partner-Kontakt öffnen</span>
                    </button>
                  </section>
                )}

                {/* ── Verknüpfte Quellen ── */}
                {(contact.offer_id || contact.event_id || contact.request_id) && (
                  <section style={{ marginBottom: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Verknüpfte Quellen</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {contact.event_id && (
                        <a href={`/vendor/dashboard/${contact.event_id}/informationen`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)', textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 13 }}>
                          <Calendar size={13} style={{ color: 'var(--accent)' }} />
                          <span>Event öffnen</span>
                          {contact.event_title && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>· {contact.event_title}</span>}
                        </a>
                      )}
                      {contact.offer_id && (
                        <Link href="/vendor/angebote" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)', textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 13 }}>
                          <Euro size={13} style={{ color: 'var(--accent)' }} />
                          <span>Angebot ansehen</span>
                        </Link>
                      )}
                      {contact.request_id && (
                        <a href="/vendor/anfragen" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)', textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 13 }}>
                          <MessageSquare size={13} style={{ color: 'var(--accent)' }} />
                          <span>Anfrage öffnen</span>
                        </a>
                      )}
                    </div>
                  </section>
                )}

                {/* ── Löschen ── */}
                <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(197,34,31,0.25)', background: 'rgba(197,34,31,0.05)', cursor: 'pointer', fontSize: 12, color: '#C5221F', fontFamily: 'inherit' }}>
                      <Trash2 size={13} /> Kontakt löschen
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <p style={{ fontSize: 13, color: '#C5221F', margin: 0 }}>Wirklich löschen?</p>
                      <button onClick={deleteContact} disabled={deleting} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#C5221F', color: '#fff', fontSize: 13, cursor: deleting ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Ja, löschen</button>
                      <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>Abbrechen</button>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* ── AKTIVITÄTEN TAB ── */}
          {tab === 'aktivitaeten' && (
            <div>
              {newActivity ? (
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid var(--border2)' }}>
                  <select value={newActivity.type} onChange={e => setNewActivity(a => a ? { ...a, type: e.target.value as ActivityType } : null)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', marginBottom: 8 }}>
                    {(['note', 'call', 'meeting'] as const).map(t => <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>)}
                  </select>
                  <input placeholder="Titel" value={newActivity.title} onChange={e => setNewActivity(a => a ? { ...a, title: e.target.value } : null)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }} />
                  <textarea placeholder="Details (optional)" value={newActivity.body} onChange={e => setNewActivity(a => a ? { ...a, body: e.target.value } : null)} rows={2} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addActivity} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Hinzufügen</button>
                    <button onClick={() => setNewActivity(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setNewActivity({ type: 'note', title: '', body: '' })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px dashed var(--border2)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit', marginBottom: 16, width: '100%' }}>
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
                <div>
                  {activities.map((act, i) => (
                    <div key={act.id} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: ACTIVITY_COLORS[act.activity_type] + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Circle size={9} style={{ color: ACTIVITY_COLORS[act.activity_type] }} />
                        </div>
                        {i < activities.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>{act.title}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>{ACTIVITY_LABELS[act.activity_type]} · {relDate(act.activity_at)}</p>
                            {act.body && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '5px 0 0', whiteSpace: 'pre-wrap' }}>{act.body}</p>}
                          </div>
                          {!act.auto_generated && (
                            <button onClick={() => deleteActivity(act.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}><Trash2 size={12} /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AUFGABEN TAB ── */}
          {tab === 'aufgaben' && (
            <div>
              {newTask ? (
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid var(--border2)' }}>
                  <input placeholder="Aufgabe" value={newTask.title} onChange={e => setNewTask(t => t ? { ...t, title: e.target.value } : null)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }} />
                  <input type="date" value={newTask.due_at} onChange={e => setNewTask(t => t ? { ...t, due_at: e.target.value } : null)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'white', fontSize: 13, fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addTask} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Hinzufügen</button>
                    <button onClick={() => setNewTask(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border2)', background: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setNewTask({ title: '', due_at: '' })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px dashed var(--border2)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit', marginBottom: 16, width: '100%' }}>
                  <Plus size={14} /> Aufgabe hinzufügen
                </button>
              )}
              {tasks.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Keine Aufgaben.</p>
              ) : tasks.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <button onClick={() => toggleTask(task)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: task.done ? '#1E7E34' : 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }}>
                    {task.done ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: task.done ? 'var(--text-tertiary)' : 'var(--text-primary)', margin: 0, textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</p>
                    {task.due_at && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {formatDate(task.due_at)}</p>}
                  </div>
                  <button onClick={() => deleteTask(task.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <style>{`
          .crm-lb-overlay { animation: crm-lb-fade 140ms ease; }
          @keyframes crm-lb-fade { from { opacity: 0 } to { opacity: 1 } }
          @media (max-width: 760px) {
            .crm-lb-overlay { padding: 0 !important; }
            .crm-lb { width: 100vw !important; height: 100dvh !important; border-radius: 0 !important; max-width: none !important; max-height: none !important; }
            .crm-lb-content { padding-left: 16px !important; padding-right: 16px !important; }
          }
        `}</style>
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

  function F(label: string, field: keyof typeof form, type = 'text') {
    return (
      <div key={field} style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
        <input type={type} value={(form[field] as string) ?? ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />
      <div style={{ position: 'relative', zIndex: 1, background: 'var(--surface)', borderRadius: 16, padding: '28px', width: '100%', maxWidth: 460, maxHeight: '90dvh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(35,82,200,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Neuer Kontakt</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>
        {F('Name *', 'name')}
        <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {F('E-Mail', 'email', 'email')}
          {F('Telefon', 'phone', 'tel')}
        </div>
        {F('Straße & Nr.', 'address_line1')}
        {F('PLZ & Ort', 'address_line2')}
        <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={form.lifecycle_stage} onChange={e => setForm(f => ({ ...f, lifecycle_stage: e.target.value as LifecycleStage }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 14, fontFamily: 'inherit' }}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Quelle</label>
            <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as Source }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 14, fontFamily: 'inherit' }}>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="crm-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {F('Hochzeitsdatum', 'wedding_date', 'date')}
          {F('Budget / Umsatz (€)', 'deal_value', 'number')}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={submit} disabled={saving || !form.name.trim()} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: (saving || !form.name.trim()) ? 'not-allowed' : 'pointer', opacity: !form.name.trim() ? 0.5 : 1, fontFamily: 'inherit' }}>
            {saving ? 'Erstellen…' : 'Kontakt erstellen'}
          </button>
          <button onClick={onClose} style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border2)', background: 'none', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function CrmClient() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<LifecycleStage | ''>('')
  const [sourceFilter, setSourceFilter] = useState<Source | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [homeCityFilter, setHomeCityFilter] = useState('')
  const [eventCityFilter, setEventCityFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [autoImporting, setAutoImporting] = useState(false)
  const [autoImportResult, setAutoImportResult] = useState<number | null>(null)
  const [sortCol, setSortCol] = useState<'name' | 'deal_value' | 'wedding_date' | 'updated_at'>('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showGlobalTasks, setShowGlobalTasks] = useState(false)
  const [globalTasks, setGlobalTasks] = useState<(Task & { crm_contacts?: { id: string; name: string } | null })[]>([])
  const [loadingGlobalTasks, setLoadingGlobalTasks] = useState(false)
  const [dragOverStage, setDragOverStage] = useState<LifecycleStage | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchContacts = useCallback(async (q?: string, stage?: string, source?: string, priority?: string, homeCity?: string, eventCity?: string) => {
    const params = new URLSearchParams()
    if (q) params.set('search', q)
    if (stage) params.set('stage', stage)
    if (source) params.set('source', source)
    if (priority) params.set('priority', priority)
    if (homeCity) params.set('home_city', homeCity)
    if (eventCity) params.set('event_city', eventCity)
    const res = await fetch(`/api/vendor/crm/contacts?${params}`)
    const json = await res.json()
    setContacts(json.contacts ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  // Debounce search
  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetchContacts(val, stageFilter, sourceFilter, priorityFilter, homeCityFilter, eventCityFilter)
    }, 320)
  }

  function applyFilters(stage = stageFilter, source = sourceFilter, priority = priorityFilter, homeCity = homeCityFilter, eventCity = eventCityFilter) {
    fetchContacts(search, stage, source, priority, homeCity, eventCity)
  }

  function handleCityFilter(type: 'home' | 'event', val: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (type === 'home') {
      setHomeCityFilter(val)
      searchTimer.current = setTimeout(() => applyFilters(stageFilter, sourceFilter, priorityFilter, val, eventCityFilter), 320)
    } else {
      setEventCityFilter(val)
      searchTimer.current = setTimeout(() => applyFilters(stageFilter, sourceFilter, priorityFilter, homeCityFilter, val), 320)
    }
  }

  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      let va: string | number | null, vb: string | number | null
      if (sortCol === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase() }
      else if (sortCol === 'deal_value') { va = a.deal_value; vb = b.deal_value }
      else if (sortCol === 'wedding_date') { va = a.wedding_date; vb = b.wedding_date }
      else { va = a.updated_at; vb = b.updated_at }
      if (va == null && vb == null) return 0
      if (va == null) return sortDir === 'asc' ? -1 : 1
      if (vb == null) return sortDir === 'asc' ? 1 : -1
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [contacts, sortCol, sortDir])

  const byStage = useMemo(() => {
    const map: Record<LifecycleStage, Contact[]> = { lead: [], anfrage: [], gebucht: [], ehemalig: [] }
    for (const c of contacts) map[c.lifecycle_stage].push(c)
    return map
  }, [contacts])

  const totalValue = useMemo(() => contacts.reduce((s, c) => s + (c.deal_value ?? 0), 0), [contacts])

  const anniversaryAlerts = useMemo(() => contacts.filter(c => {
    if (!c.anniversary_remind || !c.wedding_date) return false
    const d = daysUntilAnniversary(c.wedding_date)
    return d != null && d <= 30
  }).sort((a, b) => (daysUntilAnniversary(a.wedding_date!)??999) - (daysUntilAnniversary(b.wedding_date!)??999)), [contacts])

  const birthdayAlerts = useMemo(() => contacts.filter(c => {
    if (!c.birthday) return false
    const d = daysUntilBirthday(c.birthday)
    return d != null && d <= 14
  }).sort((a, b) => (daysUntilBirthday(a.birthday!)??999) - (daysUntilBirthday(b.birthday!)??999)), [contacts])


  async function openContactById(id: string) {
    const found = contacts.find(c => c.id === id)
    if (found) { setSelectedContact(found); return }
    const res = await fetch(`/api/vendor/crm/contacts/${id}`)
    const json = await res.json()
    if (json.contact) setSelectedContact(json.contact)
  }

  async function fetchGlobalTasks() {
    setLoadingGlobalTasks(true)
    const res = await fetch('/api/vendor/crm/tasks?done=false')
    const json = await res.json()
    setGlobalTasks(json.tasks ?? [])
    setLoadingGlobalTasks(false)
  }

  async function toggleGlobalTask(task: Task) {
    const res = await fetch(`/api/vendor/crm/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !task.done }),
    })
    const json = await res.json()
    if (json.task) setGlobalTasks(prev => prev.filter(t => t.id !== task.id))
  }

  function handleCreated(c: Contact) { setContacts(prev => [c, ...prev]); setShowNew(false); setSelectedContact(c) }
  function handleUpdated(c: Contact) {
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, ...c } : x))
    setSelectedContact(c)
  }
  function handleDeleted(id: string) { setContacts(prev => prev.filter(c => c.id !== id)); setSelectedContact(null) }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)        // oeffnet die Mapping-Lightbox
    e.target.value = ''
  }

  async function handleAutoImport() {
    setAutoImporting(true); setAutoImportResult(null)
    const res = await fetch('/api/vendor/crm/auto-import', { method: 'POST' })
    const json = await res.json()
    setAutoImportResult(json.imported ?? 0)
    if (json.imported > 0) await fetchContacts(search, stageFilter, sourceFilter, priorityFilter)
    setAutoImporting(false)
  }

  const activeFilters = [stageFilter, sourceFilter, priorityFilter, homeCityFilter, eventCityFilter].filter(Boolean).length

  return (
    <div className="vnd-page-outer" style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>

      {/* Anniversary alerts */}
      {anniversaryAlerts.length > 0 && (
        <div style={{ background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Heart size={15} style={{ color: '#E84393', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#C2355D', margin: '0 0 4px' }}>Bevorstehende Jahrestage</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {anniversaryAlerts.slice(0, 5).map(c => (
                <span key={c.id} onClick={() => setSelectedContact(c)} style={{ fontSize: 12, color: '#C2355D', cursor: 'pointer', textDecoration: 'underline' }}>
                  {c.name} (in {daysUntilAnniversary(c.wedding_date!)}d)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Birthday alerts */}
      {birthdayAlerts.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Calendar size={15} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#B45309', margin: '0 0 4px' }}>Bevorstehende Geburtstage</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {birthdayAlerts.slice(0, 5).map(c => (
                <span key={c.id} onClick={() => setSelectedContact(c)} style={{ fontSize: 12, color: '#B45309', cursor: 'pointer', textDecoration: 'underline' }}>
                  {c.name} (in {daysUntilBirthday(c.birthday!)}d)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="vnd-page-card-nopad" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="vnd-hdr-icon" style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>CRM — Kundendaten</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                {contacts.length} Kontakt{contacts.length !== 1 ? 'e' : ''}
                {totalValue > 0 && ` · ${formatEur(totalValue)} Gesamtumsatz`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => { setShowGlobalTasks(true); fetchGlobalTasks() }} title="Alle offenen Aufgaben"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                <ListChecks size={13} />
                <span className="crm-btn-text">Aufgaben</span>
              </button>
              <button onClick={handleAutoImport} disabled={autoImporting} title="Aus Anfragen, Angeboten und Events importieren"
                className="crm-mob-hide"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 12, cursor: autoImporting ? 'wait' : 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                <RefreshCw size={13} style={{ animation: autoImporting ? 'crm-spin 1s linear infinite' : 'none' }} />
                <span className="crm-btn-text">Auto-Import</span>
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={!!importFile} className="crm-mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 12, cursor: importFile ? 'wait' : 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                <Upload size={13} /><span className="crm-btn-text">CSV Import</span>
              </button>
              <a href="/api/vendor/crm/import-template" title="Leer-Vorlage für den CSV-Import herunterladen" className="crm-mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                <Download size={13} /><span className="crm-btn-text">Vorlage</span>
              </a>
              <a href="/api/vendor/crm/export" className="crm-mob-hide" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                <Download size={13} /><span className="crm-btn-text">Export</span>
              </a>
              <button onClick={() => setShowNew(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Plus size={14} /> Neu
              </button>
            </div>
          </div>

          {/* Auto-import result */}
          {autoImportResult !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: autoImportResult > 0 ? 'rgba(30,126,52,0.08)' : 'rgba(107,114,128,0.08)', marginBottom: 12 }}>
              <Check size={14} style={{ color: autoImportResult > 0 ? '#1E7E34' : 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 13, color: autoImportResult > 0 ? '#1E7E34' : 'var(--text-secondary)' }}>
                {autoImportResult > 0 ? `${autoImportResult} neue Kontakt${autoImportResult > 1 ? 'e' : ''} importiert` : 'Keine neuen Kontakte gefunden — alles aktuell.'}
              </span>
              <button onClick={() => setAutoImportResult(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={13} /></button>
            </div>
          )}

          {/* Search + filter row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input placeholder="Name, E-Mail oder Telefon…" value={search} onChange={e => handleSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              {search && <button onClick={() => { setSearch(''); fetchContacts('', stageFilter, sourceFilter, priorityFilter) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={13} /></button>}
            </div>
            <button onClick={() => setShowFilters(f => !f)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 9, border: `1px solid ${showFilters || activeFilters > 0 ? 'var(--accent)' : 'var(--border2)'}`, background: showFilters ? 'var(--accent-light)' : 'var(--bg)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: showFilters ? 'var(--accent)' : 'var(--text-secondary)' }}>
              <Filter size={13} /> Filter {activeFilters > 0 && <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
            </button>
            <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 9, overflow: 'hidden' }}>
              {([['list', List], ['kanban', LayoutGrid]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '8px 10px', border: 'none', background: view === v ? 'var(--accent)' : 'var(--bg)', color: view === v ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>

          {/* Extended filters */}
          {showFilters && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Stage pills */}
              {STAGES.map(s => (
                <button key={s.key} onClick={() => { const nv = stageFilter === s.key ? '' : s.key; setStageFilter(nv as LifecycleStage | ''); applyFilters(nv as LifecycleStage | '') }}
                  style={{ padding: '4px 10px', borderRadius: 100, border: `1px solid ${stageFilter === s.key ? s.color : 'var(--border2)'}`, background: stageFilter === s.key ? s.bg : 'transparent', color: stageFilter === s.key ? s.color : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: stageFilter === s.key ? 700 : 450 }}>
                  {s.label}
                </button>
              ))}
              <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value as Source | ''); applyFilters(stageFilter, e.target.value as Source | '') }}
                style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 12, fontFamily: 'inherit' }}>
                <option value="">Alle Quellen</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value as Priority | ''); applyFilters(stageFilter, sourceFilter, e.target.value as Priority | '') }}
                style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 12, fontFamily: 'inherit' }}>
                <option value="">Alle Prioritäten</option>
                <option value="vip">VIP</option>
                <option value="standard">Standard</option>
                <option value="grosskunde">Großkunde</option>
              </select>
              <div style={{ position: 'relative' }}>
                <MapPin size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                <input placeholder="Wohnort" value={homeCityFilter} onChange={e => handleCityFilter('home', e.target.value)}
                  style={{ padding: '5px 8px 5px 22px', borderRadius: 8, border: `1px solid ${homeCityFilter ? 'var(--accent)' : 'var(--border2)'}`, background: 'var(--bg)', fontSize: 12, fontFamily: 'inherit', width: 130 }} />
              </div>
              <div style={{ position: 'relative' }}>
                <MapPin size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                <input placeholder="Veranstaltungsort" value={eventCityFilter} onChange={e => handleCityFilter('event', e.target.value)}
                  style={{ padding: '5px 8px 5px 22px', borderRadius: 8, border: `1px solid ${eventCityFilter ? 'var(--accent)' : 'var(--border2)'}`, background: 'var(--bg)', fontSize: 12, fontFamily: 'inherit', width: 160 }} />
              </div>
              {activeFilters > 0 && (
                <button onClick={() => { setStageFilter(''); setSourceFilter(''); setPriorityFilter(''); setHomeCityFilter(''); setEventCityFilter(''); fetchContacts(search) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                  <X size={11} /> Zurücksetzen
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 36, flexShrink: 0 }} />
              <div className="skeleton" style={{ height: 12, width: 120, borderRadius: 4 }} />
            </div>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="skeleton" style={{ height: 14, width: 160, marginBottom: 7, borderRadius: 5 }} />
                  <div className="skeleton" style={{ height: 12, width: 120, borderRadius: 4 }} />
                </div>
                <div className="skeleton" style={{ height: 20, width: 62, borderRadius: 100, flexShrink: 0 }} />
              </div>
            ))}
          </>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 24px' }}>
            <div style={{ opacity: 0.2, marginBottom: 14 }}><Users size={40} /></div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              {search || activeFilters > 0 ? 'Keine Kontakte gefunden' : 'Noch keine Kontakte'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20, maxWidth: 340, margin: '0 auto 20px' }}>
              {search || activeFilters > 0
                ? 'Versuche andere Suchbegriffe oder setze die Filter zurück.'
                : 'Klicke auf „Auto-Import" um alle Anfragen, Angebote und Events automatisch zu importieren, oder lege manuell einen Kontakt an.'}
            </p>
            {!search && !activeFilters && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={handleAutoImport} disabled={autoImporting} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={14} style={{ animation: autoImporting ? 'crm-spin 1s linear infinite' : 'none' }} /> Auto-Import
                </button>
                <button onClick={() => setShowNew(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Plus size={14} /> Manuell anlegen
                </button>
              </div>
            )}
          </div>
        ) : view === 'list' ? (
          <div>
            {/* List header */}
            {(() => {
              function SortHeader({ col, label, align }: { col: typeof sortCol; label: string; align?: string }) {
                const active = sortCol === col
                return (
                  <button onClick={() => { if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc') } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                    {active ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <ArrowUpDown size={9} style={{ opacity: 0.4 }} />}
                  </button>
                )
              }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 36, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}><SortHeader col="name" label="Kontakt" /></div>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
                </div>
              )
            })()}
            {sortedContacts.map(c => (
              <ContactRow key={c.id} contact={c} selected={selectedContact?.id === c.id} onClick={() => setSelectedContact(selectedContact?.id === c.id ? null : c)} onStageChange={async (stage) => {
                setContacts(prev => prev.map(x => x.id === c.id ? { ...x, lifecycle_stage: stage } : x))
                if (selectedContact?.id === c.id) setSelectedContact(prev => prev ? { ...prev, lifecycle_stage: stage } : prev)
                await fetch(`/api/vendor/crm/contacts/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lifecycle_stage: stage }) })
              }} />
            ))}
          </div>
        ) : (
          /* Kanban */
          <div style={{ padding: '20px 20px' }}>
            <div className="crm-kanban" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {STAGES.map(stage => {
                const cols = byStage[stage.key]
                const isDragOver = dragOverStage === stage.key
                return (
                  <div
                    key={stage.key}
                    onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key) }}
                    onDragLeave={() => setDragOverStage(null)}
                    onDrop={async e => {
                      e.preventDefault()
                      setDragOverStage(null)
                      const id = e.dataTransfer.getData('crm-contact-id')
                      if (!id) return
                      const contact = contacts.find(c => c.id === id)
                      if (!contact || contact.lifecycle_stage === stage.key) return
                      setContacts(prev => prev.map(c => c.id === id ? { ...c, lifecycle_stage: stage.key } : c))
                      await fetch(`/api/vendor/crm/contacts/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lifecycle_stage: stage.key }),
                      })
                    }}
                    style={{ borderRadius: 10, transition: 'background .15s', background: isDragOver ? stage.bg : 'transparent', minHeight: 80 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, padding: '6px 8px', borderRadius: 8, background: stage.bg }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.label}</span>
                      <span style={{ fontSize: 11, color: stage.color, opacity: 0.7, marginLeft: 'auto' }}>{cols.length}</span>
                    </div>
                    {cols.map(c => <KanbanCard key={c.id} contact={c} onClick={() => setSelectedContact(c)} />)}
                    {cols.length === 0 && <div style={{ padding: '16px 8px', textAlign: 'center' }}><p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Keine Kontakte</p></div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {selectedContact && (
        <ContactPanel contact={selectedContact} onClose={() => setSelectedContact(null)} onUpdated={handleUpdated} onDeleted={handleDeleted} onOpenById={openContactById} />
      )}
      {showNew && <NewContactModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleImport} />

      {importFile && (
        <CrmImportDialog
          file={importFile}
          onClose={() => setImportFile(null)}
          onImported={async (count) => {
            setImportFile(null)
            setAutoImportResult(count)
            if (count > 0) await fetchContacts(search, stageFilter, sourceFilter, priorityFilter)
          }}
        />
      )}

      {/* ── Global Tasks Panel ── */}
      {showGlobalTasks && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowGlobalTasks(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, height: '100dvh', overflowY: 'auto', background: 'var(--surface)', boxShadow: '-4px 0 32px rgba(35,82,200,0.14)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ListChecks size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, flex: 1 }}>Offene Aufgaben</h2>
              <button onClick={() => setShowGlobalTasks(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 30px' }}>
              {loadingGlobalTasks ? (
                [1,2,3,4].map(i => <div key={i} style={{ height: 54, borderRadius: 9, background: 'var(--bg)', marginBottom: 8, animation: 'crm-pulse 1.4s ease-in-out infinite' }} />)
              ) : globalTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Check size={32} style={{ color: '#1E7E34', opacity: 0.5, marginBottom: 12 }} />
                  <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Keine offenen Aufgaben</p>
                </div>
              ) : (() => {
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                const inWeek = new Date(today.getTime() + 7 * 86400000)
                const groups: [string, typeof globalTasks][] = [
                  ['Überfällig', globalTasks.filter(t => t.due_at && new Date(t.due_at) < today)],
                  ['Heute', globalTasks.filter(t => t.due_at && new Date(t.due_at) >= today && new Date(t.due_at) < new Date(today.getTime() + 86400000))],
                  ['Diese Woche', globalTasks.filter(t => t.due_at && new Date(t.due_at) >= new Date(today.getTime() + 86400000) && new Date(t.due_at) < inWeek)],
                  ['Später', globalTasks.filter(t => !t.due_at || new Date(t.due_at) >= inWeek)],
                ]
                return groups.filter(([, ts]) => ts.length > 0).map(([label, ts]) => (
                  <div key={label} style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: label === 'Überfällig' ? '#C5221F' : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</p>
                    {ts.map(task => (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 9, background: 'var(--bg)', border: `1px solid ${label === 'Überfällig' ? 'rgba(197,34,31,0.2)' : 'var(--border)'}`, marginBottom: 6 }}>
                        <button onClick={() => toggleGlobalTask(task)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }}>
                          <Square size={15} />
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{task.title}</p>
                          {task.crm_contacts?.name && (
                            <button onClick={() => { openContactById(task.crm_contacts!.id); setShowGlobalTasks(false) }}
                              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 11, color: 'var(--accent)', fontFamily: 'inherit', marginTop: 2 }}>
                              {task.crm_contacts.name}
                            </button>
                          )}
                        </div>
                        {task.due_at && (
                          <span style={{ fontSize: 11, color: label === 'Überfällig' ? '#C5221F' : 'var(--text-tertiary)', flexShrink: 0 }}>
                            {formatDateShort(task.due_at)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes crm-spin { to { transform: rotate(360deg); } }
        @keyframes crm-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media(max-width:900px) { .crm-kanban { grid-template-columns: repeat(2,1fr) !important; } }
        @media(max-width:540px) { .crm-kanban { grid-template-columns: 1fr !important; } .crm-btn-text { display: none !important; } }
      `}</style>
    </div>
  )
}
