'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Bell, Plus, Trash2, Loader2, AlertTriangle, Mail, Info } from 'lucide-react'

interface TypeMeta { key: string; label: string; desc: string }
interface Recipient {
  id: string; email: string; label: string | null; enabled: boolean
  types: Record<string, boolean> | null; created_at: string | null
}

const C = {
  surface: '#FFFFFF', border: '#E2E4E8', line: '#EEF1F6',
  text: '#1A1D21', text2: '#5A6068', text3: '#9AA0A8',
  accent: '#2563EB', green: '#15803D', red: '#B91C1C', redPale: '#FEF2F2',
}

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: C.text }
const btnPrimary: React.CSSProperties = { ...btn, background: C.text, color: '#fff', border: 'none' }
const input: React.CSSProperties = { height: 40, padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.text, boxSizing: 'border-box' }

function Toggle({ checked, onChange, disabled, small }: { checked: boolean; onChange: () => void; disabled?: boolean; small?: boolean }) {
  const w = small ? 38 : 44, h = small ? 22 : 26, k = small ? 18 : 22
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange}
      style={{ width: w, height: h, borderRadius: h, border: 'none', padding: 0, flexShrink: 0, position: 'relative', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, background: checked ? C.green : '#CBD3E0', transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? w - k - 2 : 2, width: k, height: k, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .15s' }} />
    </button>
  )
}

export default function AdminNotificationsSection() {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [types, setTypes] = useState<TypeMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/notifications/recipients')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Laden fehlgeschlagen')
      setRecipients(json.recipients ?? [])
      setTypes(json.types ?? [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function addRecipient() {
    if (!newEmail.trim()) return
    setAdding(true); setError('')
    try {
      const res = await fetch('/api/admin/notifications/recipients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), label: newLabel.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Anlegen fehlgeschlagen')
      setRecipients(rs => [...rs, json.recipient])
      setNewEmail(''); setNewLabel('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen') }
    finally { setAdding(false) }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    // Optimistisch aktualisieren.
    setRecipients(rs => rs.map(r => {
      if (r.id !== id) return r
      if (typeof body.enabled === 'boolean') return { ...r, enabled: body.enabled }
      if (typeof body.type === 'string' && typeof body.value === 'boolean') return { ...r, types: { ...(r.types ?? {}), [body.type]: body.value } }
      return r
    }))
    const res = await fetch(`/api/admin/notifications/recipients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
    if (!res || !res.ok) load() // bei Fehler neu laden (rollback)
  }

  async function remove(r: Recipient) {
    if (!confirm(`Empfänger „${r.email}" entfernen?`)) return
    setRecipients(rs => rs.filter(x => x.id !== r.id))
    await fetch(`/api/admin/notifications/recipients/${r.id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div style={{ padding: 'clamp(18px, 4vw, 28px) clamp(14px, 4vw, 24px) 64px', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: '#EFF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, flexShrink: 0 }}><Bell size={20} /></span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: C.text }}>Benachrichtigungen</h1>
            <p style={{ fontSize: 13.5, color: C.text2, margin: '2px 0 0' }}>Wer bekommt bei welchem Ereignis eine E-Mail?</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#F7FAFF', border: `1px solid #DCE7FB`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: C.text2, margin: '16px 0 20px' }}>
          <Info size={15} style={{ color: C.accent, flexShrink: 0, marginTop: 1 }} />
          <span>Aktiviere pro Adresse gezielt einzelne Benachrichtigungstypen. Der Schalter <strong>Aktiv</strong> pausiert eine Adresse komplett, ohne die Auswahl zu verlieren.</span>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.redPale, border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 16 }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        {/* Empfänger hinzufügen */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Mail size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.text3 }} />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addRecipient() }}
              placeholder="E-Mail-Adresse" style={{ ...input, width: '100%', paddingLeft: 34 }} type="email" />
          </div>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addRecipient() }}
            placeholder="Bezeichnung (optional)" style={{ ...input, flex: '1 1 160px', minWidth: 140 }} />
          <button style={btnPrimary} onClick={addRecipient} disabled={adding || !newEmail.trim()}>
            {adding ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={15} />} Hinzufügen
          </button>
        </div>

        {/* Matrix */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: C.text3 }} /></div>
          ) : recipients.length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', fontSize: 13.5, color: C.text3, margin: 0 }}>Noch keine Empfänger hinterlegt.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text3, borderBottom: `1px solid ${C.border}`, position: 'sticky', left: 0, background: C.surface }}>Empfänger</th>
                    {types.map(t => (
                      <th key={t.key} title={t.desc} style={{ textAlign: 'center', padding: '12px 10px', fontSize: 11, fontWeight: 700, color: C.text2, borderBottom: `1px solid ${C.border}`, minWidth: 96, whiteSpace: 'normal', lineHeight: 1.25 }}>{t.label}</th>
                    ))}
                    <th style={{ textAlign: 'center', padding: '12px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text3, borderBottom: `1px solid ${C.border}` }}>Aktiv</th>
                    <th style={{ borderBottom: `1px solid ${C.border}` }} />
                  </tr>
                </thead>
                <tbody>
                  {recipients.map(r => (
                    <tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.55 }}>
                      <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.line}`, position: 'sticky', left: 0, background: C.surface }}>
                        <div style={{ fontWeight: 600, color: C.text, wordBreak: 'break-word' }}>{r.email}</div>
                        {r.label && <div style={{ fontSize: 12, color: C.text3 }}>{r.label}</div>}
                      </td>
                      {types.map(t => (
                        <td key={t.key} style={{ padding: '12px 10px', borderBottom: `1px solid ${C.line}`, textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Toggle small checked={!!r.types?.[t.key]} disabled={!r.enabled} onChange={() => patch(r.id, { type: t.key, value: !r.types?.[t.key] })} />
                          </div>
                        </td>
                      ))}
                      <td style={{ padding: '12px 12px', borderBottom: `1px solid ${C.line}`, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <Toggle checked={r.enabled} onChange={() => patch(r.id, { enabled: !r.enabled })} />
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px', borderBottom: `1px solid ${C.line}`, textAlign: 'right' }}>
                        <button onClick={() => remove(r)} title="Empfänger entfernen" style={{ ...btn, padding: 8, color: C.red, borderColor: '#FCA5A5' }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
