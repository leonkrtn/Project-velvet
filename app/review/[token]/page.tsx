'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Star, Loader2, CheckCircle2 } from 'lucide-react'

export default function ReviewPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ used: boolean; vendor: { name: string; brandColor: string | null }; event: { name: string; date: string | null } } | null>(null)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`/api/reviews/${token}`)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(d.error ?? 'Ungültiger Link'); setLoading(false); return }
    setData(d)
    setLoading(false)
  }, [token])
  useEffect(() => { load() }, [load])

  const accent = data?.vendor.brandColor && /^#[0-9a-fA-F]{6}$/.test(data.vendor.brandColor) ? data.vendor.brandColor : '#B89968'

  async function submit() {
    if (rating < 1) { setErr('Bitte wähle eine Sternebewertung.'); return }
    setBusy(true); setErr('')
    const r = await fetch(`/api/reviews/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, title, body: text, authorName: author }),
    })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? 'Fehler'); return }
    setDone(true)
  }

  const wrap: React.CSSProperties = { minHeight: '100dvh', background: '#f7f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif', color: '#1c1c1c' }
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #ece7df', maxWidth: 480, width: '100%', padding: 28 }

  if (loading) return <div style={wrap}><Loader2 className="rv-spin" /><style>{'.rv-spin{animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}'}</style></div>

  if (err && !data) return <div style={wrap}><div style={card}><p style={{ margin: 0, fontSize: 15 }}>{err}</p></div></div>

  if (done || data?.used) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <CheckCircle2 size={44} style={{ color: accent }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '14px 0 6px' }}>{done ? 'Vielen Dank!' : 'Bereits bewertet'}</h1>
          <p style={{ fontSize: 14, color: '#555', margin: 0 }}>
            {done ? 'Deine Bewertung wurde gespeichert.' : 'Für diese Einladung wurde bereits eine Bewertung abgegeben.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 13, color: '#9a958c', marginBottom: 4 }}>Bewertung</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{data?.vendor.name}</h1>
        <p style={{ fontSize: 13.5, color: '#666', margin: '0 0 20px' }}>Wie war eure Erfahrung? Eure Rückmeldung dauert nur eine Minute.</p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }} aria-label={`${n} Sterne`}>
              <Star size={34} style={{ color: (hover || rating) >= n ? accent : '#d8d2c8' }} fill={(hover || rating) >= n ? accent : 'none'} />
            </button>
          ))}
        </div>

        <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Euer Name (optional)"
          style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #e3ddd2', borderRadius: 9, marginBottom: 10, boxSizing: 'border-box', fontFamily: 'inherit' }} />
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Überschrift (optional)"
          style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #e3ddd2', borderRadius: 9, marginBottom: 10, boxSizing: 'border-box', fontFamily: 'inherit' }} />
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Erzählt von eurer Erfahrung… (optional)"
          style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #e3ddd2', borderRadius: 9, minHeight: 110, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />

        {err && <p style={{ color: '#C5221F', fontSize: 13, margin: '10px 0 0' }}>{err}</p>}

        <button onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 15, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {busy ? <Loader2 size={16} className="rv-spin" /> : null} Bewertung absenden
        </button>
        <style>{'.rv-spin{animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )
}
