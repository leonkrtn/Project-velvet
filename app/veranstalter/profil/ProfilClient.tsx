'use client'
import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Camera, User, Mail, Lock, Check, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  userId: string
  initialName: string
  initialEmail: string
  initialAvatarUrl: string | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function ProfilClient({ userId: _userId, initialName, initialEmail, initialAvatarUrl }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('from') ?? '/veranstalter'

  const [name, setName] = useState(initialName)
  const [nameStatus, setNameStatus] = useState<SaveStatus>('idle')

  const [email, setEmail] = useState(initialEmail)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const nameInitialRef = useRef(initialName)

  // ── Autosave name (1.5 s debounce) ──────────────────────────────────────
  useEffect(() => {
    if (name === nameInitialRef.current) return
    setNameStatus('saving')
    const timer = setTimeout(async () => {
      const res = await fetch('/api/veranstalter/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        nameInitialRef.current = name
        setNameStatus('saved')
        setTimeout(() => setNameStatus('idle'), 2500)
      } else {
        setNameStatus('error')
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [name])

  // ── Email ────────────────────────────────────────────────────────────────
  async function saveEmail() {
    if (!email.trim() || emailSaving) return
    setEmailSaving(true)
    setEmailError(null)
    const res = await fetch('/api/veranstalter/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    setEmailSaving(false)
    if (res.ok) {
      setEmailSuccess(true)
      setTimeout(() => setEmailSuccess(false), 3000)
    } else {
      const data = await res.json()
      setEmailError(data.error ?? 'E-Mail konnte nicht geändert werden.')
    }
  }

  // ── Password ─────────────────────────────────────────────────────────────
  async function savePassword() {
    if (!password || passwordSaving) return
    if (password !== passwordConfirm) { setPasswordError('Passwörter stimmen nicht überein.'); return }
    if (password.length < 8) { setPasswordError('Passwort muss mindestens 8 Zeichen haben.'); return }
    setPasswordSaving(true)
    setPasswordError(null)
    const res = await fetch('/api/veranstalter/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setPasswordSaving(false)
    if (res.ok) {
      setPassword('')
      setPasswordConfirm('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } else {
      const data = await res.json()
      setPasswordError(data.error ?? 'Passwort konnte nicht geändert werden.')
    }
  }

  // ── Avatar upload via R2 ─────────────────────────────────────────────────
  async function uploadAvatar(file: File) {
    if (!file.type.startsWith('image/')) { setAvatarError('Nur Bilddateien erlaubt.'); return }
    setAvatarSaving(true)
    setAvatarError(null)

    const uploadRes = await fetch('/api/veranstalter/profile/request-avatar-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: file.type }),
    })
    if (!uploadRes.ok) { setAvatarSaving(false); setAvatarError('Upload konnte nicht gestartet werden.'); return }

    const { uploadUrl, key } = await uploadRes.json() as { uploadUrl: string; key: string }

    const putRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    if (!putRes.ok) { setAvatarSaving(false); setAvatarError('Datei konnte nicht hochgeladen werden.'); return }

    const saveRes = await fetch('/api/veranstalter/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_r2_key: key }),
    })
    setAvatarSaving(false)
    if (!saveRes.ok) { setAvatarError('Profilbild konnte nicht gespeichert werden.'); return }

    router.refresh()
  }

  function initials(n: string) {
    return n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button
          onClick={() => router.push(returnTo)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontFamily: 'inherit' }}
        >
          <ChevronLeft size={15} />
          Zurück
        </button>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          Profil verwalten
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 560, width: '100%', margin: '0 auto', padding: '32px 24px 64px', boxSizing: 'border-box' }}>

        {/* Avatar card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', background: avatarUrl ? 'transparent' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {avatarUrl
                ? <Image src={avatarUrl} alt="Avatar" fill style={{ objectFit: 'cover' }} unoptimized />
                : <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{name ? initials(name) : <User size={32} color="#fff" />}</span>
              }
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarSaving}
              title="Foto ändern"
              style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {avatarSaving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={13} color="var(--text-secondary)" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{name || '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{initialEmail}</div>
            <button onClick={() => fileRef.current?.click()} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              Profilbild ändern
            </button>
            {avatarError && <div style={{ fontSize: 12, color: '#C62828', marginTop: 4 }}>{avatarError}</div>}
          </div>
        </div>

        {/* Name — autosave */}
        <FormCard icon={<User size={16} />} title="Name" statusEl={<AutosaveStatus status={nameStatus} />}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Vollständiger Name"
            style={inputStyle}
          />
        </FormCard>

        {/* Email */}
        <FormCard icon={<Mail size={16} />} title="E-Mail-Adresse">
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 10px' }}>
            Nach der Änderung erhältst du eine Bestätigungsmail an die neue Adresse.
          </p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEmail()} placeholder="neue@email.de" style={inputStyle} />
          {emailError && <ErrorMsg msg={emailError} />}
          <ActionRow>
            <SaveButton onClick={saveEmail} saving={emailSaving} success={emailSuccess} label="E-Mail ändern" />
          </ActionRow>
        </FormCard>

        {/* Password */}
        <FormCard icon={<Lock size={16} />} title="Passwort ändern">
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setPasswordError(null) }} placeholder="Neues Passwort (min. 8 Zeichen)" style={{ ...inputStyle, marginBottom: 8 }} />
          <input type="password" value={passwordConfirm} onChange={e => { setPasswordConfirm(e.target.value); setPasswordError(null) }} onKeyDown={e => e.key === 'Enter' && savePassword()} placeholder="Passwort bestätigen" style={inputStyle} />
          {passwordError && <ErrorMsg msg={passwordError} />}
          <ActionRow>
            <SaveButton onClick={savePassword} saving={passwordSaving} success={passwordSuccess} label="Passwort ändern" />
          </ActionRow>
        </FormCard>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 14, outline: 'none', fontFamily: 'inherit',
  background: 'var(--bg)', color: 'var(--text-primary)',
  boxSizing: 'border-box', marginBottom: 0,
}

function FormCard({ icon, title, statusEl, children }: { icon: React.ReactNode; title: string; statusEl?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{title}</span>
        {statusEl}
      </div>
      {children}
    </div>
  )
}

function AutosaveStatus({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null
  if (status === 'saving') return (
    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
      Speichert…
    </span>
  )
  if (status === 'saved') return (
    <span style={{ fontSize: 12, color: '#2E7D32', display: 'flex', alignItems: 'center', gap: 4 }}>
      <Check size={12} />
      Gespeichert
    </span>
  )
  return <span style={{ fontSize: 12, color: '#C62828' }}>Fehler beim Speichern</span>
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>{children}</div>
}

function SaveButton({ onClick, saving, success, label = 'Speichern' }: { onClick: () => void; saving: boolean; success: boolean; label?: string }) {
  return (
    <>
      <button
        onClick={onClick}
        disabled={saving}
        style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
        {label}
      </button>
      {success && (
        <span style={{ fontSize: 13, color: '#2E7D32', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Check size={14} /> Gespeichert
        </span>
      )}
    </>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#FFF0F0', border: '1px solid #FFCDD2', color: '#C62828', fontSize: 12, marginBottom: 10 }}>
      <AlertCircle size={13} style={{ flexShrink: 0 }} />
      {msg}
    </div>
  )
}
