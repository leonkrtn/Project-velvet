'use client'
import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, RefreshCw } from 'lucide-react'

interface Permissions {
  id?: string
  event_id?: string
  ablaufplan: boolean
  sub_events: boolean
  erinnerungen: boolean
  sitzplan: boolean
  dekorationen: boolean
  dienstleister: boolean
  hotel: boolean
  catering: boolean
  anzeigeeinstellungen: boolean
}

const DEFAULT_PERMS: Permissions = {
  ablaufplan: true,
  sub_events: false,
  erinnerungen: true,
  sitzplan: true,
  dekorationen: true,
  dienstleister: true,
  hotel: true,
  catering: false,
  anzeigeeinstellungen: false,
}

const PERM_LABELS: { key: keyof Omit<Permissions, 'id' | 'event_id'>; label: string; desc: string }[] = [
  { key: 'ablaufplan',          label: 'Ablaufplan',           desc: 'Zeitplan des Events einsehen' },
  { key: 'sub_events',          label: 'Sub-Events',           desc: 'Teilveranstaltungen einsehen' },
  { key: 'erinnerungen',        label: 'Erinnerungen',         desc: 'Terminbenachrichtigungen erhalten' },
  { key: 'sitzplan',            label: 'Sitzplan',             desc: 'Tischplan und Sitzordnung' },
  { key: 'dekorationen',        label: 'Dekorationen',         desc: 'Deko-Vorschläge einsehen' },
  { key: 'dienstleister',       label: 'Dienstleister',        desc: 'Vendor-Vorschläge und Buchungen' },
  { key: 'hotel',               label: 'Hotel',                desc: 'Hotel-Vorschläge einsehen' },
  { key: 'catering',            label: 'Catering',             desc: 'Menü und Cateringdetails' },
  { key: 'anzeigeeinstellungen',label: 'Anzeigeeinstellungen', desc: 'Darstellung anpassen' },
]

interface BpMember {
  id: string
  user_id: string
  profiles: { id: string; name: string; email: string } | null
}

interface InviteCode {
  id: string
  code: string
  status: string
  expires_at: string | null
  created_at: string
}

interface Props {
  eventId: string
  initialPerms: Permissions | null
  bpMembers: BpMember[]
  existingInvite: InviteCode | null
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: checked ? 'var(--gold)' : 'var(--border2)', cursor: 'pointer',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 4, left: checked ? 22 : 4,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

export default function BerechtigungenClient({ eventId, initialPerms, bpMembers, existingInvite }: Props) {
  const [perms, setPerms] = useState<Permissions>(initialPerms ?? { ...DEFAULT_PERMS })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(existingInvite?.code ?? null)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  async function togglePerm(key: keyof Omit<Permissions, 'id' | 'event_id'>, value: boolean) {
    const updated = { ...perms, [key]: value }
    setPerms(updated)
    setSaving(true)

    if (initialPerms?.id) {
      await supabase.from('brautpaar_permissions').update({ [key]: value }).eq('id', initialPerms.id)
    } else {
      const { data } = await supabase
        .from('brautpaar_permissions')
        .upsert({ ...updated, event_id: eventId }, { onConflict: 'event_id' })
        .select()
        .single()
      if (data) setPerms(data)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function generateInvite() {
    setGeneratingInvite(true)
    const res = await fetch('/api/invite/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, targetRole: 'brautpaar' }),
    })
    const data = await res.json()
    if (data.code) setInviteCode(data.code)
    setGeneratingInvite(false)
  }

  async function copyInvite() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const enabledCount = PERM_LABELS.filter(p => perms[p.key]).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
      {/* Left: Permissions grid */}
      <div>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 28, fontWeight: 600, marginBottom: 6 }}>Berechtigungen</h1>
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Steuere, welche Bereiche das Brautpaar einsehen darf</p>
        </div>

        {saving && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Speichern…</div>
        )}
        {saved && !saving && (
          <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 12 }}>Gespeichert ✓</div>
        )}

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {PERM_LABELS.map(({ key, label, desc }, i) => (
            <div
              key={key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 22px',
                borderBottom: i < PERM_LABELS.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{desc}</div>
              </div>
              <Toggle checked={perms[key]} onChange={v => togglePerm(key, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* Right: BP info + active summary + invite link */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 72 }}>

        {/* BP Members */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 20 }}>
          <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Brautpaar</h3>
          {bpMembers.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>Noch nicht eingeladen</p>
          ) : (
            bpMembers.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gold-pale)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {(m.profiles?.name ?? '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.profiles?.name ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.profiles?.email ?? '—'}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Active permissions summary */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 20 }}>
          <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
            Aktive Zugänge <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400 }}>({enabledCount}/{PERM_LABELS.length})</span>
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PERM_LABELS.map(p => (
              <span key={p.key} style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                background: perms[p.key] ? 'var(--green-pale)' : 'var(--surface2)',
                color: perms[p.key] ? 'var(--green)' : 'var(--text-dim)',
              }}>
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* Invite link */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 20 }}>
          <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Einladungslink</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>Erstelle einen Einladungslink für das Brautpaar (gültig 7 Tage)</p>

          {inviteCode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inviteCode}`}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12, background: 'var(--surface2)', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={copyInvite}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '9px', background: copied ? 'var(--green)' : 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Kopiert!' : 'Kopieren'}
                </button>
                <button
                  onClick={generateInvite}
                  disabled={generatingInvite}
                  title="Neuen Link generieren"
                  style={{ padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <RefreshCw size={14} color="var(--text-dim)" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={generateInvite}
              disabled={generatingInvite}
              style={{ width: '100%', padding: '10px', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: generatingInvite ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}
            >
              {generatingInvite ? 'Erstellen…' : 'Link erstellen'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
