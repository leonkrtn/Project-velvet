'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronDown, ChevronUp, Trash2, Copy, Check, MessageSquare } from 'lucide-react'

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
  brautpaar: 'Brautpaar',
  trauzeuge: 'Trauzeuge',
  dienstleister: 'Dienstleister',
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  confirmed: { bg: '#EAF5EE', color: '#3D7A56', label: 'Bestätigt' },
  invited:   { bg: '#FFF8E6', color: '#B8860B', label: 'Eingeladen' },
  pending:   { bg: '#F0F0F0', color: '#666',    label: 'Ausstehend' },
  declined:  { bg: '#FDEAEA', color: '#A04040', label: 'Abgesagt' },
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'invited'
  const cfg = STATUS_COLORS[s] ?? STATUS_COLORS.invited
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

type FilterType = 'alle' | 'bestaetigt' | 'offen'
type InviteRole = 'brautpaar' | 'trauzeuge'

export default function MitgliederClient({ eventId, members: initialMembers, vendors }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<FilterType>('alle')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteRole, setInviteRole] = useState<InviteRole>('trauzeuge')
  const [inviting, setInviting] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const filtered = members.filter(m => {
    if (filter === 'bestaetigt') return m.invite_status === 'confirmed'
    if (filter === 'offen') return m.invite_status !== 'confirmed'
    return true
  })

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleInvite() {
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
    }
  }

  async function copyCode() {
    if (!inviteCode) return
    const url = `${window.location.origin}/invite/${inviteCode}`
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

  // Find vendor by member email match
  function vendorForMember(m: Member): Vendor | undefined {
    if (m.role !== 'dienstleister') return undefined
    return vendors.find(v => v.email && m.profiles?.email && v.email.toLowerCase() === m.profiles.email.toLowerCase())
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 28, fontWeight: 600, marginBottom: 6 }}>Mitglieder</h1>
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>{members.length} Mitglieder insgesamt</p>
        </div>
        <button
          onClick={() => { setShowInviteModal(true); setInviteCode(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
        >
          <Plus size={15} /> Einladen
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface2)', borderRadius: 'var(--r-sm)', padding: 4, width: 'fit-content' }}>
        {(['alle', 'bestaetigt', 'offen'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-sel={filter === f ? '1' : undefined}
            style={{
              padding: '7px 16px', borderRadius: 'calc(var(--r-sm) - 2px)', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: filter === f ? 'var(--surface)' : 'transparent',
              color: filter === f ? 'var(--text)' : 'var(--text-dim)',
              boxShadow: filter === f ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {f === 'alle' ? `Alle (${members.length})` : f === 'bestaetigt' ? `Bestätigt (${members.filter(m => m.invite_status === 'confirmed').length})` : `Offen (${members.filter(m => m.invite_status !== 'confirmed').length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 130px 40px', gap: 0, padding: '10px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          {['', 'Name & Rolle', 'Kosten', 'Status', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)' }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14, fontStyle: 'italic' }}>
            Keine Mitglieder gefunden
          </div>
        )}

        {filtered.map(m => {
          const vendor = vendorForMember(m)
          const isOpen = expanded.has(m.id)
          const displayName = m.display_name || m.profiles?.name || 'Unbekannt'
          return (
            <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 130px 40px', gap: 0, padding: '14px 20px', alignItems: 'center' }}>
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--gold-pale)', color: 'var(--gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {initials(displayName)}
                </div>

                {/* Name + role */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{displayName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ROLE_LABELS[m.role]}</div>
                </div>

                {/* Cost */}
                <div style={{ fontSize: 14, color: 'var(--text-mid)' }}>
                  {vendor ? `${fmtMoney(vendor.price)} ${vendor.cost_label ?? ''}` : '—'}
                </div>

                {/* Status */}
                <StatusBadge status={m.invite_status} />

                {/* Expand */}
                <button onClick={() => toggle(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-dim)' }}>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ padding: '0 20px 16px 60px', background: 'var(--surface2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 3 }}>E-Mail</div>
                      <div style={{ fontSize: 13 }}>{m.profiles?.email ?? '—'}</div>
                    </div>
                    {vendor && (
                      <>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 3 }}>Kategorie</div>
                          <div style={{ fontSize: 13 }}>{vendor.category ?? '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 3 }}>Telefon</div>
                          <div style={{ fontSize: 13 }}>{vendor.phone ?? '—'}</div>
                        </div>
                      </>
                    )}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 3 }}>Dabei seit</div>
                      <div style={{ fontSize: 13 }}>{m.joined_at ? new Date(m.joined_at).toLocaleDateString('de-DE') : '—'}</div>
                    </div>
                  </div>
                  {vendor?.notes && (
                    <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>{vendor.notes}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`/veranstalter/${eventId}/chats`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '7px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                      fontSize: 13, color: 'var(--text-mid)', textDecoration: 'none', background: 'var(--surface)',
                    }}>
                      <MessageSquare size={13} /> Nachricht
                    </a>
                    {m.role !== 'veranstalter' && (
                      <button
                        onClick={() => setRemoveConfirm(m.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--red-pale)', fontSize: 13, color: 'var(--red)', background: 'var(--red-pale)', cursor: 'pointer' }}
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => !inviteCode && setShowInviteModal(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: 28, width: 420, maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Mitglied einladen</h3>

            {!inviteCode ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 6 }}>Rolle</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as InviteRole)}
                    style={{ width: '100%', padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }}
                  >
                    <option value="brautpaar">Brautpaar</option>
                    <option value="trauzeuge">Trauzeuge</option>
                  </select>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 20 }}>
                  Ein Einladungslink wird erstellt. Teile ihn mit der Person, die beitreten soll. Der Link ist 7 Tage gültig.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowInviteModal(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
                  <button onClick={handleInvite} disabled={inviting} style={{ padding: '9px 20px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: inviting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}>
                    {inviting ? 'Erstellen…' : 'Link erstellen'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 14 }}>
                  Einladungslink für <strong>{inviteRole === 'brautpaar' ? 'Brautpaar' : 'Trauzeuge'}</strong>:
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inviteCode}`} style={{ flex: 1, padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, background: 'var(--surface2)', outline: 'none' }} />
                  <button onClick={copyCode} style={{ padding: '10px 14px', background: copied ? 'var(--green)' : 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Kopiert' : 'Kopieren'}
                  </button>
                </div>
                <button onClick={() => setShowInviteModal(false)} style={{ width: '100%', padding: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14 }}>Schließen</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Remove Confirm */}
      {removeConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setRemoveConfirm(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: 28, width: 380, maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Mitglied entfernen?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 24 }}>
              Diese Person verliert den Zugang zum Event. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRemoveConfirm(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button onClick={() => handleRemove(removeConfirm)} disabled={removing} style={{ padding: '9px 18px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: removing ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}>
                {removing ? 'Entfernen…' : 'Ja, entfernen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
