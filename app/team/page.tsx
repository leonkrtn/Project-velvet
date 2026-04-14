'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { Copy, Check, Plus, X } from 'lucide-react'
import { useEvent } from '@/lib/event-context'
import {
  fetchEventDienstleister,
  fetchTrauzeugePermissions,
  upsertTrauzeugePermissions,
  removeEventDienstleister,
} from '@/lib/db/events'
import type { EventDienstleister, TrauzeugePermissions } from '@/lib/types/roles'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'

const ROLE_LABELS: Record<string, string> = {
  veranstalter: 'Veranstalter',
  brautpaar: 'Brautpaar',
  trauzeuge: 'Trauzeuge',
  dienstleister: 'Dienstleister',
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#15803d' : 'var(--gold)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Kopiert' : 'Kopieren'}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px 18px', marginBottom: 10 }}>{children}</div>
}

type Member = { id: string; user_id: string; role: string; profiles?: { full_name?: string; email?: string } }

export default function TeamPage() {
  const { event, currentRole, currentUserId } = useEvent()
  const [members, setMembers] = useState<Member[]>([])
  const [dienstleister, setDienstleister] = useState<EventDienstleister[]>([])
  const [trauzeugePerm, setTrauzeugePerm] = useState<Record<string, TrauzeugePermissions>>({})
  const [loading, setLoading] = useState(true)

  // Invite code generation
  const [genRole, setGenRole] = useState<'brautpaar' | 'trauzeuge' | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [generating, setGenerating] = useState(false)

  // Dienstleister invite
  const [showDlForm, setShowDlForm] = useState(false)
  const [dlName, setDlName] = useState('')
  const [dlCategory, setDlCategory] = useState('')
  const [dlEmail, setDlEmail] = useState('')
  const [dlCode, setDlCode] = useState('')
  const [dlGenerating, setDlGenerating] = useState(false)

  const canManage = currentRole === 'veranstalter' || currentRole === 'brautpaar'

  const loadData = useCallback(async () => {
    if (!event?.id) return
    const supabase = createBrowserSupabaseClient()
    const { data } = await supabase
      .from('event_members')
      .select('id, user_id, role, profiles(name, email)')
      .eq('event_id', event.id)
    setMembers((data as Member[]) ?? [])

    const dl = await fetchEventDienstleister(event.id)
    setDienstleister(dl)

    // Load permissions for each Trauzeuge
    const trauzeugen = (data as Member[] ?? []).filter(m => m.role === 'trauzeuge')
    const permsArr = await Promise.all(trauzeugen.map(m => fetchTrauzeugePermissions(event.id, m.user_id)))
    const permsMap: Record<string, TrauzeugePermissions> = {}
    permsArr.forEach((p, i) => { if (p) permsMap[trauzeugen[i].user_id] = p })
    setTrauzeugePerm(permsMap)

    setLoading(false)
  }, [event?.id])

  useEffect(() => { loadData() }, [loadData])

  async function generateInvite(role: 'brautpaar' | 'trauzeuge') {
    setGenerating(true)
    setInviteCode('')
    const res = await fetch('/api/invite/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event?.id, targetRole: role }),
    })
    const data = await res.json()
    setInviteCode(data.code ?? '')
    setGenRole(role)
    setGenerating(false)
  }

  async function generateDlInvite() {
    if (!dlName || !dlCategory) return
    setDlGenerating(true)
    const res = await fetch('/api/invite/dienstleister', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event?.id, name: dlName, category: dlCategory, email: dlEmail || undefined, scopes: [] }),
    })
    const data = await res.json()
    setDlCode(data.code ?? '')
    setDlGenerating(false)
    await loadData()
  }

  async function togglePerm(userId: string, key: keyof TrauzeugePermissions, value: boolean) {
    if (!event?.id) return
    const current = trauzeugePerm[userId]
    if (!current) return
    const updated = { ...current, [key]: value }
    setTrauzeugePerm(p => ({ ...p, [userId]: updated }))
    await upsertTrauzeugePermissions(updated)
  }

  if (!canManage) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Kein Zugriff.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Team</p>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>Mitglieder verwalten und einladen.</p>

      {loading && <p style={{ fontSize: 14, color: 'var(--text-dim)', textAlign: 'center', marginTop: 40 }}>Lädt…</p>}

      {/* Current Members */}
      <Section title="Aktuelle Mitglieder">
        {members.map(m => (
          <Card key={m.id}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>
                  {(m.profiles as { full_name?: string })?.full_name ?? 'Unbekannt'}
                  {m.user_id === currentUserId && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gold)' }}>Du</span>}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
                  {(m.profiles as { email?: string })?.email ?? ''}
                </p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                background: 'var(--gold)20', color: 'var(--gold)', padding: '3px 8px', borderRadius: 6,
              }}>
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </div>

            {/* Trauzeuge permissions inline */}
            {m.role === 'trauzeuge' && trauzeugePerm[m.user_id] && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 8 }}>
                  Berechtigungen
                </p>
                <PermissionMatrix
                  perms={trauzeugePerm[m.user_id]}
                  onToggle={(key, val) => togglePerm(m.user_id, key, val)}
                />
              </div>
            )}
          </Card>
        ))}
        {!loading && members.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Noch keine Mitglieder.</p>
        )}
      </Section>

      {/* Invite Codes */}
      <Section title="Einladen">
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {currentRole === 'veranstalter' && (
            <button
              onClick={() => generateInvite('brautpaar')}
              disabled={generating}
              style={{ padding: '9px 16px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Brautpaar einladen
            </button>
          )}
          <button
            onClick={() => generateInvite('trauzeuge')}
            disabled={generating}
            style={{ padding: '9px 16px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Trauzeugen einladen
          </button>
        </div>

        {inviteCode && (
          <Card>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
              Einladungslink für {ROLE_LABELS[genRole ?? ''] ?? genRole} (7 Tage gültig):
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
              <code style={{ flex: 1, fontSize: 12, wordBreak: 'break-all', color: 'var(--text)' }}>
                {`${typeof window !== 'undefined' ? window.location.origin : ''}/signup?invite=${inviteCode}`}
              </code>
              <CopyBtn value={`${typeof window !== 'undefined' ? window.location.origin : ''}/signup?invite=${inviteCode}`} />
            </div>
          </Card>
        )}
      </Section>

      {/* Dienstleister */}
      <Section title="Dienstleister">
        {dienstleister.map(dl => (
          <Card key={dl.id}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>
                  {dl.profile?.name ?? 'Dienstleister'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{dl.category}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: dl.status === 'aktiv' ? '#d4edda' : '#fff3cd',
                  color: dl.status === 'aktiv' ? '#15803d' : '#92400e',
                  padding: '3px 8px', borderRadius: 6,
                }}>
                  {dl.status === 'aktiv' ? 'Aktiv' : dl.status === 'eingeladen' ? 'Eingeladen' : 'Beendet'}
                </span>
                <button
                  onClick={async () => {
                    await removeEventDienstleister(dl.id)
                    setDienstleister(prev => prev.filter(d => d.id !== dl.id))
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {dl.scopes.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {dl.scopes.map(s => (
                  <span key={s} style={{ fontSize: 10, background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20, color: 'var(--text-dim)' }}>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </Card>
        ))}

        {!showDlForm ? (
          <button
            onClick={() => setShowDlForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Plus size={15} /> Dienstleister einladen
          </button>
        ) : (
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Neuer Dienstleister</p>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 5 }}>Name *</p>
              <input value={dlName} onChange={e => setDlName(e.target.value)} placeholder="Firma oder Person" style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 5 }}>Kategorie *</p>
              <select value={dlCategory} onChange={e => setDlCategory(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">Wählen…</option>
                {['Catering', 'DJ', 'Fotograf', 'Videograf', 'Floristik', 'Musik', 'Transport', 'Sonstiges'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 5 }}>E-Mail</p>
              <input value={dlEmail} onChange={e => setDlEmail(e.target.value)} type="email" placeholder="Optional" style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            {dlCode ? (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Einladungslink (7 Tage gültig):</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all', color: 'var(--text)' }}>
                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/signup?invite=${dlCode}`}
                  </code>
                  <CopyBtn value={`${typeof window !== 'undefined' ? window.location.origin : ''}/signup?invite=${dlCode}`} />
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={generateDlInvite}
                disabled={!dlName || !dlCategory || dlGenerating}
                style={{ flex: 1, padding: '10px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {dlGenerating ? 'Erstellt…' : dlCode ? 'Neu generieren' : 'Einladung erstellen'}
              </button>
              <button
                onClick={() => { setShowDlForm(false); setDlCode(''); setDlName(''); setDlCategory(''); setDlEmail('') }}
                style={{ padding: '10px 14px', background: 'none', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Abbrechen
              </button>
            </div>
          </Card>
        )}
      </Section>
    </div>
  )
}

const PERM_LABELS: { key: keyof TrauzeugePermissions; label: string }[] = [
  { key: 'canViewGuests', label: 'Gäste ansehen' },
  { key: 'canEditGuests', label: 'Gäste bearbeiten' },
  { key: 'canViewSeating', label: 'Sitzplan ansehen' },
  { key: 'canEditSeating', label: 'Sitzplan bearbeiten' },
  { key: 'canViewBudget', label: 'Budget ansehen' },
  { key: 'canViewCatering', label: 'Catering ansehen' },
  { key: 'canViewTimeline', label: 'Ablauf ansehen' },
  { key: 'canEditTimeline', label: 'Ablauf bearbeiten' },
  { key: 'canViewVendors', label: 'Dienstleister ansehen' },
  { key: 'canManageDeko', label: 'Deko verwalten' },
]

function PermissionMatrix({ perms, onToggle }: { perms: TrauzeugePermissions; onToggle: (key: keyof TrauzeugePermissions, val: boolean) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
      {PERM_LABELS.map(({ key, label }) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!perms[key]}
            onChange={e => onToggle(key, e.target.checked)}
            style={{ accentColor: 'var(--gold)', width: 14, height: 14 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
        </label>
      ))}
    </div>
  )
}
