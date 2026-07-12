'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { FlaskConical, Send, Loader2, CheckCircle2, XCircle, AlertTriangle, Mail, Info, PlayCircle } from 'lucide-react'

interface Cat { key: string; label: string }
interface TestMail { key: string; category: string; label: string; description: string }
type Result = { status: 'idle' | 'sending' | 'ok' | 'error'; msg?: string }

const C = {
  surface: '#FFFFFF', border: '#E2E4E8', line: '#EEF1F6',
  text: '#1A1D21', text2: '#5A6068', text3: '#9AA0A8',
  accent: '#2563EB', green: '#15803D', greenPale: '#F0FDF4', red: '#B91C1C', redPale: '#FEF2F2',
}
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: C.text, whiteSpace: 'nowrap' }
const btnPrimary: React.CSSProperties = { ...btn, background: C.text, color: '#fff', border: 'none' }
const input: React.CSSProperties = { height: 40, padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.text, boxSizing: 'border-box' }

export default function AdminTestMailSection() {
  const [cats, setCats] = useState<Cat[]>([])
  const [mails, setMails] = useState<TestMail[]>([])
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Record<string, Result>>({})
  const [bulk, setBulk] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [tRes, rRes] = await Promise.all([
        fetch('/api/admin/notifications/test'),
        fetch('/api/admin/notifications/recipients'),
      ])
      const tJson = await tRes.json()
      if (!tRes.ok) throw new Error(tJson.error ?? 'Laden fehlgeschlagen')
      setCats(tJson.categories ?? [])
      setMails(tJson.mails ?? [])
      // Zieladresse mit dem ersten Empfänger (i. d. R. die Admin-Adresse) vorbelegen.
      if (rRes.ok) {
        const rJson = await rRes.json()
        const first = (rJson.recipients ?? [])[0]
        if (first?.email) setTo(first.email)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const validTo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())

  async function sendOne(key: string): Promise<boolean> {
    setResults(r => ({ ...r, [key]: { status: 'sending' } }))
    try {
      const res = await fetch('/api/admin/notifications/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, to: to.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) {
        setResults(r => ({ ...r, [key]: { status: 'error', msg: json.error ?? `Fehler (${res.status})` } }))
        return false
      }
      setResults(r => ({ ...r, [key]: { status: 'ok', msg: 'Gesendet' } }))
      return true
    } catch {
      setResults(r => ({ ...r, [key]: { status: 'error', msg: 'Netzwerkfehler' } })); return false
    }
  }

  async function sendAll() {
    if (!validTo) return
    setBulk(true)
    for (const m of mails) { await sendOne(m.key) }
    setBulk(false)
  }

  const okCount = Object.values(results).filter(r => r.status === 'ok').length
  const errCount = Object.values(results).filter(r => r.status === 'error').length

  return (
    <div style={{ padding: 'clamp(18px, 4vw, 28px) clamp(14px, 4vw, 24px) 64px', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: '#EFF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, flexShrink: 0 }}><FlaskConical size={20} /></span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: C.text }}>Kontrolle</h1>
            <p style={{ fontSize: 13.5, color: C.text2, margin: '2px 0 0' }}>Jede automatische Mail einmal auslösen, um Mailserver &amp; Vorlagen zu prüfen.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#F7FAFF', border: '1px solid #DCE7FB', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: C.text2, margin: '16px 0 20px' }}>
          <Info size={15} style={{ color: C.accent, flexShrink: 0, marginTop: 1 }} />
          <span>Es werden reine <strong>Beispiel-Mails</strong> mit Dummy-Daten versendet — keine echten Datensätze, Tokens oder Chat-Nachrichten. Der Betreff jeder Test-Mail ist mit <strong>[TEST]</strong> markiert.</span>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.redPale, border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 16 }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        {/* Zieladresse + Alle senden */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6 }}>Zieladresse für Test-Mails</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 220 }}>
              <Mail size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.text3 }} />
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="test@beispiel.de" type="email" style={{ ...input, width: '100%', paddingLeft: 34 }} />
            </div>
            <button style={{ ...btnPrimary, opacity: validTo && !bulk ? 1 : 0.5 }} onClick={sendAll} disabled={!validTo || bulk}>
              {bulk ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <PlayCircle size={16} />} Alle senden
            </button>
          </div>
          {!validTo && to.length > 0 && <p style={{ fontSize: 12, color: C.red, margin: '8px 0 0' }}>Bitte eine gültige E-Mail-Adresse eingeben.</p>}
          {(okCount > 0 || errCount > 0) && (
            <p style={{ fontSize: 12.5, color: C.text2, margin: '10px 0 0' }}>
              {okCount > 0 && <span style={{ color: C.green, fontWeight: 600 }}>{okCount} gesendet</span>}
              {okCount > 0 && errCount > 0 && ' · '}
              {errCount > 0 && <span style={{ color: C.red, fontWeight: 600 }}>{errCount} fehlgeschlagen</span>}
            </p>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: C.text3 }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {cats.map(cat => {
              const list = mails.filter(m => m.category === cat.key)
              if (list.length === 0) return null
              return (
                <div key={cat.key}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.text3, marginBottom: 10 }}>{cat.label}</div>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    {list.map((m, i) => {
                      const r = results[m.key] ?? { status: 'idle' as const }
                      return (
                        <div key={m.key} style={{ padding: '12px 16px', borderTop: i > 0 ? `1px solid ${C.line}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', rowGap: 10 }}>
                            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{m.label}</div>
                              <div style={{ fontSize: 12.5, color: C.text3 }}>{m.description}</div>
                            </div>
                            <div style={{ minWidth: 92, textAlign: 'right' }}>
                              {r.status === 'ok' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: C.green }}><CheckCircle2 size={15} /> {r.msg}</span>}
                              {r.status === 'error' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: C.red }}><XCircle size={15} /> Fehler</span>}
                            </div>
                            <button style={{ ...btn, opacity: validTo && r.status !== 'sending' ? 1 : 0.5 }} disabled={!validTo || r.status === 'sending'} onClick={() => sendOne(m.key)}>
                              {r.status === 'sending' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />} Test senden
                            </button>
                          </div>
                          {r.status === 'error' && r.msg && (
                            <div style={{ marginTop: 8, background: C.redPale, border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, color: C.red, wordBreak: 'break-word' }}>
                              {r.msg}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {mails.some(m => results[m.key]?.status === 'error') && (
          <p style={{ fontSize: 12.5, color: C.text3, marginTop: 16, lineHeight: 1.6 }}>
            Häufige Ursachen: <code>RESEND_API_KEY</code> nicht gesetzt · Absender-Domain in Resend nicht verifiziert ·
            Resend-Sandbox (ohne verifizierte Domain sind nur Mails an die eigene Konto-Adresse erlaubt).
          </p>
        )}
      </div>
    </div>
  )
}
