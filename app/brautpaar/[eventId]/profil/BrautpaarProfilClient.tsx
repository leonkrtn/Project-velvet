'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  User, Mail, Lock, LogOut, HelpCircle, Settings, AlertTriangle,
  Check, Loader2, Trash2, X,
} from 'lucide-react'
import { performLogout } from '@/lib/logout'
import { TOUR_START_EVENT } from '@/components/tour/ProductTour'
import { ACCOUNT_DELETE_GRACE_DAYS } from '@/lib/account/delete-grace'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function BrautpaarProfilClient({ eventId, initialName, initialEmail }: { eventId: string; initialName: string; initialEmail: string }) {
  const [name, setName] = useState(initialName)
  const [nameState, setNameState] = useState<SaveState>('idle')

  const [email, setEmail] = useState(initialEmail)
  const [emailState, setEmailState] = useState<SaveState>('idle')
  const [emailError, setEmailError] = useState('')

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordState, setPasswordState] = useState<SaveState>('idle')
  const [passwordError, setPasswordError] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function patchProfile(body: Record<string, string>) {
    return fetch('/api/veranstalter/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
  }

  async function saveName() {
    if (!name.trim()) return
    setNameState('saving')
    const res = await patchProfile({ name: name.trim() })
    if (res.ok) { setNameState('saved'); setTimeout(() => setNameState('idle'), 1800) }
    else setNameState('error')
  }

  async function saveEmail() {
    if (!email.trim()) return
    setEmailState('saving'); setEmailError('')
    const res = await patchProfile({ email: email.trim() })
    if (res.ok) { setEmailState('saved'); setTimeout(() => setEmailState('idle'), 2400) }
    else { const d = await res.json().catch(() => ({})); setEmailError(d.error ?? 'E-Mail konnte nicht geändert werden.'); setEmailState('error') }
  }

  async function savePassword() {
    if (!password) return
    if (password !== passwordConfirm) { setPasswordError('Passwörter stimmen nicht überein.'); return }
    if (password.length < 8) { setPasswordError('Passwort muss mindestens 8 Zeichen haben.'); return }
    setPasswordState('saving'); setPasswordError('')
    const res = await patchProfile({ password })
    if (res.ok) {
      setPassword(''); setPasswordConfirm('')
      setPasswordState('saved'); setTimeout(() => setPasswordState('idle'), 2400)
    } else {
      const d = await res.json().catch(() => ({})); setPasswordError(d.error ?? 'Passwort konnte nicht geändert werden.'); setPasswordState('error')
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    const res = await fetch('/api/account/delete', { method: 'POST' })
    if (res.ok) { await performLogout('/login'); return }
    setDeleting(false)
  }

  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <h1 className="bp-page-title">Profil</h1>
        <p className="bp-page-subtitle">Dein persönliches Konto — Kontaktdaten, Passwort, Hilfe und mehr.</p>
      </div>

      {/* Account-Infos */}
      <div className="bp-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h2 className="bp-section-title" style={{ margin: '0 0 14px' }}>Account-Infos</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}><User size={13} /> Name</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="bp-input" style={{ flex: 1 }} value={name} onChange={e => setName(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()} />
            {nameState === 'saving' && <Loader2 size={16} className="bpp-spin" style={{ color: 'var(--bp-ink-3)', alignSelf: 'center' }} />}
            {nameState === 'saved' && <Check size={16} style={{ color: '#2f8f5b', alignSelf: 'center' }} />}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}><Mail size={13} /> E-Mail-Adresse</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="email" className="bp-input" style={{ flex: 1 }} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEmail()} />
            <button onClick={saveEmail} disabled={emailState === 'saving'} className="bp-btn" style={{ flexShrink: 0 }}>
              {emailState === 'saving' ? <Loader2 size={14} className="bpp-spin" /> : emailState === 'saved' ? <Check size={14} style={{ color: '#2f8f5b' }} /> : null}
              Ändern
            </button>
          </div>
          {emailError && <p style={errorStyle}>{emailError}</p>}
        </div>

        <div>
          <label style={labelStyle}><Lock size={13} /> Passwort ändern</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="password" className="bp-input" placeholder="Neues Passwort (min. 8 Zeichen)" value={password} onChange={e => { setPassword(e.target.value); setPasswordError('') }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" className="bp-input" style={{ flex: 1 }} placeholder="Passwort bestätigen" value={passwordConfirm} onChange={e => { setPasswordConfirm(e.target.value); setPasswordError('') }} onKeyDown={e => e.key === 'Enter' && savePassword()} />
              <button onClick={savePassword} disabled={passwordState === 'saving'} className="bp-btn" style={{ flexShrink: 0 }}>
                {passwordState === 'saving' ? <Loader2 size={14} className="bpp-spin" /> : passwordState === 'saved' ? <Check size={14} style={{ color: '#2f8f5b' }} /> : null}
                Ändern
              </button>
            </div>
          </div>
          {passwordError && <p style={errorStyle}>{passwordError}</p>}
        </div>
      </div>

      {/* Kurzlinks */}
      <div className="bp-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h2 className="bp-section-title" style={{ margin: '0 0 10px' }}>Weiteres</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href={`/brautpaar/${eventId}/einstellungen`} style={rowLinkStyle}>
            <Settings size={16} style={{ color: 'var(--bp-ink-3)' }} /> Einstellungen
          </Link>
          <button
            onClick={() => window.dispatchEvent(new Event(TOUR_START_EVENT))}
            style={{ ...rowLinkStyle, border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <HelpCircle size={16} style={{ color: 'var(--bp-ink-3)' }} /> Hilfe-Tour starten
          </button>
          <button
            onClick={() => performLogout()}
            style={{ ...rowLinkStyle, border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <LogOut size={16} style={{ color: 'var(--bp-ink-3)' }} /> Abmelden
          </button>
        </div>
      </div>

      {/* Gefahrenzone */}
      <div className="bp-card" style={{ padding: '1.25rem', border: '1px solid rgba(197,34,31,0.25)' }}>
        <h2 className="bp-section-title" style={{ margin: '0 0 6px', color: '#C5221F' }}>Account löschen</h2>
        <p className="bp-caption" style={{ margin: '0 0 14px' }}>
          Dein Account wird sofort deaktiviert. Meldest du dich innerhalb von {ACCOUNT_DELETE_GRACE_DAYS} Tagen erneut an, wird er automatisch
          wiederhergestellt. Danach wird er inklusive aller Daten endgültig gelöscht — auch aus dem CRM aller Dienstleister, bei denen du hinterlegt bist.
        </p>
        <button onClick={() => setDeleteOpen(true)} className="bp-btn" style={{ color: '#C5221F', borderColor: 'rgba(197,34,31,0.3)' }}>
          <Trash2 size={14} /> Account löschen
        </button>
      </div>

      {deleteOpen && (
        <div onClick={() => !deleting && setDeleteOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <AlertTriangle size={19} style={{ color: '#C5221F', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Account wirklich löschen?</h3>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--bp-ink-2)', lineHeight: 1.55 }}>
              Du wirst sofort ausgeloggt. Innerhalb von {ACCOUNT_DELETE_GRACE_DAYS} Tagen kannst du dich einfach wieder anmelden, um den Account
              wiederherzustellen — danach ist die Löschung endgültig.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteOpen(false)} disabled={deleting} className="bp-btn"><X size={14} /> Abbrechen</button>
              <button onClick={confirmDelete} disabled={deleting} className="bp-btn" style={{ background: '#C5221F', color: '#fff', border: 'none' }}>
                {deleting ? <Loader2 size={14} className="bpp-spin" /> : <Trash2 size={14} />} Ja, löschen
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.bpp-spin{animation:bppspin 1s linear infinite}@keyframes bppspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--bp-ink-3)', marginBottom: 6 }
const errorStyle: React.CSSProperties = { fontSize: 12, color: '#C5221F', margin: '6px 0 0' }
const rowLinkStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 4px', borderRadius: 8, textDecoration: 'none',
  fontSize: 14, color: 'var(--bp-ink)',
}
