'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { BarChart2, Download, FileSpreadsheet, FileText, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { ReportData } from '@/lib/vendor/monthly-report'
import { brandAccentVars } from '@/lib/vendor/brand'

// ── Period helpers ─────────────────────────────────────────────────────────────

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function periodLabel(type: 'month' | 'quarter', year: number, value: number) {
  if (type === 'month') return `${MONTHS[value - 1]} ${year}`
  return `Q${value} ${year}`
}

function buildPeriods(type: 'month' | 'quarter') {
  const now = new Date()
  const curYear = now.getFullYear()
  const results: { year: number; value: number; label: string }[] = []
  if (type === 'month') {
    for (let y = curYear; y >= curYear - 2; y--) {
      const maxM = y === curYear ? now.getMonth() + 1 : 12
      for (let m = maxM; m >= 1; m--) {
        results.push({ year: y, value: m, label: periodLabel('month', y, m) })
      }
    }
  } else {
    const curQ = Math.floor(now.getMonth() / 3) + 1
    for (let y = curYear; y >= curYear - 2; y--) {
      const maxQ = y === curYear ? curQ : 4
      for (let q = maxQ; q >= 1; q--) {
        results.push({ year: y, value: q, label: periodLabel('quarter', y, q) })
      }
    }
  }
  return results
}

// ── Formatters ────────────────────────────────────────────────────────────────

function eur(n: number) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
}

function pctDelta(cur: number, base: number): { pct: number; positive: boolean } | null {
  if (base === 0) return null
  const pct = Math.round(((cur - base) / base) * 100)
  return { pct, positive: cur >= base }
}

function DeltaBadge({ cur, base }: { cur: number; base: number }) {
  const d = pctDelta(cur, base)
  if (!d) return <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>
  const color = d.positive ? '#1E7E34' : '#C5221F'
  const bg    = d.positive ? 'rgba(30,126,52,0.10)' : 'rgba(197,34,31,0.08)'
  const Icon  = d.positive ? TrendingUp : d.pct === 0 ? Minus : TrendingDown
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: bg, color, borderRadius: 100, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
      <Icon size={11} />
      {d.positive && d.pct > 0 ? '+' : ''}{d.pct}%
    </span>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'var(--accent)' : 'var(--bg)',
      border: `1px solid ${highlight ? 'transparent' : 'var(--border)'}`,
      borderRadius: 12, padding: '16px 18px',
    }}>
      <p style={{ fontSize: 11, color: highlight ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.8px', color: highlight ? '#fff' : 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: highlight ? 'rgba(255,255,255,0.5)' : 'var(--text-tertiary)' }}>{sub}</p>}
    </div>
  )
}

// ── Comparison Row ────────────────────────────────────────────────────────────

function CompRow({ label, cur, base, format = 'money' }: { label: string; cur: number; base: number; baseLabel: string; format?: 'money' | 'number' | 'percent' }) {
  const fmt = format === 'money' ? eur : format === 'percent' ? (n: number) => `${n}%` : (n: number) => String(Math.round(n))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span className="rpt-comp-cur" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 80, textAlign: 'right' }}>{fmt(cur)}</span>
      <span className="rpt-comp-base" style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 70, textAlign: 'right' }}>{fmt(base)}</span>
      <div className="rpt-comp-delta" style={{ minWidth: 80, textAlign: 'right' }}><DeltaBadge cur={cur} base={base} /></div>
    </div>
  )
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '28px 0 14px', paddingBottom: 8, borderBottom: '2px solid var(--accent)' }}>
      {label}
    </h2>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ w, h }: { w?: string; h?: number }) {
  return <div style={{ width: w ?? '100%', height: h ?? 16, borderRadius: 6, background: 'var(--border2)', animation: 'rpt-pulse 1.5s ease infinite' }} />
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReportClient({ brandColor }: { brandColor?: string | null } = {}) {
  const now = new Date()
  const [type, setType] = useState<'month' | 'quarter'>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [value, setValue] = useState(now.getMonth() + 1)
  const [compareMode, setCompareMode] = useState<'prev' | 'lastyear'>('prev')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  const periods = buildPeriods(type)

  const load = useCallback(async () => {
    setLoading(true)
    setData(null)
    const res = await fetch(`/api/vendor/monthly-report?type=${type}&year=${year}&value=${value}`)
    const d = await res.json().catch(() => null)
    setData(d)
    setLoading(false)
  }, [type, year, value])

  useEffect(() => { load() }, [load])

  async function exportFile(format: 'excel' | 'pdf') {
    setExporting(format)
    const ext = format === 'excel' ? 'excel' : 'pdf'
    const res = await fetch(`/api/vendor/monthly-report/${ext}?type=${type}&year=${year}&value=${value}`)
    if (!res.ok) { setExporting(null); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const cd = res.headers.get('Content-Disposition') ?? ''
    const match = cd.match(/filename="([^"]+)"/)
    a.href = url
    a.download = match ? match[1] : `bericht.${format === 'excel' ? 'xlsx' : 'pdf'}`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(null)
  }

  function handlePeriodChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, v] = e.target.value.split(':').map(Number)
    setYear(y); setValue(v)
  }

  const compareData = data ? (compareMode === 'prev' ? data.prev_period : data.same_period_last_year) : null
  const compareLabel = compareMode === 'prev' ? 'Vorperiode' : 'Vorjahr'

  return (
    <div className="vnd-page-outer" style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto', ...brandAccentVars(brandColor) }}>
      <style>{`
        @keyframes rpt-pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes rpt-spin{to{transform:rotate(360deg)}}
        .rpt-spin{animation:rpt-spin 1s linear infinite}
        @media(max-width:640px){
          .rpt-kpi-grid{grid-template-columns:repeat(2,1fr)!important}
          .rpt-header{flex-wrap:wrap!important}
          .rpt-export-label{display:none!important}
          .rpt-comp-base,.rpt-comp-hdr-base{display:none!important}
          .rpt-comp-cur,.rpt-comp-hdr-cur{min-width:60px!important}
          .rpt-comp-delta,.rpt-comp-hdr-delta{min-width:52px!important}
          .rpt-compare-toggle{margin-left:0!important;width:100%}
        }
      `}</style>

      <div className="vnd-page-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>

        {/* ── Header ── */}
        <div className="rpt-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div className="vnd-hdr-icon" style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart2 size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Berichte</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 2 }}>Kennzahlen, Vergleiche und Export.</p>
          </div>

          {/* Export Buttons */}
          <div className="rpt-export-btns" style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => exportFile('excel')}
              disabled={!data || exporting !== null}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
                border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                color: 'var(--text-secondary)', opacity: !data || exporting !== null ? 0.5 : 1,
              }}
            >
              {exporting === 'excel' ? <Loader2 size={14} className="rpt-spin" /> : <FileSpreadsheet size={14} />}
              <span className="rpt-export-label">Excel</span>
            </button>
            <button
              onClick={() => exportFile('pdf')}
              disabled={!data || exporting !== null}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
                border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                color: 'var(--text-secondary)', opacity: !data || exporting !== null ? 0.5 : 1,
              }}
            >
              {exporting === 'pdf' ? <Loader2 size={14} className="rpt-spin" /> : <FileText size={14} />}
              <span className="rpt-export-label">PDF</span>
            </button>
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
          {/* Type toggle */}
          <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 2 }}>
            {(['month', 'quarter'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setType(t); setValue(t === 'month' ? now.getMonth() + 1 : Math.floor(now.getMonth() / 3) + 1) }}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  background: type === t ? 'var(--accent)' : 'transparent',
                  color: type === t ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {t === 'month' ? 'Monat' : 'Quartal'}
              </button>
            ))}
          </div>

          {/* Period select */}
          <select
            value={`${year}:${value}`}
            onChange={handlePeriodChange}
            style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text-primary)' }}
          >
            {periods.map(p => (
              <option key={`${p.year}:${p.value}`} value={`${p.year}:${p.value}`}>{p.label}</option>
            ))}
          </select>

          {/* Compare mode */}
          <div className="rpt-compare-toggle" style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 2, marginLeft: 'auto' }}>
            {([['prev', 'vs. Vorperiode'], ['lastyear', 'vs. Vorjahr']] as const).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setCompareMode(k)}
                style={{
                  padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  background: compareMode === k ? 'var(--surface)' : 'transparent',
                  boxShadow: compareMode === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  color: compareMode === k ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="rpt-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[0,1,2,3].map(i => <Skeleton key={i} h={88} />)}
            </div>
            <Skeleton h={180} />
            <Skeleton h={140} />
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Finance KPIs ── */}
            <SectionTitle label="Finanzen" />
            <div className="rpt-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              <KpiCard label="Umsatz" value={eur(data.current.finance.accepted_revenue)} sub={`${data.current.finance.accepted_count} Aufträge`} highlight />
              <KpiCard label="Ø Auftragswert" value={eur(data.current.finance.avg_order_value)} />
              <KpiCard label="Pipeline" value={eur(data.current.finance.pipeline_value)} sub={`${data.current.finance.pipeline_count} offen`} />
              <KpiCard label="Anzahlungen fällig" value={eur(data.current.finance.deposits_due)} />
            </div>

            {/* Comparison header row */}
            {compareData && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', marginBottom: 2 }}>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kennzahl</span>
                  <span className="rpt-comp-hdr-cur" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80, textAlign: 'right' }}>{data.period_label}</span>
                  <span className="rpt-comp-hdr-base" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 70, textAlign: 'right' }}>{compareLabel}</span>
                  <span className="rpt-comp-hdr-delta" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80, textAlign: 'right' }}>Δ</span>
                </div>

                <CompRow label="Umsatz (angenommene Angebote)"   cur={data.current.finance.accepted_revenue}   base={compareData.finance.accepted_revenue}   baseLabel={compareLabel} />
                <CompRow label="Median Auftragswert"             cur={data.current.finance.median_order_value} base={compareData.finance.median_order_value} baseLabel={compareLabel} />
                <CompRow label="Pipeline-Wert"                   cur={data.current.finance.pipeline_value}     base={compareData.finance.pipeline_value}     baseLabel={compareLabel} />
                <CompRow label="Anzahlungen fällig"              cur={data.current.finance.deposits_due}       base={compareData.finance.deposits_due}       baseLabel={compareLabel} />
                <CompRow label="Restbetrag ausstehend"           cur={data.current.finance.balance_outstanding}base={compareData.finance.balance_outstanding} baseLabel={compareLabel} />
              </div>
            )}

            {/* ── Requests & Conversion ── */}
            <SectionTitle label="Anfragen & Angebote" />
            <div className="rpt-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              <KpiCard label="Anfragen" value={String(data.current.requests.received)} />
              <KpiCard label="Versendet" value={String(data.current.requests.offers_sent)} />
              <KpiCard label="Angenommen" value={String(data.current.requests.offers_accepted)} />
              <KpiCard label="Conversion Rate" value={`${data.current.requests.conversion_rate}%`} highlight />
            </div>

            {compareData && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', marginBottom: 2 }}>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kennzahl</span>
                  <span className="rpt-comp-hdr-cur" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80, textAlign: 'right' }}>{data.period_label}</span>
                  <span className="rpt-comp-hdr-base" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 70, textAlign: 'right' }}>{compareLabel}</span>
                  <span className="rpt-comp-hdr-delta" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 80, textAlign: 'right' }}>Δ</span>
                </div>
                {[
                  { label: 'Anfragen eingegangen', cur: data.current.requests.received,       base: compareData.requests.received,       format: 'number' as const },
                  { label: 'Versendet',            cur: data.current.requests.offers_sent,     base: compareData.requests.offers_sent,     format: 'number' as const },
                  { label: 'Angenommen',           cur: data.current.requests.offers_accepted, base: compareData.requests.offers_accepted, format: 'number' as const },
                  { label: 'Abgelehnt',            cur: data.current.requests.offers_declined, base: compareData.requests.offers_declined, format: 'number' as const },
                  { label: 'Conversion Rate',      cur: data.current.requests.conversion_rate, base: compareData.requests.conversion_rate, format: 'percent' as const },
                ].map(r => <CompRow key={r.label} label={r.label} cur={r.cur} base={r.base} baseLabel={compareLabel} format={r.format} />)}
              </div>
            )}

            {/* ── Events ── */}
            <SectionTitle label="Events im Zeitraum" />
            <div className="rpt-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              <KpiCard label="Events (aktuell)" value={String(data.current.events.count)} />
              <KpiCard label={compareLabel} value={String(compareData?.events.count ?? 0)} />
            </div>

            {data.current.events.list.length > 0 ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg)', padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Event</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Datum</span>
                </div>
                {data.current.events.list.map((e, i) => (
                  <div key={e.event_id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '10px 16px', borderBottom: i < data.current.events.list.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 1 ? 'var(--bg)' : 'var(--surface)' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{e.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(e.date + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Keine Events in diesem Zeitraum.</p>
            )}

            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 24 }}>
              Erstellt am {new Date(data.generated_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Kundennamen sind anonymisiert.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
