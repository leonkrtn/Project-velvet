'use client'

// Admin-Sektion: Influencer-/Promo-Codes anlegen, verwalten und Statistik sehen.
import React, { useCallback, useEffect, useState } from 'react'
import { Tag, Loader2, RefreshCw, AlertCircle, Plus, Trash2, TrendingUp } from 'lucide-react'

interface CodeRow {
  id: string
  code: string
  label: string | null
  type: 'percent' | 'free_months'
  percent_off: number | null
  duration: 'first_month' | 'forever' | null
  free_months: number | null
  applies_to: 'all' | 'basis' | 'pro'
  max_redemptions: number | null
  valid_until: string | null
  active: boolean
  redemptions: number
  conversions: number
  conversionRate: number
  discountSum: number
  revenue: number
}

interface HistoryRow {
  id: string
  code: string
  eventName: string
  type: string
  plan: string | null
  percentOff: number | null
  freeMonths: number | null
  discountEur: number
  converted: boolean
  createdAt: string
}

const C = {
  border: '#E2E4E8', text: '#1A1D21', text2: '#5A6068', text3: '#9AA0A8',
  red: '#B91C1C', green: '#15803D', amber: '#B45309', accent: '#2563EB',
}

function fmt(iso: string | null) {
  if (!iso) return '∞'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}
function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

const APPLIES_LABEL: Record<string, string> = { all: 'Beide', basis: 'Forevr', pro: 'Forevr Pro' }

export default function PromoCodesSection({
  card, cardHeader, btnSecondary, btnPrimary, inputStyle, labelStyle,
}: {
  card: React.CSSProperties
  cardHeader: React.CSSProperties
  btnSecondary: React.CSSProperties
  btnPrimary: React.CSSProperties
  inputStyle: React.CSSProperties
  labelStyle: React.CSSProperties
}) {
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // Anlegen-Formular
  const [showCreate, setShowCreate] = useState(false)
  const [fCode, setFCode] = useState('')
  const [fLabel, setFLabel] = useState('')
  const [fType, setFType] = useState<'percent' | 'free_months'>('percent')
  const [fPercent, setFPercent] = useState('20')
  const [fDuration, setFDuration] = useState<'first_month' | 'forever'>('first_month')
  const [fMonths, setFMonths] = useState('1')
  const [fApplies, setFApplies] = useState<'all' | 'basis' | 'pro'>('all')
  const [fMax, setFMax] = useState('')
  const [fValid, setFValid] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/promo-codes')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Laden fehlgeschlagen')
      setCodes(data.codes)
      setHistory(data.history)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setCreateError('')
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: fCode, label: fLabel, type: fType,
          percentOff: Number(fPercent), duration: fDuration,
          freeMonths: Number(fMonths), appliesTo: fApplies,
          maxRedemptions: fMax ? Number(fMax) : null,
          validUntil: fValid ? new Date(fValid).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Anlegen fehlgeschlagen')
      setFCode(''); setFLabel(''); setFMax(''); setFValid('')
      setShowCreate(false)
      setLoading(true); await load()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(c: CodeRow) {
    setBusyId(c.id)
    try {
      await fetch(`/api/admin/promo-codes/${c.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !c.active }),
      })
      await load()
    } finally { setBusyId(null) }
  }

  async function remove(c: CodeRow) {
    if (!confirm(`Code "${c.code}" wirklich löschen? Alle Einlösungen gehen mit verloren.`)) return
    setBusyId(c.id)
    try {
      await fetch(`/api/admin/promo-codes/${c.id}`, { method: 'DELETE' })
      await load()
    } finally { setBusyId(null) }
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '9px 14px', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '10px 14px', color: C.text2, whiteSpace: 'nowrap' }

  // Totals
  const tot = codes.reduce((a, c) => ({
    red: a.red + c.redemptions, conv: a.conv + c.conversions,
    disc: a.disc + c.discountSum, rev: a.rev + c.revenue,
  }), { red: 0, conv: 0, disc: 0, rev: 0 })

  const benefit = (c: CodeRow) =>
    c.type === 'percent'
      ? `${c.percent_off}% · ${c.duration === 'forever' ? 'dauerhaft' : '1. Monat'}`
      : `${c.free_months} Gratismonat${c.free_months === 1 ? '' : 'e'}`

  return (
    <section style={card}>
      <div style={cardHeader}>
        <Tag size={16} style={{ color: C.text2 }} />
        Promo-Codes (Influencer)
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowCreate(v => !v)} style={{ ...btnPrimary, padding: '6px 12px' }}>
            <Plus size={14} /> Code anlegen
          </button>
          <button onClick={() => { setLoading(true); void load() }} style={{ ...btnSecondary, padding: '5px 10px' }}>
            <RefreshCw size={13} />
          </button>
        </span>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', color: C.red, fontSize: 13 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Anlegen-Formular */}
      {showCreate && (
        <form onSubmit={create} style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, background: '#FAFBFC' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Code</label>
              <input style={inputStyle} value={fCode} onChange={e => setFCode(e.target.value)} placeholder="z. B. ANNA20" />
            </div>
            <div>
              <label style={labelStyle}>Influencer / Label</label>
              <input style={inputStyle} value={fLabel} onChange={e => setFLabel(e.target.value)} placeholder="Instagram @anna" />
            </div>
            <div>
              <label style={labelStyle}>Typ</label>
              <select style={inputStyle} value={fType} onChange={e => setFType(e.target.value as 'percent' | 'free_months')}>
                <option value="percent">Prozent-Rabatt</option>
                <option value="free_months">Gratismonate</option>
              </select>
            </div>
            {fType === 'percent' ? (
              <>
                <div>
                  <label style={labelStyle}>Rabatt %</label>
                  <input style={inputStyle} value={fPercent} onChange={e => setFPercent(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="20" />
                </div>
                <div>
                  <label style={labelStyle}>Wirkung</label>
                  <select style={inputStyle} value={fDuration} onChange={e => setFDuration(e.target.value as 'first_month' | 'forever')}>
                    <option value="first_month">Nur erster Monat</option>
                    <option value="forever">Dauerhaft</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label style={labelStyle}>Gratismonate</label>
                <input style={inputStyle} value={fMonths} onChange={e => setFMonths(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="1" />
              </div>
            )}
            <div>
              <label style={labelStyle}>Gilt für</label>
              <select style={inputStyle} value={fApplies} onChange={e => setFApplies(e.target.value as 'all' | 'basis' | 'pro')}>
                <option value="all">Beide Tarife</option>
                <option value="basis">Nur Forevr</option>
                <option value="pro">Nur Forevr Pro</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Max. Einlösungen</label>
              <input style={inputStyle} value={fMax} onChange={e => setFMax(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="unbegrenzt" />
            </div>
            <div>
              <label style={labelStyle}>Gültig bis</label>
              <input style={inputStyle} type="date" value={fValid} onChange={e => setFValid(e.target.value)} />
            </div>
          </div>
          {createError && <p style={{ color: C.red, fontSize: 13, margin: '10px 0 0' }}>{createError}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="submit" disabled={creating} style={btnPrimary}>
              {creating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              Anlegen
            </button>
            <button type="button" onClick={() => setShowCreate(false)} style={btnSecondary}>Abbrechen</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text2, fontSize: 14, padding: '24px 18px' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Wird geladen…
        </div>
      ) : codes.length === 0 ? (
        <p style={{ padding: '20px 18px', fontSize: 13.5, color: C.text2, margin: 0 }}>
          Noch keine Codes — legt oben den ersten Influencer-Code an.
        </p>
      ) : (
        <>
          {/* Gesamt-Statistik */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
            <Stat label="Einlösungen" value={String(tot.red)} />
            <Stat label="Conversions" value={`${tot.conv} (${tot.red ? Math.round(tot.conv / tot.red * 100) : 0}%)`} />
            <Stat label="Rabatt gewährt" value={eur(tot.disc)} />
            <Stat label="Umsatz (Codes)" value={eur(tot.rev)} />
          </div>

          {/* Code-Tabelle (nach Conversions sortiert = Influencer-Ranking) */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 920 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['#', 'Code', 'Influencer', 'Vorteil', 'Gilt für', 'Limit', 'Gültig bis', 'Einl.', 'Conv.', 'Rabatt', 'Umsatz', 'Status', ''].map((h, i) => (
                    <th key={i} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.slice().sort((a, b) => b.conversions - a.conversions || b.redemptions - a.redemptions).map((c, i) => {
                  const busy = busyId === c.id
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: busy ? 0.5 : 1 }}>
                      <td style={{ ...td, color: C.text3 }}>{i === 0 ? <TrendingUp size={13} style={{ color: C.green }} /> : i + 1}</td>
                      <td style={{ ...td, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{c.code}</td>
                      <td style={td}>{c.label || '—'}</td>
                      <td style={td}>{benefit(c)}</td>
                      <td style={td}>{APPLIES_LABEL[c.applies_to]}</td>
                      <td style={td}>{c.max_redemptions ?? '∞'}</td>
                      <td style={td}>{fmt(c.valid_until)}</td>
                      <td style={{ ...td, fontWeight: 600, color: C.text }}>{c.redemptions}</td>
                      <td style={td}>{c.conversions} · {c.conversionRate}%</td>
                      <td style={td}>{eur(c.discountSum)}</td>
                      <td style={{ ...td, color: C.green, fontWeight: 600 }}>{eur(c.revenue)}</td>
                      <td style={td}>
                        <button onClick={() => toggleActive(c)} disabled={busy} style={{
                          border: `1px solid ${c.active ? '#86EFAC' : C.border}`, background: c.active ? '#F0FDF4' : '#F4F5F7',
                          color: c.active ? C.green : C.text3, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          {c.active ? 'Aktiv' : 'Inaktiv'}
                        </button>
                      </td>
                      <td style={td}>
                        <button onClick={() => remove(c)} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4, display: 'flex' }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Einlöse-Verlauf */}
          {history.length > 0 && (
            <div style={{ padding: '14px 18px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 8 }}>Letzte Einlösungen</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {history.slice(0, 12).map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: C.text2 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{h.code}</span>
                    <span style={{ color: C.text3 }}>·</span>
                    <span>{h.eventName}</span>
                    <span style={{ color: C.text3 }}>·</span>
                    <span>{h.type === 'percent' ? `${h.percentOff}%` : `${h.freeMonths} Gratismon.`}</span>
                    {h.converted && <span style={{ color: C.green, fontWeight: 600 }}>· bezahlt {h.plan}</span>}
                    <span style={{ marginLeft: 'auto', color: C.text3 }}>{fmt(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9AA0A8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1D21', marginTop: 2 }}>{value}</div>
    </div>
  )
}
