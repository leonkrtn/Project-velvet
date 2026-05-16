'use client'
import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Camera, User, Mail, Lock, Check, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  userId: string
  initialName: string
  initialEmail: string
  initialAvatarUrl: string | null
}

type Section = 'name' | 'email' | 'password' | 'avatar'

export default function ProfilClient({ userId: _userId, initialName, initialEmail, initialAvatarUrl }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [saving, setSaving] = useState<Section | null>(null)
  const [success, setSuccess] = useState<Section | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function showSuccess(section: Section) {
    setSuccess(section)
    setError(null)
    setTimeout(() => setSuccess(null), 3000)
  }

  async function saveName() {
    if (!name.trim() || saving) return
    setSaving('name')
    const res = await fetch('/api/veranstalter/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSaving(null)
    if (res.ok) showSuccess('name')
    else setError('Name konnte nicht gespeichert werden.')
  }

  async function saveEmail() {
    if (!email.trim() || saving) return
    setSaving('email')
    const res = await fetch('/api/veranstalter/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    setSaving(null)
    if (res.ok) showSuccess('email')
    else {
      const data = await res.json()
      setError(data.error ?? 'E-Mail konnte nicht geändert werden.')
    }
  }

  async function savePassword() {
    if (!password || saving) return
    if (password !== passwordConfirm) { setError('Passwörter stimmen nicht überein.'); return }
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    setSaving('password')
    const res = await fetch('/api/veranstalter/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setSaving(null)
    if (res.ok) {
      setPassword('')
      setPasswordConfirm('')
      showSuccess('password')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Passwort konnte nicht geändert werden.')
    }
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith('image/')) { setError('Nur Bilddateien erlaubt.'); return }
    setSaving('avatar')
    setError(null)

    // Step 1: Request presigned PUT URL from Worker via our API
    const uploadRes = await fetch('/api/veranstalter/profile/request-avatar-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: file.type }),
    })
    if (!uploadRes.ok) {
      setSaving(null)
      setError('Upload konnte nicht gestartet werden.')
      return
    }
    const { uploadUrl, key } = await uploadRes.json() as { uploadUrl: string; key: string }

    // Step 2: Upload directly to R2 via presigned PUT URL
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    if (!putRes.ok) {
      setSaving(null)
      setError('Datei konnte nicht hochgeladen werden.')
      return
    }

    // Step 3: Store the R2 key in the DB
    const saveRes = await fetch('/api/veranstalter/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_r2_key: key }),
    })
    setSaving(null)
    if (!saveRes.ok) {
      setError('Profilbild-Schlüssel konnte nicht gespeichert werden.')
      return
    }

    // Step 4: Reload so the server generates a fresh presigned display URL
    showSuccess('avatar')
    router.refresh()
  }

  function initials(n: string) {
    return n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Link
          href="/veranstalter"
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', padding: '4px 8px', borderRadius: 6 }}
        >
          <ChevronLeft size={15} />
          Zurück
        </Link>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          Profil verwalten
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 560, width: '100%', margin: '0 auto', padding: '32px 24px 64px', boxSizing: 'border-box' }}>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 20, background: '#FFF0F0', border: '1px solid #FFCDD2', color: '#C62828' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{error}</span>
          </div>
        )}

        {/* Avatar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: avatarUrl ? 'transparent' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{name ? initials(name) : <User size={32} color="#fff" />}</span>
              }
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={saving === 'avatar'}
              title="Foto ändern"
              style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {saving === 'avatar'
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <Camera size={13} color="var(--text-secondary)" />
              }
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{name || '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{initialEmail}</div>
            <button onClick={() => fileRef.current?.click()} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              Profilbild ändern
            </button>
            {success === 'avatar' && <StatusChip />}
          </div>
        </div>

        {/* Name */}
        <FormCard icon={<User size={16} />} title="Name">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveName()} placeholder="Vollständiger Name" style={inputStyle} />
          <SaveButton onClick={saveName} saving={saving === 'name'} success={success === 'name'} />
        </FormCard>

        {/* Email */}
        <FormCard icon={<Mail size={16} />} title="E-Mail-Adresse">
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 10px' }}>Nach der Änderung erhältst du eine Bestätigungsmail an die neue Adresse.</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEmail()} placeholder="neue@email.de" style={inputStyle} />
          <SaveButton onClick={saveEmail} saving={saving === 'email'} success={success === 'email'} label="E-Mail ändern" />
        </FormCard>

        {/* Password */}
        <FormCard icon={<Lock size={16} />} title="Passwort ändern">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Neues Passwort (min. 8 Zeichen)" style={{ ...inputStyle, marginBottom: 8 }} />
          <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePassword()} placeholder="Passwort bestätigen" style={inputStyle} />
          <SaveButton onClick={savePassword} saving={saving === 'password'} success={success === 'password'} label="Passwort ändern" />
        </FormCard>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 14, outline: 'none', fontFamily: 'inherit',
  background: 'var(--bg)', color: 'var(--text-primary)',
  boxSizing: 'border-box', marginBottom: 12,
}

function FormCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function SaveButton({ onClick, saving, success, label = 'Speichern' }: { onClick: () => void; saving: boolean; success: boolean; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={onClick} disabled={saving} style={{ padding: '9px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
        {label}
      </button>
      {success && <StatusChip />}
    </div>
  )
}

function StatusChip() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#2E7D32' }}>
      <Check size={14} />
      Gespeichert
    </div>
  )
}
