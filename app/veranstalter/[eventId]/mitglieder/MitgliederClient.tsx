'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronDown, ChevronUp, Trash2, Copy, Check, MessageSquare } from 'lucide-react'
import { ALL_MODULES, ROLE_MODULE_DEFAULTS } from '@/lib/vendor-modules'

type MemberRole = 'veranstalter' | 'brautpaar' | 'trauzeuge' | 'dienstleister'

interface Member {
  id: string
  role: MemberRole
  joined_at: string | null
  display_name: string | null
  invite_status: string | null
  profiles: { id: string; name: string; email: string } | null
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

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  confirmed: { bg: '#EAF5EE', color: '#3D7A56', label: 'Bestätigt' },
  invited:   { bg: '#FFF8E6', color: '#B8860B', label: 'Eingeladen' },
  pending:   { bg: '#F0F0F0', color: '#666',    label: 'Ausstehend' },
  declined:  { bg: '#FDEAEA', color: '#A04040', label: 'Abgesagt' },
}

const DL_CATEGORIES = [
  'Fotograf', 'Videograf', 'Caterer', 'Floristin', 'Band / DJ',
  'Konditorei', 'Hairstylist / Make-up', 'Trauungsredner', 'Location', 'Andere',
]

type FilterType  = 'alle' | 'bestaetigt' | 'offen'
type InviteRole  = 'brautpaar' | 'trauzeuge' | 'dienstleister'
type ModalStep   = 'basis' | 'module' | 'bestaetigung' | 'code'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'invited'
  const cfg = STATUS_COLORS[s] ?? STATUS_COLORS.invited
  return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
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
  const [members, setMembers]           = useState(initialMembers)
  const [expanded, setExpanded]         = useState<Set<string>>(new Set())
  const [filter, setFilter]             = useState<FilterType>('alle')

  // Modal-State
  const [showInviteModal, setShowInviteModal]   = useState(false)
  const [modalStep, setModalStep]               = useState<ModalStep>('basis')
  const [inviteRole, setInviteRole]             = useState<InviteRole>('trauzeuge')
  const [inviteDLName, setInviteDLName]         = useState('')
  const [inviteDLCategory, setInviteDLCategory] = useState(DL_CATEGORIES[0])
  const [inviteDLEmail, setInviteDLEmail]       = useState('')
  const [selectedModules, setSelectedModules]   = useState<Set<string>>(new Set(['mod_chat']))
  const [inviting, setInviting]                 = useState(false)
  const [inviteCode, setInviteCode]             = useState<string | null>(null)
  const [copied, setCopied]                     = useState(false)
  const [removeConfirm, setRemoveConfirm]       = useState<string | null>(null)
  const [removing, setRemoving]                 = useState(false)

  // Signup-Code-State
  const [signupCode, setSignupCode]             = useState<string | null>(null)
  const [signupCodeCopied, setSignupCodeCopied] = useState(false)
  const [creatingSignupCode, setCreatingSignupCode] = useState(false)
  const [signupCodeError, setSignupCodeError]   = useState<string | null>(null)

  const filtered = members.filter(m => {
    if (filter === 'bestaetigt') return m.invite_status === 'confirmed'
    if (filter === 'offen')      return m.invite_status !== 'confirmed'
    return true
  })

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
    setInviteDLName('')
    setInviteDLEmail('')
    setInviteDLCategory(DL_CATEGORIES[0])
    setSelectedModules(new Set(ROLE_MODULE_DEFAULTS[DL_CATEGORIES[0]] ?? ['mod_chat']))
    setInviteCode(null)
    setCopied(false)
  }

  function closeModal() {
    setShowInviteModal(false)
  }

  function handleCategoryChange(cat: string) {
    setInviteDLCategory(cat)
    setSelectedModules(new Set(ROLE_MODULE_DEFAULTS[cat] ?? ['mod_chat']))
  }

  function toggleModule(key: string) {
    if (key === 'mod_chat') return // immer aktiv
    setSelectedModules(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Für Brautpaar / Trauzeuge: altes Flow
  async function handleInviteSimple() {
    setInviting(true)
    const res = await fetch('/api/invite/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, targetRole: inviteRole }),
    })
    const data = await res.json()
    setInviting(false)
    if (data.code) {
      setInviteCode(data.code)
      setModalStep('code')
    }
  }

  // Für Dienstleister: neues Flow mit event_invitations
  async function handleInviteVendor() {
    setInviting(true)
    const res = await fetch('/api/vendor/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        name:        inviteDLName.trim(),
        category:    inviteDLCategory,
        email:       inviteDLEmail.trim() || undefined,
        permissions: Array.from(selectedModules),
      }),
    })
    const data = await res.json()
    setInviting(false)
    if (data.code) {
      setInviteCode(data.code)
      setModalStep('code')
    }
  }

  function handleBasisWeiter() {
    if (inviteRole !== 'dienstleister') {
      handleInviteSimple()
      return
    }
    setModalStep('module')
  }

  async function copyCode() {
    if (!inviteCode) return
    const url = `${window.location.origin}/vendor/join?code=${inviteCode}`
    await navigator.clipboard.writeText(url)
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
    if (!res.ok || data.error) {
      setSignupCodeError(data.error ?? 'Fehler beim Erstellen')
      return
    }
    setSignupCode(data.code)
    setSignupCodeCopied(false)
  }

  async function copySignupCode() {
    if (!signupCode) return
    const url = `${window.location.origin}/vendor/signup?code=${signupCode}`
    await navigator.clipboard.writeText(url)
    setSignupCodeCopied(true)
    setTimeout(() => setSignupCodeCopied(false), 2000)
  }

  function vendorForMember(m: Member): Vendor | undefined {
    if (m.role !== 'dienstleister') return undefined
    return vendors.find(v => v.email && m.profiles?.email && v.email.toLowerCase() === m.profiles.email.toLowerCase())
  }

  // ── Modal-Inhalte pro Schritt ────────────────────────────────────────────

  const stepBasis = (
    <>
      <div style={{ marginBottom: 16 }}>
        <Label>Rolle</Label>
        <select
          value={inviteRole}
          onChange={e => { setInviteRole(e.target.value as InviteRole); setInviteDLName(''); setInviteDLEmail('') }}
          style={{ width: '100%', padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}
        >
          <option value="brautpaar">Brautpaar</option>
          <option value="trauzeuge">Trauzeuge</option>
          <option value="dienstleister">Dienstleister</option>
        </select>
      </div>

      {inviteRole === 'dienstleister' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Label>Name *</Label>
            <FieldInput value={inviteDLName} onChange={setInviteDLName} placeholder="z.B. Max Mustermann" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Kategorie</Label>
            <select
              value={inviteDLCategory}
              onChange={e => handleCategoryChange(e.target.value)}
              style={{ width: '100%', padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}
            >
              {DL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Label>E-Mail (optional)</Label>
            <FieldInput value={inviteDLEmail} onChange={setInviteDLEmail} placeholder="name@beispiel.de" type="email" />
          </div>
        </>
      )}

      {inviteRole !== 'dienstleister' && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Ein Einladungslink wird erstellt und ist 7 Tage gültig.
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={closeModal} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>
          Abbrechen
        </button>
        <button
          onClick={handleBasisWeiter}
          disabled={inviting || (inviteRole === 'dienstleister' && !inviteDLName.trim())}
          style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: inviting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, opacity: (inviteRole === 'dienstleister' && !inviteDLName.trim()) ? 0.5 : 1 }}
        >
          {inviting ? 'Erstellen…' : inviteRole === 'dienstleister' ? 'Weiter' : 'Link erstellen'}
        </button>
      </div>
    </>
  )

  const stepModule = (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Wähle die Bereiche, auf die <strong>{inviteDLName}</strong> ({inviteDLCategory}) Zugriff erhält.
        <strong style={{ color: 'var(--text-primary)' }}> Kommunikation</strong> ist immer aktiv.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {ALL_MODULES.map(mod => {
          const active   = selectedModules.has(mod.key)
          const locked   = mod.required
          const Icon     = mod.icon
          return (
            <button
              key={mod.key}
              onClick={() => toggleModule(mod.key)}
              disabled={locked}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-light)' : 'var(--surface)',
                cursor: locked ? 'default' : 'pointer',
                textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <Icon size={15} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1 }}>
                {mod.label}
              </span>
              {locked && (
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>
                  Pflicht
                </span>
              )}
              {!locked && (
                <div style={{
                  width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
                  background: active ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {active && <Check size={11} color="#fff" />}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => setModalStep('basis')} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>
          Zurück
        </button>
        <button onClick={() => setModalStep('bestaetigung')} style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          Weiter
        </button>
      </div>
    </>
  )

  const stepBestaetigung = (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Bitte prüfe die Einladung vor dem Erstellen.
      </p>
      <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 12px', fontSize: 13 }}>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name</span>
          <span style={{ fontWeight: 500 }}>{inviteDLName}</span>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Kategorie</span>
          <span>{inviteDLCategory}</span>
          {inviteDLEmail && (
            <>
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>E-Mail</span>
              <span>{inviteDLEmail}</span>
            </>
          )}
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Zugriff</span>
          <span style={{ lineHeight: 1.6 }}>
            {ALL_MODULES.filter(m => selectedModules.has(m.key)).map(m => m.label).join(', ')}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => setModalStep('module')} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>
          Zurück
        </button>
        <button
          onClick={handleInviteVendor}
          disabled={inviting}
          style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: inviting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}
        >
          {inviting ? 'Erstellen…' : 'Einladung erstellen'}
        </button>
      </div>
    </>
  )

  const stepCode = (
    <>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14 }}>
        Einladungslink für{' '}
        <strong>
          {inviteRole === 'brautpaar' ? 'Brautpaar'
           : inviteRole === 'trauzeuge' ? 'Trauzeuge'
           : `${inviteDLCategory} (${inviteDLName})`}
        </strong>
        :
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          readOnly
          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/vendor/join?code=${inviteCode}`}
          style={{ flex: 1, padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#F5F5F7', outline: 'none' }}
        />
        <button
          onClick={copyCode}
          style={{ padding: '10px 14px', background: copied ? '#34C759' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, whiteSpace: 'nowrap' }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
      <button onClick={closeModal} style={{ width: '100%', padding: '10px', background: '#F5F5F7', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>
        Schließen
      </button>
    </>
  )

  const STEP_TITLES: Record<ModalStep, string> = {
    basis:        'Mitglied einladen',
    module:       'Zugriffsmodule wählen',
    bestaetigung: 'Einladung bestätigen',
    code:         'Einladungslink',
  }

  // ── Schritt-Indikator (nur für DL-Flow) ─────────────────────────────────
  const showStepIndicator = inviteRole === 'dienstleister' && modalStep !== 'code'
  const DL_STEPS: ModalStep[] = ['basis', 'module', 'bestaetigung']
  const currentStepIdx = DL_STEPS.indexOf(modalStep)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Mitglieder</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{members.length} Mitglieder insgesamt</p>
        </div>
        <button
          onClick={openModal}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
        >
          <Plus size={15} /> Einladen
        </button>
      </div>

      {/* Filter-Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#EBEBEC', borderRadius: 'var(--radius-sm)', padding: 4, width: 'fit-content' }}>
        {(['alle', 'bestaetigt', 'offen'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 16px', borderRadius: 'calc(var(--radius-sm) - 2px)', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: filter === f ? 'var(--surface)' : 'transparent',
              color: filter === f ? 'var(--text-primary)' : 'var(--text-tertiary)',
              boxShadow: filter === f ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {f === 'alle' ? `Alle (${members.length})` : f === 'bestaetigt' ? `Bestätigt (${members.filter(m => m.invite_status === 'confirmed').length})` : `Offen (${members.filter(m => m.invite_status !== 'confirmed').length})`}
          </button>
        ))}
      </div>

      {/* Tabelle */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px 40px', gap: 0, padding: '10px 20px', background: '#F5F5F7', borderBottom: '1px solid var(--border)' }}>
          {['', 'Name & Rolle', 'Status', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>
            Keine Mitglieder gefunden
          </div>
        )}

        {filtered.map(m => {
          const vendor      = vendorForMember(m)
          const isOpen      = expanded.has(m.id)
          const displayName = m.display_name || m.profiles?.name || 'Unbekannt'
          return (
            <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px 40px', gap: 0, padding: '14px 20px', alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                  {initials(displayName)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{displayName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ROLE_LABELS[m.role]}</div>
                </div>
                <StatusBadge status={m.invite_status} />
                <button onClick={() => toggle(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)' }}>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {isOpen && (
                <div style={{ padding: '0 20px 16px 60px', background: '#F5F5F7' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>E-Mail</div>
                      <div style={{ fontSize: 13 }}>{m.profiles?.email ?? '—'}</div>
                    </div>
                    {vendor && (
                      <>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>Kategorie</div>
                          <div style={{ fontSize: 13 }}>{vendor.category ?? '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>Telefon</div>
                          <div style={{ fontSize: 13 }}>{vendor.phone ?? '—'}</div>
                        </div>
                      </>
                    )}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>Dabei seit</div>
                      <div style={{ fontSize: 13 }}>{m.joined_at ? new Date(m.joined_at).toLocaleDateString('de-DE') : '—'}</div>
                    </div>
                  </div>
                  {vendor?.notes && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{vendor.notes}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`/veranstalter/${eventId}/chats`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', background: 'var(--surface)' }}>
                      <MessageSquare size={13} /> Nachricht
                    </a>
                    {m.role !== 'veranstalter' && (
                      <button
                        onClick={() => setRemoveConfirm(m.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,59,48,0.2)', fontSize: 13, color: '#FF3B30', background: 'rgba(255,59,48,0.08)', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} /> Entfernen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Dienstleister-Account erstellen */}
      <div style={{ marginTop: 32, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/vendor/signup?code=${signupCode}`}
                style={{ flex: 1, padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: '#F5F5F7', outline: 'none' }}
              />
              <button
                onClick={copySignupCode}
                style={{ padding: '10px 14px', background: signupCodeCopied ? '#34C759' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, whiteSpace: 'nowrap' }}
              >
                {signupCodeCopied ? <Check size={14} /> : <Copy size={14} />}
                {signupCodeCopied ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', flex: 1 }}>Link ist 7 Tage gültig und kann nur einmal verwendet werden.</p>
              <button
                onClick={() => { setSignupCode(null); setSignupCodeError(null) }}
                style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
              >
                Neuen Code erstellen
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={createSignupCode}
            disabled={creatingSignupCode}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: creatingSignupCode ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500, opacity: creatingSignupCode ? 0.7 : 1 }}
          >
            <Plus size={15} />
            {creatingSignupCode ? 'Erstellen…' : 'Registrierungslink erstellen'}
          </button>
        )}
      </div>

      {/* Einladungs-Modal */}
      {showInviteModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => modalStep === 'code' ? closeModal() : undefined}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 460, maxWidth: '100%', boxShadow: 'var(--shadow-md)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 0 }}>
                {STEP_TITLES[modalStep]}
              </h3>
              {/* Schritt-Anzeige für Dienstleister-Flow */}
              {showStepIndicator && (
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  {DL_STEPS.map((s, i) => (
                    <div
                      key={s}
                      style={{
                        height: 3, flex: 1, borderRadius: 2,
                        background: i <= currentStepIdx ? 'var(--accent)' : 'var(--border)',
                        transition: 'background 0.2s',
                      }}
                    />
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
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setRemoveConfirm(null)}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 380, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 12 }}>Mitglied entfernen?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Diese Person verliert den Zugang zum Event. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
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
