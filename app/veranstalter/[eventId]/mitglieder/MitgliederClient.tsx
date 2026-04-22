'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronDown, ChevronUp, Trash2, Copy, Check, MessageSquare, Phone, Mail, Euro, Tag, FileText } from 'lucide-react'
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
  role: MemberRole
  joined_at: string | null
  display_name: string | null
  invite_status: string | null
  profiles: Profile | null
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

function SectionTable({ title, children, empty }: { title: string; children: React.ReactNode; empty: string }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 12, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {children}
      </div>
    </div>
  )
}

export default function MitgliederClient({ eventId, members: initialMembers, vendors }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Modal-State
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

  // Signup-Code-State
  const [signupCode, setSignupCode]               = useState<string | null>(null)
  const [signupCodeCopied, setSignupCodeCopied]   = useState(false)
  const [creatingSignupCode, setCreatingSignupCode] = useState(false)
  const [signupCodeError, setSignupCodeError]     = useState<string | null>(null)

  // Brautpaar + Trauzeugen (Veranstalter ausgeblendet)
  const bpTz = members.filter(m => m.role === 'brautpaar' || m.role === 'trauzeuge')
  // Dienstleister-Mitglieder
  const dlMembers = members.filter(m => m.role === 'dienstleister')

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
      body: JSON.stringify({
        eventId,
        category:    inviteDLCategory,
        permissions: Array.from(selectedModules),
      }),
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
    const supabase = createClient()
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

  function vendorForMember(m: Member): Vendor | undefined {
    return vendors.find(v => v.email && m.profiles?.email && v.email.toLowerCase() === m.profiles.email.toLowerCase())
  }

  // ── Modal Steps ────────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderBpTzRow(m: Member) {
    const isOpen = expanded.has(m.id)
    const displayName = m.display_name || m.profiles?.name || 'Unbekannt'
    const statusCfg = INVITE_STATUS_CFG[m.invite_status ?? 'invited'] ?? INVITE_STATUS_CFG.invited
    return (
      <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px 40px', gap: 0, padding: '14px 20px', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle(m.id)}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {initials(displayName)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ROLE_LABELS[m.role]}</div>
          </div>
          <StatusBadge cfg={statusCfg} />
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
    const vStatusCfg = VENDOR_STATUS_CFG[vendor?.status ?? 'angefragt'] ?? VENDOR_STATUS_CFG.angefragt
    return (
      <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 150px 40px', gap: 0, padding: '14px 20px', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle(m.id)}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0F0F5', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {initials(displayName)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{vendor?.category ?? 'Dienstleister'}</div>
          </div>
          <StatusBadge cfg={vStatusCfg} />
          <div style={{ display: 'flex', color: 'var(--text-tertiary)' }}>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {isOpen && (
          <div style={{ padding: '0 20px 18px 60px', background: '#F5F5F7', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 14, paddingTop: 14 }}>
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

      {/* Tabelle 1: Brautpaar & Trauzeugen */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 12, color: 'var(--text-primary)' }}>
          Brautpaar & Trauzeugen
        </h2>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px 40px', gap: 0, padding: '10px 20px', background: '#F5F5F7', borderBottom: '1px solid var(--border)' }}>
            {['', 'Name', 'Status', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{h}</span>
            ))}
          </div>
          {bpTz.length === 0
            ? <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>Noch keine Mitglieder in dieser Gruppe</div>
            : bpTz.map(renderBpTzRow)
          }
        </div>
      </div>

      {/* Tabelle 2: Dienstleister */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 12, color: 'var(--text-primary)' }}>
          Dienstleister
        </h2>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 150px 40px', gap: 0, padding: '10px 20px', background: '#F5F5F7', borderBottom: '1px solid var(--border)' }}>
            {['', 'Name & Kategorie', 'Status', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{h}</span>
            ))}
          </div>
          {dlMembers.length === 0
            ? <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>Noch keine Dienstleister eingeladen</div>
            : dlMembers.map(renderDlRow)
          }
        </div>
      </div>

      {/* Dienstleister-Account erstellen */}
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

      {/* Einladungs-Modal */}
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

      {/* Entfernen-Bestätigung */}
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
    </div>
  )
}
