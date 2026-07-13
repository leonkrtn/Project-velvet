'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  User, Mail, Lock, LogOut, HelpCircle, ExternalLink, AlertTriangle,
  Check, Loader2, Trash2, X,
} from 'lucide-react'
import { performLogout } from '@/lib/logout'
import { VENDOR_TOUR_START_EVENT } from '@/lib/tour/vendor-tour-steps'
import { ACCOUNT_DELETE_GRACE_DAYS } from '@/lib/account/delete-grace'

const C = {
  bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)',
  text: 'var(--text-primary)', dim: 'var(--text-secondary)', accent: 'var(--accent)',
  red: '#C5221F',
}
const inp: React.CSSProperties = { height: 38, padding: '0 12px', fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: C.text, width: '100%' }
const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 16 }

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function VendorProfilClient({ initialName, initialEmail }: { initialName: string; initialEmail: string }) {
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
    const res = await fetch('/api/veranstalter/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return res
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
    <div className="vnd-page-outer" style={{ background: C.bg, flex: 1, minHeight: '100dvh', padding: '28px 24px 48px', overflow: 'auto', boxSizing: 'border-box' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={20} style={{ color: C.accent }} />
        </div>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Profil</h1>
          <p style={{ fontSize: 13.5, color: C.dim, marginTop: 2 }}>Dein persönliches Konto — Kontaktdaten, Passwort, Hilfe und mehr.</p>
        </div>
      </div>

      {/* Account-Infos */}
      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Account-Infos</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.dim, marginBottom: 6 }}><User size={13} /> Name</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()} />
            {nameState === 'saving' && <Loader2 size={16} className="vp-spin" style={{ color: C.dim, flexShrink: 0, alignSelf: 'center' }} />}
            {nameState === 'saved' && <Check size={16} style={{ color: '#1E7E34', flexShrink: 0, alignSelf: 'center' }} />}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.dim, marginBottom: 6 }}><Mail size={13} /> E-Mail-Adresse</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="email" style={inp} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEmail()} />
            <button onClick={saveEmail} disabled={emailState === 'saving'} style={{ ...btnGhost, flexShrink: 0 }}>
              {emailState === 'saving' ? <Loader2 size={14} className="vp-spin" /> : emailState === 'saved' ? <Check size={14} style={{ color: '#1E7E34' }} /> : null}
              Ändern
            </button>
          </div>
          {emailError && <p style={{ fontSize: 12, color: C.red, margin: '6px 0 0' }}>{emailError}</p>}
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.dim, marginBottom: 6 }}><Lock size={13} /> Passwort ändern</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="password" style={inp} placeholder="Neues Passwort (min. 8 Zeichen)" value={password} onChange={e => { setPassword(e.target.value); setPasswordError('') }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" style={inp} placeholder="Passwort bestätigen" value={passwordConfirm} onChange={e => { setPasswordConfirm(e.target.value); setPasswordError('') }} onKeyDown={e => e.key === 'Enter' && savePassword()} />
              <button onClick={savePassword} disabled={passwordState === 'saving'} style={{ ...btnGhost, flexShrink: 0 }}>
                {passwordState === 'saving' ? <Loader2 size={14} className="vp-spin" /> : passwordState === 'saved' ? <Check size={14} style={{ color: '#1E7E34' }} /> : null}
                Ändern
              </button>
            </div>
          </div>
          {passwordError && <p style={{ fontSize: 12, color: C.red, margin: '6px 0 0' }}>{passwordError}</p>}
        </div>
      </div>

      {/* Kurzlinks */}
      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Weiteres</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link href="/vendor/listing" style={rowLinkStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><ExternalLink size={16} style={{ color: C.dim }} /> Anbieter-Profil (Marktplatz-Auftritt)</span>
          </Link>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(VENDOR_TOUR_START_EVENT, { detail: {} }))}
            style={{ ...rowLinkStyle, border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><HelpCircle size={16} style={{ color: C.dim }} /> Hilfe-Tour starten</span>
          </button>
          <button
            onClick={() => performLogout()}
            style={{ ...rowLinkStyle, border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><LogOut size={16} style={{ color: C.dim }} /> Abmelden</span>
          </button>
        </div>
      </div>

      {/* Gefahrenzone */}
      <div style={{ ...card, border: '1px solid rgba(197,34,31,0.25)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: C.red }}>Account löschen</h2>
        <p style={{ fontSize: 13, color: C.dim, margin: '0 0 14px', lineHeight: 1.5 }}>
          Dein Account wird sofort deaktiviert. Meldest du dich innerhalb von {ACCOUNT_DELETE_GRACE_DAYS} Tagen erneut an, wird er automatisch
          wiederhergestellt. Danach wird er inklusive aller Daten endgültig gelöscht — auch aus dem CRM aller Dienstleister, bei denen du hinterlegt bist.
        </p>
        <button onClick={() => setDeleteOpen(true)} style={{ ...btnGhost, color: C.red, borderColor: 'rgba(197,34,31,0.3)' }}>
          <Trash2 size={14} /> Account löschen
        </button>
      </div>

      {deleteOpen && (
        <div onClick={() => !deleting && setDeleteOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <AlertTriangle size={19} style={{ color: C.red, flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Account wirklich löschen?</h3>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: 13.5, color: C.dim, lineHeight: 1.55 }}>
              Du wirst sofort ausgeloggt. Innerhalb von {ACCOUNT_DELETE_GRACE_DAYS} Tagen kannst du dich einfach wieder anmelden, um den Account
              wiederherzustellen — danach ist die Löschung endgültig.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteOpen(false)} disabled={deleting} style={btnGhost}><X size={14} /> Abbrechen</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ ...btnGhost, background: C.red, color: '#fff', border: 'none' }}>
                {deleting ? <Loader2 size={14} className="vp-spin" /> : <Trash2 size={14} />} Ja, löschen
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.vp-spin{animation:vpspin 1s linear infinite}@keyframes vpspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  border: `1px solid ${C.border}`, background: '#fff', color: C.text,
}

const rowLinkStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 4px', borderRadius: 8, textDecoration: 'none',
  fontSize: 14, color: C.text,
}
