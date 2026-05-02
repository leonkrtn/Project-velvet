'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronDown, ChevronUp, Trash2, Copy, Check, MessageSquare, Phone, Mail, Euro, Tag, FileText, Edit2, Shield, X, Info, Eye, Pencil, Loader2, BookUser } from 'lucide-react'
import { ALL_MODULES, ROLE_MODULE_DEFAULTS } from '@/lib/vendor-modules'

type MemberRole = 'veranstalter' | 'brautpaar' | 'trauzeuge' | 'dienstleister'

interface Profile {
  id: string
  name: string
  email: string
  phone?: string | null
}

interface Member {
  id: string
  user_id: string | null
  role: MemberRole
  joined_at: string | null
  display_name: string | null
  invite_status: string | null
  profiles: Profile | null
  invitation_id: string | null
  invitation_category: string | null
  current_permissions: string[]
  show_in_contacts: boolean
}

interface Vendor {
  id: string
  name: string | null
  category: string | null
  price: number | null
  cost_label: string | null
  email: string | null
  phone: string | null
  status: string
  notes: string | null
}

interface Props {
  eventId: string
  members: Member[]
  vendors: Vendor[]
}

const ROLE_LABELS: Record<MemberRole, string> = {
  veranstalter: 'Veranstalter',
  brautpaar:    'Brautpaar',
  trauzeuge:    'Trauzeuge',
  dienstleister:'Dienstleister',
}

const INVITE_STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  confirmed: { bg: '#EAF5EE', color: '#3D7A56', label: 'Bestätigt' },
  invited:   { bg: '#FFF8E6', color: '#B8860B', label: 'Eingeladen' },
  pending:   { bg: '#F0F0F0', color: '#666',    label: 'Ausstehend' },
  declined:  { bg: '#FDEAEA', color: '#A04040', label: 'Abgesagt' },
}

const VENDOR_STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  bestaetigt:     { bg: '#EAF5EE', color: '#3D7A56', label: 'Bestätigt' },
  angefragt:      { bg: '#FFF8E6', color: '#B8860B', label: 'Angefragt' },
  in_verhandlung: { bg: '#EEF2FF', color: '#4F46E5', label: 'In Verhandlung' },
  abgesagt:       { bg: '#FDEAEA', color: '#A04040', label: 'Abgesagt' },
}

const DL_CATEGORIES = [
  'Fotograf', 'Videograf', 'Caterer', 'Floristin', 'Band / DJ',
  'Konditorei', 'Hairstylist / Make-up', 'Trauungsredner', 'Location', 'Andere',
]

type InviteRole = 'brautpaar' | 'trauzeuge' | 'dienstleister'
type ModalStep  = 'basis' | 'module' | 'bestaetigung' | 'code'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function StatusBadge({ cfg }: { cfg: { bg: string; color: string; label: string } }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function DetailField({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string | null | undefined; href?: string }) {
  if (!value) return null
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
        {icon} {label}
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
  if (href) {
    return <a href={href} style={{ textDecoration: 'none' }}>{content}</a>
  }
  return content
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
      {children}
    </label>
  )
}

function FieldInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      style={{ width: '100%', padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }}
    />
  )
}

export default function MitgliederClient({ eventId, members: initialMembers, vendors }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [members, setMembers] = useState(initialMembers)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Invite modal
  const [showInviteModal, setShowInviteModal]   = useState(false)
  const [modalStep, setModalStep]               = useState<ModalStep>('basis')
  const [inviteRole, setInviteRole]             = useState<InviteRole>('trauzeuge')
  const [inviteDLCategory, setInviteDLCategory] = useState(DL_CATEGORIES[0])
  const [selectedModules, setSelectedModules]   = useState<Set<string>>(new Set(['mod_chat']))
  const [inviting, setInviting]                 = useState(false)
  const [inviteCode, setInviteCode]             = useState<string | null>(null)
  const [copied, setCopied]                     = useState(false)
  const [removeConfirm, setRemoveConfirm]       = useState<string | null>(null)
  const [removing, setRemoving]                 = useState(false)

  // Signup-Code
  const [signupCode, setSignupCode]               = useState<string | null>(null)
  const [signupCodeCopied, setSignupCodeCopied]   = useState(false)
  const [creatingSignupCode, setCreatingSignupCode] = useState(false)
  const [signupCodeError, setSignupCodeError]     = useState<string | null>(null)

  // Category inline edit
  const [editCategoryId, setEditCategoryId]   = useState<string | null>(null)
  const [editCategoryVal, setEditCategoryVal] = useState('')
  const [savingCategory, setSavingCategory]   = useState(false)

  // Info lightbox
  const [infoMemberId, setInfoMemberId] = useState<string | null>(null)

  // Module edit modal
  const [moduleEditMemberId, setModuleEditMemberId]   = useState<string | null>(null)
  const [moduleEditPerms, setModuleEditPerms]         = useState<Set<string>>(new Set())
  const [savingModules, setSavingModules]             = useState(false)

  // Vendor view lightbox (what data the vendor can see)
  const [vendorViewMemberId, setVendorViewMemberId]   = useState<string | null>(null)
  const [vendorViewTab, setVendorViewTab]             = useState<string>('')
  const [vendorViewData, setVendorViewData]           = useState<Record<string, unknown>>({})
  const [vendorViewLoading, setVendorViewLoading]     = useState(false)

  // Item-level permissions lightbox
  const [itemPermMemberId, setItemPermMemberId]       = useState<string | null>(null)
  const [itemPermModule, setItemPermModule]           = useState<string>('')
  const [itemPermItems, setItemPermItems]             = useState<Array<{ id: string; label: string; sub?: string }>>([])
  const [itemPermMap, setItemPermMap]                 = useState<Record<string, { can_view: boolean; can_edit: boolean }>>({})
  const [itemPermLoading, setItemPermLoading]         = useState(false)
  const [itemPermSaving, setItemPermSaving]           = useState(false)

  const bpTz     = members.filter(m => m.role === 'brautpaar' || m.role === 'trauzeuge')
  const dlMembers = members.filter(m => m.role === 'dienstleister')

  function vendorForMember(m: Member): Vendor | undefined {
    return vendors.find(v => v.email && m.profiles?.email && v.email.toLowerCase() === m.profiles.email.toLowerCase())
  }

  function categoryForMember(m: Member): string {
    const vendor = vendorForMember(m)
    return vendor?.category ?? m.invitation_category ?? 'Dienstleister'
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Category edit ──────────────────────────────────────────────────────────

  function startEditCategory(m: Member) {
    setEditCategoryId(m.id)
    setEditCategoryVal(categoryForMember(m) === 'Dienstleister' ? '' : categoryForMember(m))
  }

  async function saveCategoryEdit(m: Member) {
    const newCategory = editCategoryVal.trim() || 'Dienstleister'
    setSavingCategory(true)
    const vendor = vendorForMember(m)
    if (vendor) {
      await supabase.from('vendors').update({ category: newCategory }).eq('id', vendor.id)
    } else if (m.invitation_id) {
      await supabase
        .from('event_invitations')
        .update({ metadata: { category: newCategory } })
        .eq('id', m.invitation_id)
    }
    setMembers(prev => prev.map(x =>
      x.id === m.id ? { ...x, invitation_category: newCategory } : x
    ))
    setSavingCategory(false)
    setEditCategoryId(null)
  }

  // ── Module edit ────────────────────────────────────────────────────────────

  function openModuleEdit(m: Member) {
    setModuleEditMemberId(m.id)
    setModuleEditPerms(new Set(m.current_permissions.length > 0 ? m.current_permissions : ['mod_chat']))
  }

  function toggleModuleEdit(mod: import('@/lib/vendor-modules').ModuleDef) {
    if (mod.required) return
    setModuleEditPerms(prev => {
      const next = new Set(prev)
      const isActive = next.has(mod.key) || (mod.readonlyKey != null && next.has(mod.readonlyKey))
      if (isActive) {
        next.delete(mod.key)
        if (mod.readonlyKey) next.delete(mod.readonlyKey)
      } else {
        next.add(mod.key)
      }
      return next
    })
  }

  function setModuleMode(mod: import('@/lib/vendor-modules').ModuleDef, mode: 'full' | 'readonly') {
    if (!mod.readonlyKey) return
    setModuleEditPerms(prev => {
      const next = new Set(prev)
      next.delete(mod.key)
      next.delete(mod.readonlyKey!)
      next.add(mode === 'full' ? mod.key : mod.readonlyKey!)
      return next
    })
  }

  async function saveModules(m: Member) {
    if (!m.user_id) return
    setSavingModules(true)
    const finalPerms = Array.from(moduleEditPerms).includes('mod_chat')
      ? Array.from(moduleEditPerms)
      : ['mod_chat', ...Array.from(moduleEditPerms)]

    // Delete all existing permissions for this user/event, then re-insert
    await supabase.from('permissions').delete()
      .eq('user_id', m.user_id)
      .eq('event_id', eventId)

    if (finalPerms.length > 0) {
      await supabase.from('permissions').insert(
        finalPerms.map(perm => ({ user_id: m.user_id!, event_id: eventId, permission: perm }))
      )
    }

    setMembers(prev => prev.map(x =>
      x.id === m.id ? { ...x, current_permissions: finalPerms } : x
    ))
    setSavingModules(false)
    setModuleEditMemberId(null)
  }

  // ── Show in contacts toggle ────────────────────────────────────────────────

  async function toggleShowInContacts(m: Member) {
    const next = !m.show_in_contacts
    setMembers(prev => prev.map(x => x.id === m.id ? { ...x, show_in_contacts: next } : x))
    await supabase.from('event_members').update({ show_in_contacts: next }).eq('id', m.id)
  }

  // ── Vendor view ───────────────────────────────────────────────────────────

  async function openVendorView(m: Member) {
    const perms = m.current_permissions.filter(p => p !== 'mod_chat')
    const firstTab = perms[0] ?? 'mod_chat'
    setVendorViewMemberId(m.id)
    setVendorViewTab(firstTab)
    setVendorViewData({})
    setVendorViewLoading(true)

    async function fetch(key: string, query: PromiseLike<unknown>) {
      const v = await Promise.resolve(query)
      setVendorViewData(d => ({ ...d, [key]: v }))
    }

    const jobs: Promise<void>[] = []
    const has = (p: string) => m.current_permissions.includes(p)

    if (has('mod_timeline')) jobs.push(fetch('mod_timeline',
      supabase.from('timeline_entries').select('id, start_minutes, duration_minutes, title, location, sort_order').eq('event_id', eventId).order('sort_order').then(r => r.data ?? [])))
    if (has('mod_location')) jobs.push(fetch('mod_location',
      supabase.from('location_details').select('*').eq('event_id', eventId).maybeSingle().then(r => r.data)))
    if (has('mod_guests')) jobs.push(fetch('mod_guests',
      supabase.from('guests').select('id, name, status, meal_choice, allergy_tags, allergy_custom, side').eq('event_id', eventId).order('name').then(r => r.data ?? [])))
    if (has('mod_seating')) jobs.push(fetch('mod_seating',
      supabase.from('seating_tables').select('id, name, capacity, shape').eq('event_id', eventId).order('name').then(r => r.data ?? [])))
    if (has('mod_catering')) jobs.push(fetch('mod_catering',
      supabase.from('catering_plans').select('*').eq('event_id', eventId).maybeSingle().then(r => r.data)))
    if (has('mod_patisserie')) jobs.push(fetch('mod_patisserie',
      supabase.from('patisserie_config').select('*').eq('event_id', eventId).maybeSingle().then(r => r.data)))
    if (has('mod_media')) jobs.push(fetch('mod_media',
      Promise.all([
        supabase.from('media_briefing').select('*').eq('event_id', eventId).maybeSingle(),
        supabase.from('media_shot_items').select('id, title, description, type, category, sort_order').eq('event_id', eventId).order('sort_order'),
      ]).then(([brief, shots]) => ({ briefing: brief.data, shots: shots.data ?? [] }))))
    if (has('mod_music')) jobs.push(fetch('mod_music',
      Promise.all([
        supabase.from('music_songs').select('id, title, artist, type, moment').eq('event_id', eventId).order('sort_order'),
        supabase.from('music_requirements').select('*').eq('event_id', eventId).maybeSingle(),
      ]).then(([songs, req]) => ({ songs: songs.data ?? [], requirements: req.data }))))
    if (has('mod_decor')) jobs.push(fetch('mod_decor',
      supabase.from('decor_setup_items').select('id, title, description, location_in_venue, setup_by, teardown_at').eq('event_id', eventId).order('sort_order').then(r => r.data ?? [])))
    if (has('mod_files')) jobs.push(fetch('mod_files',
      supabase.from('event_files').select('id, name, file_url, category, uploaded_at').eq('event_id', eventId).order('uploaded_at', { ascending: false }).then(r => r.data ?? [])))

    await Promise.all(jobs)
    setVendorViewLoading(false)
  }

  // ── Item permissions ───────────────────────────────────────────────────────

  const ITEM_PERM_MODULES: Array<{ key: string; modKey: string; label: string }> = [
    { key: 'musik',      modKey: 'mod_music',      label: 'Musik' },
    { key: 'dekoration', modKey: 'mod_decor',      label: 'Dekoration' },
    { key: 'medien',     modKey: 'mod_media',      label: 'Medien & Aufnahmen' },
  ]

  async function openItemPerms(m: Member, moduleKey: string) {
    setItemPermMemberId(m.id)
    setItemPermModule(moduleKey)
    setItemPermItems([])
    setItemPermMap({})
    setItemPermLoading(true)

    const [existingPerms, items] = await Promise.all([
      supabase.from('dienstleister_item_permissions')
        .select('item_id, can_view, can_edit')
        .eq('event_id', eventId)
        .eq('dienstleister_user_id', m.user_id ?? '')
        .eq('module', moduleKey)
        .then(r => r.data ?? []),
      (async () => {
        if (moduleKey === 'musik') {
          const { data } = await supabase.from('music_songs').select('id, title, artist').eq('event_id', eventId).order('sort_order')
          return (data ?? []).map((s: { id: string; title: string; artist: string }) => ({ id: s.id, label: s.title || '(kein Titel)', sub: s.artist }))
        }
        if (moduleKey === 'dekoration') {
          const [{ data: setup }, { data: wishes }] = await Promise.all([
            supabase.from('decor_setup_items').select('id, title').eq('event_id', eventId).order('sort_order'),
            supabase.from('deko_wishes').select('id, title').eq('event_id', eventId).order('created_at'),
          ])
          return [
            ...(setup ?? []).map((x: { id: string; title: string }) => ({ id: x.id, label: x.title, sub: 'Aufbau-Aufgabe' })),
            ...(wishes ?? []).map((x: { id: string; title: string }) => ({ id: x.id, label: x.title, sub: 'Dekor-Wunsch' })),
          ]
        }
        if (moduleKey === 'medien') {
          const { data } = await supabase.from('media_shot_items').select('id, title, category').eq('event_id', eventId).order('sort_order')
          return (data ?? []).map((s: { id: string; title: string; category: string }) => ({ id: s.id, label: s.title, sub: s.category }))
        }
        return []
      })(),
    ])

    const map: Record<string, { can_view: boolean; can_edit: boolean }> = {}
    for (const p of existingPerms) {
      map[p.item_id] = { can_view: p.can_view, can_edit: p.can_edit }
    }
    setItemPermMap(map)
    setItemPermItems(items)
    setItemPermLoading(false)
  }

  function toggleItemPerm(itemId: string, field: 'can_view' | 'can_edit', value: boolean) {
    setItemPermMap(prev => {
      const cur = prev[itemId] ?? { can_view: true, can_edit: false }
      const next = { ...cur, [field]: value }
      if (field === 'can_view' && !value) next.can_edit = false
      if (field === 'can_edit' && value) next.can_view = true
      return { ...prev, [itemId]: next }
    })
  }

  async function saveItemPerms(m: Member) {
    if (!m.user_id) return
    setItemPermSaving(true)
    const rows = Object.entries(itemPermMap).map(([item_id, perms]) => ({
      event_id: eventId,
      dienstleister_user_id: m.user_id!,
      module: itemPermModule,
      item_id,
      can_view: perms.can_view,
      can_edit: perms.can_edit,
    }))
    await supabase.from('dienstleister_item_permissions')
      .delete()
      .eq('event_id', eventId)
      .eq('dienstleister_user_id', m.user_id)
      .eq('module', itemPermModule)
    if (rows.length > 0) {
      await supabase.from('dienstleister_item_permissions').insert(rows)
    }
    setItemPermSaving(false)
    setItemPermMemberId(null)
  }

  // ── Invite modal ───────────────────────────────────────────────────────────

  function openModal() {
    setShowInviteModal(true)
    setModalStep('basis')
    setInviteRole('trauzeuge')
    setInviteDLCategory(DL_CATEGORIES[0])
    setSelectedModules(new Set(ROLE_MODULE_DEFAULTS[DL_CATEGORIES[0]] ?? ['mod_chat']))
    setInviteCode(null)
    setCopied(false)
  }

  function closeModal() { setShowInviteModal(false) }

  function handleCategoryChange(cat: string) {
    setInviteDLCategory(cat)
    setSelectedModules(new Set(ROLE_MODULE_DEFAULTS[cat] ?? ['mod_chat']))
  }

  function toggleModule(key: string) {
    if (key === 'mod_chat') return
    setSelectedModules(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleInviteSimple() {
    setInviting(true)
    const res = await fetch('/api/invite/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, targetRole: inviteRole }),
    })
    const data = await res.json()
    setInviting(false)
    if (data.code) { setInviteCode(data.code); setModalStep('code') }
  }

  async function handleInviteVendor() {
    setInviting(true)
    const res = await fetch('/api/vendor/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, category: inviteDLCategory, permissions: Array.from(selectedModules) }),
    })
    const data = await res.json()
    setInviting(false)
    if (data.code) { setInviteCode(data.code); setModalStep('code') }
  }

  function handleBasisWeiter() {
    if (inviteRole !== 'dienstleister') { handleInviteSimple(); return }
    setModalStep('module')
  }

  async function copyCode() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(`${window.location.origin}/vendor/join?code=${inviteCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRemove(memberId: string) {
    setRemoving(true)
    await supabase.from('event_members').delete().eq('id', memberId)
    setMembers(m => m.filter(x => x.id !== memberId))
    setRemoveConfirm(null)
    setRemoving(false)
    router.refresh()
  }

  async function createSignupCode() {
    setCreatingSignupCode(true)
    setSignupCodeError(null)
    const res = await fetch('/api/vendor/signup-code', { method: 'POST' })
    const data = await res.json()
    setCreatingSignupCode(false)
    if (!res.ok || data.error) { setSignupCodeError(data.error ?? 'Fehler beim Erstellen'); return }
    setSignupCode(data.code)
    setSignupCodeCopied(false)
  }

  async function copySignupCode() {
    if (!signupCode) return
    await navigator.clipboard.writeText(signupCode)
    setSignupCodeCopied(true)
    setTimeout(() => setSignupCodeCopied(false), 2000)
  }

  // ── Modal steps ────────────────────────────────────────────────────────────

  const stepBasis = (
    <>
      <div style={{ marginBottom: 16 }}>
        <Label>Rolle</Label>
        <select
          value={inviteRole}
          onChange={e => setInviteRole(e.target.value as InviteRole)}
          style={{ width: '100%', padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}
        >
          <option value="brautpaar">Brautpaar</option>
          <option value="trauzeuge">Trauzeuge</option>
          <option value="dienstleister">Dienstleister</option>
        </select>
      </div>
      {inviteRole === 'dienstleister' && (
        <div style={{ marginBottom: 16 }}>
          <Label>Kategorie</Label>
          <select value={inviteDLCategory} onChange={e => handleCategoryChange(e.target.value)} style={{ width: '100%', padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
            {DL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
      {inviteRole !== 'dienstleister' && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Ein Einladungslink wird erstellt und ist 7 Tage gültig.
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={closeModal} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
        <button onClick={handleBasisWeiter} disabled={inviting} style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: inviting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}>
          {inviting ? 'Erstellen…' : inviteRole === 'dienstleister' ? 'Weiter' : 'Link erstellen'}
        </button>
      </div>
    </>
  )

  const stepModule = (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Wähle die Bereiche, auf die <strong>{inviteDLCategory}</strong> Zugriff erhält.
        <strong style={{ color: 'var(--text-primary)' }}> Kommunikation</strong> ist immer aktiv.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {ALL_MODULES.map(mod => {
          const active = selectedModules.has(mod.key)
          const locked = mod.required
          const Icon = mod.icon
          return (
            <button key={mod.key} onClick={() => toggleModule(mod.key)} disabled={locked} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-light)' : 'var(--surface)', cursor: locked ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <Icon size={15} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1 }}>{mod.label}</span>
              {locked
                ? <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>Pflicht</span>
                : <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border2)'}`, background: active ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{active && <Check size={11} color="#fff" />}</div>
              }
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => setModalStep('basis')} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Zurück</button>
        <button onClick={() => setModalStep('bestaetigung')} style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Weiter</button>
      </div>
    </>
  )

  const stepBestaetigung = (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Bitte prüfe die Einladung vor dem Erstellen.</p>
      <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 12px', fontSize: 13 }}>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Kategorie</span>
          <span>{inviteDLCategory}</span>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Zugriff</span>
          <span style={{ lineHeight: 1.6 }}>{ALL_MODULES.filter(m => selectedModules.has(m.key)).map(m => m.label).join(', ')}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => setModalStep('module')} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Zurück</button>
        <button onClick={handleInviteVendor} disabled={inviting} style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: inviting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}>
          {inviting ? 'Erstellen…' : 'Einladung erstellen'}
        </button>
      </div>
    </>
  )

  const stepCode = (
    <>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14 }}>
        Einladungslink für <strong>{inviteRole === 'brautpaar' ? 'Brautpaar' : inviteRole === 'trauzeuge' ? 'Trauzeuge' : inviteDLCategory}</strong>:
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/vendor/join?code=${inviteCode}`} style={{ flex: 1, padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#F5F5F7', outline: 'none' }} />
        <button onClick={copyCode} style={{ padding: '10px 14px', background: copied ? '#34C759' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, whiteSpace: 'nowrap' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
      <button onClick={closeModal} style={{ width: '100%', padding: '10px', background: '#F5F5F7', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Schließen</button>
    </>
  )

  const STEP_TITLES: Record<ModalStep, string> = { basis: 'Mitglied einladen', module: 'Zugriffsmodule wählen', bestaetigung: 'Einladung bestätigen', code: 'Einladungslink' }
  const showStepIndicator = inviteRole === 'dienstleister' && modalStep !== 'code'
  const DL_STEPS: ModalStep[] = ['basis', 'module', 'bestaetigung']
  const currentStepIdx = DL_STEPS.indexOf(modalStep)

  // ── Row renderers ──────────────────────────────────────────────────────────

  function renderBpTzRow(m: Member) {
    const isOpen = expanded.has(m.id)
    const displayName = m.display_name || m.profiles?.name || 'Unbekannt'
    const statusCfg = INVITE_STATUS_CFG[m.invite_status ?? 'invited'] ?? INVITE_STATUS_CFG.invited
    return (
      <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', gap: 0, padding: '14px 20px', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle(m.id)}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {initials(displayName)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ROLE_LABELS[m.role]}</div>
          </div>
          <div style={{ display: 'flex', color: 'var(--text-tertiary)' }}>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {isOpen && (
          <div style={{ padding: '0 20px 18px 60px', background: '#F5F5F7', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 14, paddingTop: 14 }}>
              <DetailField icon={<Mail size={11} />} label="E-Mail" value={m.profiles?.email} href={m.profiles?.email ? `mailto:${m.profiles.email}` : undefined} />
              <DetailField icon={<Phone size={11} />} label="Telefon" value={m.profiles?.phone} href={m.profiles?.phone ? `tel:${m.profiles.phone}` : undefined} />
              <DetailField icon={<Tag size={11} />} label="Dabei seit" value={m.joined_at ? new Date(m.joined_at).toLocaleDateString('de-DE') : undefined} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`/veranstalter/${eventId}/chats`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', background: 'var(--surface)' }}>
                <MessageSquare size={13} /> Nachricht
              </a>
              <button onClick={() => setRemoveConfirm(m.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,59,48,0.2)', fontSize: 13, color: '#FF3B30', background: 'rgba(255,59,48,0.08)', cursor: 'pointer' }}>
                <Trash2 size={13} /> Entfernen
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderDlRow(m: Member) {
    const vendor = vendorForMember(m)
    const isOpen = expanded.has(m.id)
    const displayName = m.display_name || vendor?.name || m.profiles?.name || 'Unbekannt'
    const category = categoryForMember(m)
    const vStatusCfg = VENDOR_STATUS_CFG[vendor?.status ?? 'angefragt'] ?? VENDOR_STATUS_CFG.angefragt
    const isEditingCategory = editCategoryId === m.id

    return (
      <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Row header */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', gap: 0, padding: '14px 20px', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle(m.id)}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0F0F5', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {initials(displayName)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{category}</div>
          </div>
          <div style={{ display: 'flex', color: 'var(--text-tertiary)' }}>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* Expanded details */}
        {isOpen && (
          <div style={{ padding: '14px 20px 18px 60px', background: '#F5F5F7', borderTop: '1px solid rgba(0,0,0,0.05)' }}>

            {/* Editable category */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                Bezeichnung
              </div>
              {isEditingCategory ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    value={editCategoryVal}
                    onChange={e => setEditCategoryVal(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none' }}
                    autoFocus
                  >
                    <option value="">Wählen…</option>
                    {DL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={() => saveCategoryEdit(m)}
                    disabled={savingCategory}
                    style={{ padding: '7px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Check size={13} /> {savingCategory ? '…' : 'OK'}
                  </button>
                  <button
                    onClick={() => setEditCategoryId(null)}
                    style={{ padding: '7px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{category}</span>
                  <button
                    onClick={e => { e.stopPropagation(); startEditCategory(m) }}
                    style={{ padding: '3px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Edit2 size={11} /> Bearbeiten
                  </button>
                </div>
              )}
            </div>

            {/* Contact fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 14 }}>
              <DetailField icon={<Mail size={11} />} label="E-Mail" value={vendor?.email ?? m.profiles?.email} href={(vendor?.email ?? m.profiles?.email) ? `mailto:${vendor?.email ?? m.profiles?.email}` : undefined} />
              <DetailField icon={<Phone size={11} />} label="Telefon" value={vendor?.phone} href={vendor?.phone ? `tel:${vendor.phone}` : undefined} />
              {vendor?.price != null && (
                <DetailField icon={<Euro size={11} />} label={vendor.cost_label ?? 'Preis'} value={vendor.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} />
              )}
              <DetailField icon={<Tag size={11} />} label="Dabei seit" value={m.joined_at ? new Date(m.joined_at).toLocaleDateString('de-DE') : undefined} />
            </div>
            {vendor?.notes && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 12 }}>
                <FileText size={12} style={{ color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{vendor.notes}</span>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={`/veranstalter/${eventId}/chats`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', background: 'var(--surface)' }}>
                <MessageSquare size={13} /> Nachricht
              </a>
              {vendor && (
                <button
                  onClick={e => { e.stopPropagation(); setInfoMemberId(m.id) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface)', cursor: 'pointer' }}
                >
                  <Info size={13} /> Alle Infos
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); openModuleEdit(m) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface)', cursor: 'pointer' }}
              >
                <Shield size={13} /> Zugriffsmodule
              </button>
              {(() => {
                const supportedMods = ITEM_PERM_MODULES.filter(x => m.current_permissions.some(p => p === x.modKey || p === `${x.modKey}_read`))
                if (supportedMods.length === 0) return null
                return (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <details style={{ display: 'inline-block' }}>
                      <summary style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface)', cursor: 'pointer', listStyle: 'none' }}>
                        <Pencil size={13} /> Item-Berechtigungen
                      </summary>
                      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', padding: '6px', minWidth: 180, marginTop: 4 }}>
                        {supportedMods.map(mod => (
                          <button
                            key={mod.key}
                            onClick={e => { e.stopPropagation(); openItemPerms(m, mod.key) }}
                            style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', color: 'var(--text-primary)' }}
                          >
                            {mod.label}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                )
              })()}
              {m.current_permissions.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); openVendorView(m) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', background: 'var(--surface)', cursor: 'pointer' }}
                >
                  <Eye size={13} /> Vendor-Ansicht
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); toggleShowInContacts(m) }}
                title={m.show_in_contacts ? 'Aus Wichtige Kontakte entfernen' : 'In Wichtige Kontakte anzeigen'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: m.show_in_contacts ? '1px solid var(--accent)' : '1px solid var(--border)', fontSize: 13, color: m.show_in_contacts ? 'var(--accent)' : 'var(--text-primary)', background: m.show_in_contacts ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface)', cursor: 'pointer' }}
              >
                <BookUser size={13} /> Kontakte
              </button>
              <button onClick={() => setRemoveConfirm(m.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,59,48,0.2)', fontSize: 13, color: '#FF3B30', background: 'rgba(255,59,48,0.08)', cursor: 'pointer' }}>
                <Trash2 size={13} /> Entfernen
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Info lightbox ──────────────────────────────────────────────────────────

  const infoMember = infoMemberId ? members.find(m => m.id === infoMemberId) : null
  const infoVendor = infoMember ? vendorForMember(infoMember) : null

  // ── Module edit modal ──────────────────────────────────────────────────────

  const moduleEditMember = moduleEditMemberId ? members.find(m => m.id === moduleEditMemberId) : null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Mitglieder</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {bpTz.length} Brautpaar/Trauzeugen · {dlMembers.length} Dienstleister
          </p>
        </div>
        <button onClick={openModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          <Plus size={15} /> Einladen
        </button>
      </div>

      {/* Brautpaar & Trauzeugen */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 12, color: 'var(--text-primary)' }}>Brautpaar & Trauzeugen</h2>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', gap: 0, padding: '10px 20px', background: '#F5F5F7', borderBottom: '1px solid var(--border)' }}>
            {['', 'Name', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{h}</span>
            ))}
          </div>
          {bpTz.length === 0
            ? <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>Noch keine Mitglieder in dieser Gruppe</div>
            : bpTz.map(renderBpTzRow)
          }
        </div>
      </div>

      {/* Dienstleister */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 12, color: 'var(--text-primary)' }}>Dienstleister</h2>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', gap: 0, padding: '10px 20px', background: '#F5F5F7', borderBottom: '1px solid var(--border)' }}>
            {['', 'Name & Kategorie', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{h}</span>
            ))}
          </div>
          {dlMembers.length === 0
            ? <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>Noch keine Dienstleister eingeladen</div>
            : dlMembers.map(renderDlRow)
          }
        </div>
      </div>

      {/* Dienstleister-Account */}
      <div style={{ marginTop: 8, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4 }}>Dienstleister-Account erstellen</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Generiere einen Registrierungslink, mit dem ein Dienstleister einen eigenen Account anlegen kann – unabhängig von einem Event.
          </p>
        </div>
        {signupCodeError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', borderRadius: 'var(--radius-sm)', marginBottom: 14, fontSize: 13, color: '#FF3B30' }}>
            {signupCodeError}
          </div>
        )}
        {signupCode ? (
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Teile diesen Code mit dem Dienstleister. Er kann ihn auf <strong>project-velvet.vercel.app/signup</strong> einlösen.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input readOnly value={signupCode} style={{ flex: 1, padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 15, fontFamily: 'monospace', fontWeight: 600, background: '#F5F5F7', outline: 'none', letterSpacing: '0.05em' }} />
              <button onClick={copySignupCode} style={{ padding: '10px 14px', background: signupCodeCopied ? '#34C759' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, whiteSpace: 'nowrap' }}>
                {signupCodeCopied ? <Check size={14} /> : <Copy size={14} />}
                {signupCodeCopied ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>7 Tage gültig · Einmalig verwendbar</p>
              <button onClick={() => { setSignupCode(null); setSignupCodeError(null) }} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'underline' }}>Neuen Code erstellen</button>
            </div>
          </div>
        ) : (
          <button onClick={createSignupCode} disabled={creatingSignupCode} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: creatingSignupCode ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, opacity: creatingSignupCode ? 0.7 : 1 }}>
            <Plus size={15} />
            {creatingSignupCode ? 'Erstellen…' : 'Registrierungslink erstellen'}
          </button>
        )}
      </div>

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => modalStep === 'code' ? closeModal() : undefined}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 460, maxWidth: '100%', boxShadow: 'var(--shadow-md)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 0 }}>{STEP_TITLES[modalStep]}</h3>
              {showStepIndicator && (
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  {DL_STEPS.map((s, i) => (
                    <div key={s} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= currentStepIdx ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s' }} />
                  ))}
                </div>
              )}
            </div>
            {modalStep === 'basis'        && stepBasis}
            {modalStep === 'module'       && stepModule}
            {modalStep === 'bestaetigung' && stepBestaetigung}
            {modalStep === 'code'         && stepCode}
          </div>
        </div>
      )}

      {/* ── Info Lightbox ── */}
      {infoMember && infoVendor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setInfoMemberId(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', width: 500, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F0F0F5', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                  {initials(infoVendor.name ?? infoMember.profiles?.name ?? '?')}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
                    {infoVendor.name ?? infoMember.profiles?.name ?? 'Unbekannt'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {categoryForMember(infoMember)}
                  </div>
                </div>
              </div>
              <button onClick={() => setInfoMemberId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', marginLeft: 12 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Status */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Status</div>
                <StatusBadge cfg={VENDOR_STATUS_CFG[infoVendor.status ?? 'angefragt'] ?? VENDOR_STATUS_CFG.angefragt} />
              </div>

              {/* Contact */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Kontakt</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(infoVendor.email ?? infoMember.profiles?.email) && (
                    <a href={`mailto:${infoVendor.email ?? infoMember.profiles?.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--accent)', textDecoration: 'none' }}>
                      <Mail size={14} style={{ color: 'var(--text-tertiary)' }} />
                      {infoVendor.email ?? infoMember.profiles?.email}
                    </a>
                  )}
                  {infoVendor.phone && (
                    <a href={`tel:${infoVendor.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--accent)', textDecoration: 'none' }}>
                      <Phone size={14} style={{ color: 'var(--text-tertiary)' }} />
                      {infoVendor.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Price */}
              {infoVendor.price != null && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    {infoVendor.cost_label ?? 'Preis'}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {infoVendor.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </div>
                </div>
              )}

              {/* Notes */}
              {infoVendor.notes && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Notizen</div>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{infoVendor.notes}</p>
                </div>
              )}

              {/* Zugriffsmodule */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Zugriffsmodule</div>
                {infoMember.current_permissions.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Keine Module zugewiesen</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ALL_MODULES.filter(mod => infoMember.current_permissions.includes(mod.key) || (mod.readonlyKey != null && infoMember.current_permissions.includes(mod.readonlyKey))).map(mod => {
                      const isRO = mod.readonlyKey != null && infoMember.current_permissions.includes(mod.readonlyKey) && !infoMember.current_permissions.includes(mod.key)
                      const Icon = mod.icon
                      return (
                        <span key={mod.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>
                          <Icon size={11} /> {mod.label}{isRO && <span style={{ fontSize: 10, opacity: 0.7 }}>(lesen)</span>}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {infoMember.joined_at && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Dabei seit</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{new Date(infoMember.joined_at).toLocaleDateString('de-DE')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Module Edit Modal ── */}
      {moduleEditMember && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setModuleEditMemberId(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>Zugriffsmodule bearbeiten</h3>
              <button onClick={() => setModuleEditMemberId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Wähle die Bereiche, auf die <strong>{categoryForMember(moduleEditMember)}</strong> Zugriff hat.
              <strong style={{ color: 'var(--text-primary)' }}> Kommunikation</strong> ist immer aktiv.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {ALL_MODULES.map(mod => {
                const active = moduleEditPerms.has(mod.key) || (mod.readonlyKey != null && moduleEditPerms.has(mod.readonlyKey))
                const isReadonly = active && mod.readonlyKey != null && moduleEditPerms.has(mod.readonlyKey) && !moduleEditPerms.has(mod.key)
                const locked = mod.required
                const Icon = mod.icon
                return (
                  <button
                    key={mod.key}
                    onClick={() => toggleModuleEdit(mod)}
                    disabled={locked}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-light)' : 'var(--surface)', cursor: locked ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}
                  >
                    <Icon size={15} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1 }}>{mod.label}</span>
                    {locked ? (
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>Pflicht</span>
                    ) : (
                      <>
                        {active && mod.readonlyKey && (
                          <button
                            type="button"
                            title={isReadonly ? 'Nur lesen — klicken für Bearbeiten' : 'Bearbeiten — klicken für Nur lesen'}
                            onClick={e => { e.stopPropagation(); setModuleMode(mod, isReadonly ? 'full' : 'readonly') }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                          >
                            {isReadonly ? <Eye size={13} /> : <Pencil size={13} />}
                          </button>
                        )}
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border2)'}`, background: active ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {active && <Check size={11} color="#fff" />}
                        </div>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModuleEditMemberId(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button
                onClick={() => saveModules(moduleEditMember)}
                disabled={savingModules}
                style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: savingModules ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}
              >
                {savingModules ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item Permissions Lightbox ── */}
      {itemPermMemberId && (() => {
        const ipm = members.find(m => m.id === itemPermMemberId)
        if (!ipm || !ipm.user_id) return null
        const modLabel = ITEM_PERM_MODULES.find(x => x.key === itemPermModule)?.label ?? itemPermModule
        const hasFullAccess = ipm.current_permissions.includes(
          ITEM_PERM_MODULES.find(x => x.key === itemPermModule)?.modKey ?? ''
        )
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setItemPermMemberId(null)}
          >
            <div
              style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', maxWidth: 560, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    Item-Berechtigungen · {modLabel}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {categoryForMember(ipm)} · {ipm.profiles?.name ?? ipm.display_name ?? 'Unbekannt'}
                  </p>
                </div>
                <button onClick={() => setItemPermMemberId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                  <X size={18} />
                </button>
              </div>

              {/* Default info */}
              <div style={{ padding: '12px 24px', background: hasFullAccess ? 'rgba(52,199,89,0.08)' : 'rgba(255,149,0,0.08)', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, color: hasFullAccess ? '#34A853' : '#FF9500' }}>
                  {hasFullAccess
                    ? 'Standard: alle Items sichtbar und bearbeitbar (voller Modulzugang). Abweichungen unten konfigurieren.'
                    : 'Standard: alle Items nur lesbar (read-only Modulzugang). Bearbeitbarkeit kann hier nicht freigeschaltet werden.'}
                </p>
              </div>

              {/* Bulk toggles */}
              <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    const next: Record<string, { can_view: boolean; can_edit: boolean }> = {}
                    for (const item of itemPermItems) next[item.id] = { can_view: true, can_edit: false }
                    setItemPermMap(next)
                  }}
                  style={{ padding: '5px 12px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'var(--surface)', fontFamily: 'inherit' }}
                >
                  Alle sichtbar, nicht editierbar
                </button>
                {hasFullAccess && (
                  <button
                    onClick={() => {
                      const next: Record<string, { can_view: boolean; can_edit: boolean }> = {}
                      for (const item of itemPermItems) next[item.id] = { can_view: true, can_edit: true }
                      setItemPermMap(next)
                    }}
                    style={{ padding: '5px 12px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'var(--surface)', fontFamily: 'inherit' }}
                  >
                    Alle sichtbar & editierbar
                  </button>
                )}
                <button
                  onClick={() => {
                    const next: Record<string, { can_view: boolean; can_edit: boolean }> = {}
                    for (const item of itemPermItems) next[item.id] = { can_view: false, can_edit: false }
                    setItemPermMap(next)
                  }}
                  style={{ padding: '5px 12px', fontSize: 11, border: '1px solid rgba(255,59,48,0.3)', borderRadius: 6, cursor: 'pointer', background: 'rgba(255,59,48,0.06)', fontFamily: 'inherit', color: '#FF3B30' }}
                >
                  Alle ausblenden
                </button>
              </div>

              {/* Items list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {itemPermLoading ? (
                  <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
                ) : itemPermItems.length === 0 ? (
                  <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Keine Items gefunden.</div>
                ) : (
                  itemPermItems.map(item => {
                    const perm = itemPermMap[item.id] ?? { can_view: true, can_edit: hasFullAccess }
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', borderBottom: '1px solid var(--border)', background: !perm.can_view ? 'rgba(255,59,48,0.04)' : 'transparent' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: perm.can_view ? 'var(--text-primary)' : 'var(--text-tertiary)', textDecoration: perm.can_view ? 'none' : 'line-through' }}>{item.label}</p>
                          {item.sub && <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.sub}</p>}
                        </div>
                        {/* can_view toggle */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            checked={perm.can_view}
                            onChange={e => toggleItemPerm(item.id, 'can_view', e.target.checked)}
                            style={{ width: 14, height: 14 }}
                          />
                          Sichtbar
                        </label>
                        {/* can_edit toggle */}
                        {hasFullAccess && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                            <input
                              type="checkbox"
                              checked={perm.can_edit}
                              disabled={!perm.can_view}
                              onChange={e => toggleItemPerm(item.id, 'can_edit', e.target.checked)}
                              style={{ width: 14, height: 14 }}
                            />
                            Bearbeitbar
                          </label>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setItemPermMemberId(null)} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer' }}>Abbrechen</button>
                <button
                  onClick={() => saveItemPerms(ipm)}
                  disabled={itemPermSaving}
                  style={{ padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
                >
                  {itemPermSaving ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Vendor View Lightbox ── */}
      {vendorViewMemberId && (() => {
        const vvm = members.find(m => m.id === vendorViewMemberId)
        if (!vvm) return null
        const visibleModules = ALL_MODULES.filter(mod => vvm.current_permissions.includes(mod.key) && mod.key !== 'mod_chat')
        const activeData = vendorViewData[vendorViewTab]

        function renderTabContent() {
          if (vendorViewLoading && !activeData) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-tertiary)', gap: 10 }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Daten laden…
              </div>
            )
          }

          switch (vendorViewTab) {
            case 'mod_timeline': {
              const entries = (activeData as Array<{ id: string; start_minutes: number | null; duration_minutes: number | null; title: string | null; location: string | null }>) ?? []
              if (!entries.length) return <Empty />
              const fmt = (m: number | null) => { if (m == null) return '—'; const h = Math.floor(m / 60); const min = m % 60; return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}` }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {entries.map((e, i) => {
                    const endMin = e.start_minutes != null && e.duration_minutes != null ? e.start_minutes + e.duration_minutes : null
                    return (
                      <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, padding: '12px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'start' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(e.start_minutes)}{endMin != null ? ` – ${fmt(endMin)}` : ''}
                        </span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{e.title ?? '—'}</div>
                          {e.location && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{e.location}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
            case 'mod_location': {
              const loc = activeData as Record<string, string> | null
              if (!loc) return <Empty />
              const fields = [
                ['Parkinfo', loc.parking_info], ['Kontaktperson', loc.contact_name],
                ['Telefon', loc.contact_phone], ['E-Mail', loc.contact_email],
                ['Zugangscode', loc.access_code], ['Strom', loc.power_connections],
                ['Aufbau ab', loc.load_in_time], ['Abbau bis', loc.load_out_time],
                ['Notizen', loc.notes],
              ].filter(([, v]) => v)
              if (!fields.length) return <Empty />
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {fields.map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{value}</div>
                    </div>
                  ))}
                </div>
              )
            }
            case 'mod_guests': {
              const guests = (activeData as Array<{ id: string; name: string; status: string; meal_choice: string | null; allergy_tags: string[]; side: string | null }>) ?? []
              if (!guests.length) return <Empty />
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {guests.map((g, i) => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < guests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {g.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{g.name}</div>
                        {(g.meal_choice || g.allergy_tags?.length > 0) && (
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>
                            {[g.meal_choice, ...(g.allergy_tags ?? [])].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      {g.side && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: '#F0F0F5', padding: '2px 7px', borderRadius: 10 }}>{g.side}</span>}
                    </div>
                  ))}
                </div>
              )
            }
            case 'mod_seating': {
              const tables = (activeData as Array<{ id: string; name: string | null; capacity: number | null; shape: string }>) ?? []
              if (!tables.length) return <Empty />
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {tables.map(t => (
                    <div key={t.id} style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#F9F9FB' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.name ?? 'Tisch'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.capacity ? `${t.capacity} Plätze` : ''} {t.shape !== 'rectangular' ? `· ${t.shape}` : ''}</div>
                    </div>
                  ))}
                </div>
              )
            }
            case 'mod_catering': {
              const c = activeData as Record<string, unknown> | null
              if (!c) return <Empty />
              const fields: [string, string][] = [
                ['Serviceform', c.service_style as string],
                ['Küche vorhanden', c.location_has_kitchen ? 'Ja' : 'Nein'],
                ['Mitternachtssnack', c.midnight_snack ? (c.midnight_snack_note as string || 'Ja') : 'Nein'],
                ['Getränkeabrechnung', c.drinks_billing as string],
                ['Sektempfang / Fingerfood', c.champagne_finger_food ? (c.champagne_finger_food_note as string || 'Ja') : 'Nein'],
                ['Servicepersonal', c.service_staff ? 'Ja' : 'Nein'],
              ].filter(([, v]) => v) as [string, string][]
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {fields.map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                  {Array.isArray(c.drinks_selection) && (c.drinks_selection as string[]).length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Getränkeauswahl</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(c.drinks_selection as string[]).map(d => <span key={d} style={{ padding: '3px 9px', borderRadius: 10, background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 12 }}>{d}</span>)}</div>
                    </div>
                  )}
                  {Array.isArray(c.equipment_needed) && (c.equipment_needed as string[]).length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Equipment</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(c.equipment_needed as string[]).map(e => <span key={e} style={{ padding: '3px 9px', borderRadius: 10, background: '#F0F0F5', fontSize: 12 }}>{e}</span>)}</div>
                    </div>
                  )}
                </div>
              )
            }
            case 'mod_patisserie': {
              const p = activeData as Record<string, unknown> | null
              if (!p) return <Empty />
              const fields: [string, string][] = [
                ['Tortenbeschreibung', p.cake_description as string],
                ['Etagen', String(p.layers ?? '')],
                ['Lieferdatum', p.delivery_date as string],
                ['Lieferzeit', p.delivery_time as string],
                ['Aufstellort', p.setup_location as string],
                ['Kühlung benötigt', p.cooling_required ? (p.cooling_notes as string || 'Ja') : ''],
                ['Dessertbuffet', p.dessert_buffet ? 'Ja' : ''],
                ['Anmerkungen', p.vendor_notes as string],
              ].filter(([, v]) => v) as [string, string][]
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {fields.map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                  {Array.isArray(p.flavors) && (p.flavors as string[]).length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Geschmacksrichtungen</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(p.flavors as string[]).map(f => <span key={f} style={{ padding: '3px 9px', borderRadius: 10, background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 12 }}>{f}</span>)}</div>
                    </div>
                  )}
                </div>
              )
            }
            case 'mod_media': {
              const d = activeData as { briefing: Record<string, string> | null; shots: Array<{ id: string; title: string; description: string; type: string; category: string }> } | null
              if (!d) return <Empty />
              const briefingFields = d.briefing ? [
                d.briefing.photo_briefing, d.briefing.video_briefing,
                d.briefing.photo_restrictions, d.briefing.upload_instructions, d.briefing.delivery_deadline,
              ].filter(Boolean) : []
              if (!briefingFields.length && !d.shots.length) return <Empty />
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {d.briefing && (() => {
                    const fields: [string, string][] = [
                      ['Foto-Briefing', d.briefing!.photo_briefing],
                      ['Video-Briefing', d.briefing!.video_briefing],
                      ['Einschränkungen', d.briefing!.photo_restrictions],
                      ['Upload-Anweisungen', d.briefing!.upload_instructions],
                      ['Abgabefrist', d.briefing!.delivery_deadline],
                    ].filter(([, v]) => v) as [string, string][]
                    return fields.map(([label, value]) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{value}</div>
                      </div>
                    ))
                  })()}
                  {d.shots.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Shot-Liste ({d.shots.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {d.shots.map(s => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: s.type === 'must_have' ? '#EAF5EE' : s.type === 'forbidden' ? '#FDEAEA' : '#F0F0F5', color: s.type === 'must_have' ? '#3D7A56' : s.type === 'forbidden' ? '#A04040' : '#666', whiteSpace: 'nowrap', marginTop: 2 }}>
                              {s.type === 'must_have' ? 'Pflicht' : s.type === 'forbidden' ? 'Verboten' : 'Optional'}
                            </span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                              {s.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{s.description}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            }
            case 'mod_music': {
              const d = activeData as { songs: Array<{ id: string; title: string; artist: string; type: string; moment: string }>; requirements: Record<string, unknown> | null } | null
              if (!d) return <Empty />
              if (!d.songs.length && !d.requirements) return <Empty />
              const songGroups: Record<string, typeof d.songs> = {}
              for (const s of d.songs) { if (!songGroups[s.type]) songGroups[s.type] = []; songGroups[s.type].push(s) }
              const typeLabel: Record<string, string> = { wish: 'Wunsch', no_go: 'No-Go', playlist: 'Playlist' }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {Object.entries(songGroups).map(([type, songs]) => (
                    <div key={type}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{typeLabel[type] ?? type} ({songs.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {songs.map(s => (
                          <div key={s.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                              {s.artist && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.artist}</div>}
                            </div>
                            {s.moment && s.moment !== 'Allgemein' && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{s.moment}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {d.requirements && (() => {
                    const req = d.requirements
                    const fields: [string, string][] = [
                      ['Soundcheck', [req.soundcheck_date, req.soundcheck_time].filter(Boolean).join(' ')],
                      ['PA-Anlage', req.pa_notes as string],
                      ['Bühne', req.stage_dimensions as string],
                      ['Mikrofone', req.microphone_count ? String(req.microphone_count) : ''],
                      ['Strom', req.power_required as string],
                      ['Streaming', req.streaming_needed ? (req.streaming_notes as string || 'Ja') : ''],
                      ['Notizen', req.notes as string],
                    ].filter(([, v]) => v) as [string, string][]
                    if (!fields.length) return null
                    return (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Technische Anforderungen</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {fields.map(([label, value]) => (
                            <div key={label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, fontSize: 13 }}>
                              <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                              <span style={{ color: 'var(--text-primary)' }}>{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            }
            case 'mod_decor': {
              const items = (activeData as Array<{ id: string; title: string; description: string; location_in_venue: string; setup_by: string; teardown_at: string }>) ?? []
              if (!items.length) return <Empty />
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {items.map((item, i) => (
                    <div key={item.id} style={{ padding: '12px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
                      {item.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.description}</div>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {item.location_in_venue && <span>Ort: {item.location_in_venue}</span>}
                        {item.setup_by && <span>Aufbau: {item.setup_by}</span>}
                        {item.teardown_at && <span>Abbau: {item.teardown_at}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
            case 'mod_files': {
              const files = (activeData as Array<{ id: string; name: string; file_url: string; category: string; uploaded_at: string }>) ?? []
              if (!files.length) return <Empty />
              const catLabel: Record<string, string> = { vertrag: 'Vertrag', versicherung: 'Versicherung', genehmigung: 'Genehmigung', rider: 'Rider', sonstiges: 'Sonstiges' }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {files.map(f => (
                    <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', textDecoration: 'none', background: '#FAFAFA' }}>
                      <FileText size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{catLabel[f.category] ?? f.category} · {new Date(f.uploaded_at).toLocaleDateString('de-DE')}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )
            }
            default: return <Empty />
          }
        }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setVendorViewMemberId(null)}>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', width: 780, maxWidth: '100%', height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>Vendor-Ansicht</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                    Daten, auf die {categoryForMember(vvm)} <strong style={{ color: 'var(--text-primary)' }}>{vvm.display_name ?? vvm.profiles?.name ?? ''}</strong> zugreifen kann
                  </p>
                </div>
                <button onClick={() => setVendorViewMemberId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}><X size={18} /></button>
              </div>

              {/* Body: tabs left + content right */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Tab sidebar */}
                <div style={{ width: 180, borderRight: '1px solid var(--border)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, overflowY: 'auto' }}>
                  {visibleModules.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 10px' }}>Keine Module außer Chat</p>
                  ) : visibleModules.map(mod => {
                    const Icon = mod.icon
                    const active = vendorViewTab === mod.key
                    return (
                      <button
                        key={mod.key}
                        onClick={() => setVendorViewTab(mod.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: active ? 'var(--accent-light)' : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}
                      >
                        <Icon size={14} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>{mod.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  {vendorViewLoading && !activeData ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-tertiary)', paddingTop: 40, justifyContent: 'center' }}>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Daten laden…
                    </div>
                  ) : renderTabContent()}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Remove Confirm ── */}
      {removeConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setRemoveConfirm(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 380, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 12 }}>Mitglied entfernen?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Diese Person verliert den Zugang zum Event. Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRemoveConfirm(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button onClick={() => handleRemove(removeConfirm)} disabled={removing} style={{ padding: '9px 18px', background: '#FF3B30', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: removing ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}>
                {removing ? 'Entfernen…' : 'Ja, entfernen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Empty() {
  return <p style={{ color: 'var(--text-tertiary)', fontSize: 14, fontStyle: 'italic', paddingTop: 8 }}>Noch keine Daten vorhanden.</p>
}
