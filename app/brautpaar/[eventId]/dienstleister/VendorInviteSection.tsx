'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, UserPlus } from 'lucide-react'

const DL_CATEGORIES = [
  'Fotograf', 'Videograf', 'Caterer', 'Floristin', 'Band / DJ',
  'Konditorei', 'Hairstylist / Make-up', 'Trauungsredner', 'Location', 'Andere',
]

// Dienstleister-Einladung für Solo-Brautpaare — gleicher Flow wie im
// Veranstalter-Portal (/api/vendor/invite → /vendor/join?code=…).
export default function VendorInviteSection({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [category, setCategory] = useState(DL_CATEGORIES[0])
  const [email, setEmail] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function createInvite() {
    setLoading(true)
    setError(null)
    try {
      const trimmedEmail = email.trim()
      const res = await fetch('/api/vendor/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, category, email: trimmedEmail || undefined }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Einladung konnte nicht erstellt werden')
      setCode(data.code)
      setEmailSent(!!trimmedEmail)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Einladung konnte nicht erstellt werden')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/vendor/join?code=${code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard nicht verfügbar */ }
  }

  return (
    <div className="bp-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <UserPlus size={16} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Dienstleister einladen</span>
      </div>
      <p className="bp-caption" style={{ margin: '0 0 12px' }}>
        Erstellt einen Einladungslink für euren Dienstleister. Nach der Registrierung legt ihr hier fest,
        welche Bereiche eurer Planung er sehen und bearbeiten darf.
      </p>

      {code ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{
            flex: '1 1 200px', padding: '10px 12px', fontSize: 13,
            background: 'var(--bp-ivory, #faf7f2)', border: '1px solid var(--bp-border, #e5ddd0)',
            borderRadius: 8, overflowWrap: 'anywhere',
          }}>
            {`${typeof window !== 'undefined' ? window.location.origin : ''}/vendor/join?code=${code}`}
          </code>
          <button
            type="button"
            className="bp-btn"
            onClick={copyLink}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Kopiert' : 'Link kopieren'}
          </button>
          <button type="button" className="bp-btn" onClick={() => { setCode(null); setEmail(''); setEmailSent(false) }}>
            Weitere Einladung
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{
              flex: '0 1 220px', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
              border: '1px solid var(--bp-border, #e5ddd0)', borderRadius: 8,
              background: '#fff', outline: 'none',
            }}
          >
            {DL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-Mail (optional, sendet den Link direkt)"
            style={{
              flex: '1 1 240px', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
              border: '1px solid var(--bp-border, #e5ddd0)', borderRadius: 8,
              background: '#fff', outline: 'none',
            }}
          />
          <button
            type="button"
            className="bp-btn bp-btn-primary"
            onClick={createInvite}
            disabled={loading}
          >
            {loading ? 'Erstelle Link …' : 'Einladungslink erstellen'}
          </button>
        </div>
      )}
      {emailSent && (
        <p className="bp-caption" style={{ margin: '10px 0 0', opacity: 0.7 }}>
          Die Einladung wurde zusätzlich per E-Mail verschickt.
        </p>
      )}

      {error && (
        <p style={{ fontSize: 13, color: 'var(--bp-red, #a04040)', margin: '10px 0 0' }}>{error}</p>
      )}
      {code && (
        <p className="bp-caption" style={{ margin: '10px 0 0', opacity: 0.7 }}>
          Der Link führt zur Dienstleister-Registrierung und ist nur einmal einlösbar.
        </p>
      )}
    </div>
  )
}
