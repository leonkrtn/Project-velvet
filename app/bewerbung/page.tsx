'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'

const IS: React.CSSProperties = {
  padding: '10px 13px', background: '#FFFFFF', border: '1px solid var(--border)',
  borderRadius: 10, fontSize: 14, color: 'var(--text)', outline: 'none',
  fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
}

function Lbl({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 5 }}>
      {children}{req && <span style={{ color: 'var(--gold)', marginLeft: 2 }}>*</span>}
    </p>
  )
}

function Field({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 18 }}>{children}</div>
}

export default function BewerbungPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contactName || !form.email) {
      setError('Ansprechpartner und E-Mail sind Pflichtfelder.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createBrowserSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload: Record<string, string | null> = {
      contact_name: form.contactName,
      email: form.email,
      company_name: form.companyName || null,
      phone: form.phone || null,
      website: form.website || null,
      description: form.description || null,
      status: 'pending',
    }
    if (user) payload.user_id = user.id

    const { error: err } = await supabase.from('organizer_applications').insert(payload)
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>✓</div>
          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            Bewerbung eingegangen
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 28 }}>
            Vielen Dank für Ihr Interesse. Wir prüfen Ihre Bewerbung und melden uns in Kürze per E-Mail.
          </p>
          <button
            onClick={() => router.push('/login')}
            style={{
              padding: '12px 28px', background: 'var(--gold)', color: '#fff', border: 'none',
              borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Zum Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '32px 16px 60px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            Veranstalter werden
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Bewerben Sie sich, um Events auf Velvet zu erstellen und zu verwalten.
          </p>
        </div>

        <form onSubmit={submit}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 22, marginBottom: 20 }}>
            <Field>
              <Lbl req>Ansprechpartner</Lbl>
              <input style={IS} placeholder="Vollständiger Name" value={form.contactName} onChange={set('contactName')} />
            </Field>
            <Field>
              <Lbl req>E-Mail-Adresse</Lbl>
              <input style={IS} type="email" placeholder="email@beispiel.de" value={form.email} onChange={set('email')} />
            </Field>
            <Field>
              <Lbl>Firmenname</Lbl>
              <input style={IS} placeholder="Optional" value={form.companyName} onChange={set('companyName')} />
            </Field>
            <Field>
              <Lbl>Telefon</Lbl>
              <input style={IS} type="tel" placeholder="+49 ..." value={form.phone} onChange={set('phone')} />
            </Field>
            <Field>
              <Lbl>Website</Lbl>
              <input style={IS} placeholder="https://..." value={form.website} onChange={set('website')} />
            </Field>
            <Field>
              <Lbl>Kurzbeschreibung</Lbl>
              <textarea
                style={{ ...IS, minHeight: 100, resize: 'vertical' }}
                placeholder="Was macht Ihr Unternehmen aus? Welche Art von Events planen Sie?"
                value={form.description}
                onChange={set('description')}
              />
            </Field>
          </div>

          {error && (
            <div style={{ background: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#c62828' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', background: loading ? 'var(--text-dim)' : 'var(--gold)',
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            }}
          >
            {loading ? 'Wird gesendet…' : 'Bewerbung einreichen'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', marginTop: 16 }}>
            Bereits ein Konto?{' '}
            <button
              type="button"
              onClick={() => router.push('/login')}
              style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            >
              Zum Login
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
