'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  Loader2, Activity, UserCheck, TrendingUp, Users, CalendarDays, MapPin, Sparkles, Store,
} from 'lucide-react'

// Admin-Insights-Dashboard: Website-Nutzung, Aktivierung/Einladungen, Marktplatz-
// Potenzial, Nutzer/Events-Bestand, Orte & Angebot/Nachfrage, Modulnutzung.
// Interaktiv: globaler Zeitraum-Filter, Hover-Tooltips, Legenden-Umschaltung,
// klickbare Drilldowns (Navigation in Admin-Bereiche). Daten: GET /api/admin/stats.

type NavTarget = 'ubersicht' | 'anbieter' | 'veranstalter' | 'meldungen' | 'promo'

const C = {
  bg: '#F4F5F7', surface: '#FFFFFF', border: '#E2E4E8',
  text: '#1A1D21', text2: '#5A6068', text3: '#9AA0A8',
  accent: '#2563EB', track: '#EDEFF3',
}
// Validierte kategoriale Palette (dataviz, feste Reihenfolge — nicht rotieren).
const CAT = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']
const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }

function nf(n: number) { return n.toLocaleString('de-DE') }
function eur(n: number) { return nf(Math.round(n)) + ' €' }

interface Item { label: string; value: number }
interface Group { label: string; demand: number; supply: number }

// ── Tooltip-Kontext (ein schwebendes Feld folgt dem Zeiger) ──────────────────

interface TipState { x: number; y: number; content: React.ReactNode }
const TipCtx = createContext<{ show: (c: React.ReactNode, e: React.MouseEvent) => void; hide: () => void }>({ show: () => {}, hide: () => {} })
function useTip() { return useContext(TipCtx) }

function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null)
  const show = useCallback((content: React.ReactNode, e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, content }), [])
  const hide = useCallback(() => setTip(null), [])
  return (
    <TipCtx.Provider value={{ show, hide }}>
      {children}
      {tip && (
        <div style={{
          position: 'fixed', left: Math.min(tip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 220),
          top: tip.y + 16, zIndex: 5000, pointerEvents: 'none',
          background: '#1A1D21', color: '#fff', borderRadius: 8, padding: '8px 11px',
          fontSize: 12, lineHeight: 1.45, maxWidth: 240, boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        }}>{tip.content}</div>
      )}
    </TipCtx.Provider>
  )
}

// tipProps: Hover-Handler für ein Element
function useTipProps(content: React.ReactNode) {
  const { show, hide } = useTip()
  return {
    onMouseEnter: (e: React.MouseEvent) => show(content, e),
    onMouseMove: (e: React.MouseEvent) => show(content, e),
    onMouseLeave: hide,
  }
}

// ── Basis-Bausteine ──────────────────────────────────────────────────────────

function SectionHead({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '34px 0 14px' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} style={{ color: C.accent }} />
      </div>
      <div>
        <h2 style={{ fontSize: 15.5, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
        {sub && <p style={{ fontSize: 12.5, color: C.text2, margin: '1px 0 0' }}>{sub}</p>}
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, highlight, onClick, tip }: { label: string; value: string; sub?: string; highlight?: boolean; onClick?: () => void; tip?: React.ReactNode }) {
  const t = useTipProps(tip ?? `${label}: ${value}`)
  return (
    <div {...t} onClick={onClick} style={{
      background: highlight ? C.text : C.surface, border: `1px solid ${highlight ? 'transparent' : C.border}`,
      borderRadius: 12, padding: '15px 16px', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .15s',
    }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      <p style={{ fontSize: 11.5, color: highlight ? 'rgba(255,255,255,0.6)' : C.text2, margin: '0 0 7px' }}>{label}</p>
      <p style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', color: highlight ? '#fff' : C.text, lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: highlight ? 'rgba(255,255,255,0.5)' : C.text3, margin: '5px 0 0' }}>{sub}</p>}
    </div>
  )
}

function Panel({ title, hint, children, onClick }: { title: string; hint?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div style={{ ...card, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h3>
        {hint && <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function EmptyNote({ text }: { text: string }) { return <p style={{ fontSize: 12.5, color: C.text3, margin: '6px 0' }}>{text}</p> }

// Donut mit Hover-Hervorhebung + Legenden-Umschaltung
function Donut({ data, centerLabel, onSlice }: { data: Item[]; centerLabel?: string; onSlice?: (label: string) => void }) {
  const { show, hide } = useTip()
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const vis = data.filter(d => !hidden[d.label])
  const total = vis.reduce((s, d) => s + d.value, 0)
  const size = 132, stroke = 16, r = (size - stroke) / 2, circ = 2 * Math.PI * r
  const gap = vis.length > 1 ? 3 : 0
  let offset = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {vis.map((d, i) => {
            const frac = total > 0 ? d.value / total : 0
            const len = Math.max(0, frac * circ - gap)
            const el = (
              <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={CAT[data.indexOf(d) % CAT.length]} strokeWidth={stroke}
                strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} strokeLinecap="round"
                style={{ cursor: onSlice ? 'pointer' : 'default' }}
                onMouseEnter={e => show(<span><b>{d.label}</b><br />{nf(d.value)} · {Math.round(frac * 100)}%</span>, e)}
                onMouseMove={e => show(<span><b>{d.label}</b><br />{nf(d.value)} · {Math.round(frac * 100)}%</span>, e)}
                onMouseLeave={hide}
                onClick={() => onSlice?.(d.label)} />
            )
            offset += frac * circ
            return el
          })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: C.text }} dominantBaseline="middle">{nf(total)}</text>
        {centerLabel && <text x="50%" y="62%" textAnchor="middle" style={{ fontSize: 10, fill: C.text3 }} dominantBaseline="middle">{centerLabel}</text>}
      </svg>
      <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d) => {
          const off = hidden[d.label]
          return (
            <button key={d.label} onClick={() => setHidden(h => ({ ...h, [d.label]: !h[d.label] }))}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: off ? 0.4 : 1 }}
              title="Ein-/ausblenden">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: CAT[data.indexOf(d) % CAT.length], flexShrink: 0 }} />
              <span style={{ flex: 1, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: off ? 'line-through' : 'none' }}>{d.label}</span>
              <span style={{ color: C.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{nf(d.value)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Horizontale Balken mit Hover + optionalem Klick
function HBars({ data, color = C.accent, unit, onBar }: { data: Item[]; color?: string; unit?: (n: number) => string; onBar?: (label: string) => void }) {
  const { show, hide } = useTip()
  if (data.length === 0) return <EmptyNote text="Noch keine Daten." />
  const max = Math.max(1, ...data.map(d => d.value))
  const fmt = unit ?? nf
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((d, i) => (
        <div key={i} onClick={() => onBar?.(d.label)} style={{ cursor: onBar ? 'pointer' : 'default' }}
          onMouseEnter={e => show(<span><b>{d.label}</b><br />{fmt(d.value)}</span>, e)}
          onMouseMove={e => show(<span><b>{d.label}</b><br />{fmt(d.value)}</span>, e)}
          onMouseLeave={hide}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 8 }}>
            <span style={{ fontSize: 12.5, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(d.value)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 5, background: C.track, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.value / max) * 100}%`, background: color, borderRadius: 5, transition: 'width .5s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Gruppierte Balken: Nachfrage vs. Angebot
function GroupedBars({ data, unit }: { data: Group[]; unit?: (n: number) => string }) {
  const { show, hide } = useTip()
  const [hideDemand, setHideDemand] = useState(false)
  const [hideSupply, setHideSupply] = useState(false)
  if (data.length === 0) return <EmptyNote text="Noch keine Daten." />
  const fmt = unit ?? nf
  const max = Math.max(1, ...data.map(d => Math.max(hideDemand ? 0 : d.demand, hideSupply ? 0 : d.supply)))
  const legend = (label: string, color: string, off: boolean, toggle: () => void) => (
    <button onClick={toggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: C.text2, opacity: off ? 0.4 : 1, padding: 0 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} /> <span style={{ textDecoration: off ? 'line-through' : 'none' }}>{label}</span>
    </button>
  )
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        {legend('Nachfrage', CAT[0], hideDemand, () => setHideDemand(v => !v))}
        {legend('Angebot', CAT[1], hideSupply, () => setHideSupply(v => !v))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.map((d, i) => {
          const gap = d.demand - d.supply
          const tip = <span><b>{d.label}</b><br />Nachfrage: {fmt(d.demand)}<br />Angebot: {fmt(d.supply)}<br />{gap > 0 ? `Lücke: ${fmt(gap)}` : gap < 0 ? `Überangebot: ${fmt(-gap)}` : 'ausgeglichen'}</span>
          return (
            <div key={i} onMouseEnter={e => show(tip, e)} onMouseMove={e => show(tip, e)} onMouseLeave={hide}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, color: C.text2 }}>{d.label}</span>
                {gap > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: CAT[7] }}>Lücke {fmt(gap)}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {!hideDemand && <div style={{ height: 7, borderRadius: 4, background: C.track, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(d.demand / max) * 100}%`, background: CAT[0], borderRadius: 4, transition: 'width .5s ease' }} /></div>}
                {!hideSupply && <div style={{ height: 7, borderRadius: 4, background: C.track, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(d.supply / max) * 100}%`, background: CAT[1], borderRadius: 4, transition: 'width .5s ease' }} /></div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Monats-/Perioden-Balken mit Hover
function PeriodBars({ data, color = C.accent }: { data: Item[]; color?: string }) {
  const { show, hide } = useTip()
  const max = Math.max(1, ...data.map(d => d.value))
  const step = Math.max(1, Math.ceil(data.length / 12))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
            onMouseEnter={e => show(<span><b>{d.label}</b><br />{nf(d.value)}</span>, e)}
            onMouseMove={e => show(<span><b>{d.label}</b><br />{nf(d.value)}</span>, e)}
            onMouseLeave={hide}>
            <div style={{ width: '100%', maxWidth: 26, height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 4 : 0, background: color, borderRadius: '5px 5px 2px 2px', transition: 'height .5s ease' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {data.map((d, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: C.text3, whiteSpace: 'nowrap', overflow: 'hidden' }}>{i % step === 0 ? d.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

// Geglättete Flächen-/Linien-Kurve mit Hover-Punkten
function GrowthArea({ data, color = C.accent, valueLabel = 'Wert' }: { data: Item[]; color?: string; valueLabel?: string }) {
  const { show, hide } = useTip()
  const W = 640, H = 150, padX = 8, padTop = 14, padBottom = 22
  const max = Math.max(1, ...data.map(d => d.value))
  const n = data.length
  const x = (i: number) => padX + (i * (W - 2 * padX)) / Math.max(1, n - 1)
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom)
  const pts = data.map((d, i) => [x(i), y(d.value)] as const)
  const line = smoothPath(pts)
  const area = `${line} L ${x(n - 1).toFixed(1)} ${(H - padBottom).toFixed(1)} L ${x(0).toFixed(1)} ${(H - padBottom).toFixed(1)} Z`
  const gid = `grad-${valueLabel.replace(/\s/g, '')}`
  const step = Math.max(1, Math.ceil(n / 8))
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} /><stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} stroke="none" />
        <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {pts.map(([px, py], i) => (
          <rect key={i} x={px - (W / n) / 2} y={0} width={W / n} height={H} fill="transparent" style={{ cursor: 'default' }}
            onMouseEnter={e => show(<span><b>{data[i].label}</b><br />{nf(data[i].value)} {valueLabel}</span>, e)}
            onMouseMove={e => show(<span><b>{data[i].label}</b><br />{nf(data[i].value)} {valueLabel}</span>, e)}
            onMouseLeave={hide} />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {data.map((d, i) => (<span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: C.text3, whiteSpace: 'nowrap', overflow: 'hidden' }}>{i % step === 0 ? d.label : ''}</span>))}
      </div>
    </div>
  )
}

function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length === 0) return ''
  if (pts.length < 3) return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const t = 0.18
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? pts[i + 1]
    const c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t
    const c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

// Conversion-Trichter mit Hover + Raten
function Funnel({ stages, colors, onStage }: { stages: Item[]; colors?: string[]; onStage?: (label: string) => void }) {
  const { show, hide } = useTip()
  const cols = colors ?? [CAT[0], CAT[1], CAT[2], CAT[3], CAT[3]]
  const top = Math.max(1, stages[0]?.value ?? 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stages.map((s, i) => {
        const w = Math.max(6, (s.value / top) * 100)
        const prev = stages[i - 1]
        const stepRate = prev && prev.value > 0 ? Math.round((s.value / prev.value) * 100) : null
        const fromTop = Math.round((s.value / top) * 100)
        const tip = <span><b>{s.label}</b><br />{nf(s.value)}{i > 0 && <> · {stepRate}% der Vorstufe</>}<br />{fromTop}% ab Start</span>
        return (
          <div key={i}>
            {i > 0 && <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}><span style={{ fontSize: 10.5, color: C.text3, fontWeight: 600 }}>↓ {stepRate}%</span></div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: onStage ? 'pointer' : 'default' }} onClick={() => onStage?.(s.label)}
              onMouseEnter={e => show(tip, e)} onMouseMove={e => show(tip, e)} onMouseLeave={hide}>
              <span style={{ width: 120, fontSize: 12.5, color: C.text2, flexShrink: 0 }}>{s.label}</span>
              <div style={{ flex: 1, height: 28, background: C.track, borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${w}%`, background: cols[i % cols.length], borderRadius: 7, display: 'flex', alignItems: 'center', paddingLeft: 10, transition: 'width .5s ease' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{nf(s.value)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Modulnutzung: genutzt vs. nicht genutzt
function AdoptionBars({ modules, total }: { modules: { label: string; value: number; pct: number }[]; total: number }) {
  const { show, hide } = useTip()
  if (modules.length === 0) return <EmptyNote text="Noch keine Daten." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {modules.map((m, i) => {
        const color = m.pct >= 66 ? CAT[3] : m.pct >= 33 ? CAT[2] : CAT[7]
        const tip = <span><b>{m.label}</b><br />{nf(m.value)} von {nf(total)} Events ({m.pct}%)<br />nicht genutzt: {nf(total - m.value)}</span>
        return (
          <div key={i} onMouseEnter={e => show(tip, e)} onMouseMove={e => show(tip, e)} onMouseLeave={hide}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 8 }}>
              <span style={{ fontSize: 12.5, color: C.text, fontWeight: 500 }}>{m.label}</span>
              <span style={{ fontSize: 12, color: C.text2, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}><strong style={{ color: C.text }}>{m.pct}%</strong> · {nf(m.value)}/{nf(total)}</span>
            </div>
            <div style={{ height: 9, borderRadius: 5, background: C.track, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${m.pct}%`, background: color, borderRadius: 5, transition: 'width .5s ease' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Aktivitäts-Heatmap (Wochentag × Stunde)
function Heatmap({ cells, max, weekdays }: { cells: { d: number; h: number; v: number }[]; max: number; weekdays: string[] }) {
  const { show, hide } = useTip()
  if (cells.length === 0 || max === 0) return <EmptyNote text="Noch keine Aktivität im Zeitraum." />
  const grid = new Map<string, number>()
  cells.forEach(c => grid.set(`${c.d}-${c.h}`, c.v))
  const shade = (v: number) => {
    if (v === 0) return C.track
    const a = 0.18 + 0.82 * (v / max)
    return `rgba(37,99,235,${a.toFixed(2)})`
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 460 }}>
        {weekdays.map((wd, d) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ width: 22, fontSize: 10.5, color: C.text3, flexShrink: 0 }}>{wd}</span>
            <div style={{ display: 'flex', gap: 2, flex: 1 }}>
              {Array.from({ length: 24 }, (_, h) => {
                const v = grid.get(`${d}-${h}`) ?? 0
                const tip = <span><b>{wd} {String(h).padStart(2, '0')}:00</b><br />{nf(v)} Aktion{v === 1 ? '' : 'en'}</span>
                return <div key={h} style={{ flex: 1, height: 13, borderRadius: 2, background: shade(v) }}
                  onMouseEnter={e => show(tip, e)} onMouseMove={e => show(tip, e)} onMouseLeave={hide} />
              })}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 2, marginLeft: 26, marginTop: 2 }}>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} style={{ flex: 1, textAlign: 'center', fontSize: 8.5, color: C.text3 }}>{h % 6 === 0 ? h : ''}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Einladungs-Balken (versendet vs. angenommen)
function InviteBars({ invites }: { invites: { label: string; sent: number; accepted: number }[] }) {
  const { show, hide } = useTip()
  const max = Math.max(1, ...invites.map(i => i.sent))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {invites.map((iv, i) => {
        const rate = iv.sent > 0 ? Math.round((iv.accepted / iv.sent) * 100) : 0
        const tip = <span><b>{iv.label}</b><br />versendet: {nf(iv.sent)}<br />angenommen: {nf(iv.accepted)} ({rate}%)</span>
        return (
          <div key={i} onMouseEnter={e => show(tip, e)} onMouseMove={e => show(tip, e)} onMouseLeave={hide}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, color: C.text2 }}>{iv.label}</span>
              <span style={{ fontSize: 12, color: C.text }}><strong>{nf(iv.accepted)}</strong>/{nf(iv.sent)} · {rate}%</span>
            </div>
            <div style={{ height: 9, borderRadius: 5, background: C.track, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${(iv.sent / max) * 100}%`, background: 'rgba(37,99,235,0.18)', borderRadius: 5 }} />
              <div style={{ position: 'absolute', inset: 0, width: `${(iv.accepted / max) * 100}%`, background: CAT[0], borderRadius: 5, transition: 'width .5s ease' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Segmentierter Umschalter (Zeitraum)
function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  return (
    <div style={{ display: 'inline-flex', background: C.track, borderRadius: 9, padding: 3, gap: 2 }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12.5, fontWeight: value === o.key ? 700 : 500,
          background: value === o.key ? '#fff' : 'transparent', color: value === o.key ? C.text : C.text2,
          boxShadow: value === o.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

// ── Datentypen (Response) ────────────────────────────────────────────────────

interface Stats {
  window: { days: number | 'all'; label: string }
  users: { approvedOrganizers: number; totalCouples: number; soloCouples: number; organizedCouples: number; vendors: number; activeOrganizers: number; activationRate: number; roleDistribution: Item[]; signupsSeries: Item[] }
  usage: { activeTotal: number; totalActions: number; activeUsersSeries: Item[]; actionsByArea: Item[]; actionsByRole: Item[]; heatmap: { d: number; h: number; v: number }[]; heatMax: number; weekdays: string[] }
  activation: { funnel: Item[]; invites: { label: string; sent: number; accepted: number }[]; tour: { started: number; completed: number } }
  events: { total: number; upcoming: number; past: number; avgGuests: number; avgBudget: number; onboardingRate: number; eventTypes: Item[]; phases: Item[]; eventsByMonth: Item[] }
  potential: { funnel: Item[]; conversionRate: number; pipelineValue: number; openCount: number; bookedRevenue: number; avgOfferValue: number; avgResponseHours: number | null; favorites: number; reachSeries: Item[]; requestsByCategory: Item[] }
  geo: { eventsByCity: Item[]; organizersByCity: Item[]; vendorsByCity: Item[]; gapByCity: Group[]; gapByCategory: Group[]; vendorsByCategory: Item[] }
  supply: { moderation: Item[]; avgRating: number | null; reviewCount: number }
  adoption: { totalEvents: number; modules: { label: string; value: number; pct: number }[] }
}

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }
const kpiGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }

type RangeKey = '7' | '30' | '90' | '365' | 'all'
const RANGE_OPTS: { key: RangeKey; label: string }[] = [
  { key: '7', label: '7 T' }, { key: '30', label: '30 T' }, { key: '90', label: '90 T' }, { key: '365', label: '12 M' }, { key: 'all', label: 'Gesamt' },
]

// ── Hauptkomponente ──────────────────────────────────────────────────────────

export default function AdminStatsSection({ onNav }: { onNav?: (s: NavTarget) => void }) {
  const [range, setRange] = useState<RangeKey>('30')
  const [s, setS] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setRefreshing(true)
    fetch(`/api/admin/stats?days=${range}`)
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error))))
      .then((d: Stats) => { if (alive) { setS(d); setError('') } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen') })
      .finally(() => { if (alive) { setLoading(false); setRefreshing(false) } })
    return () => { alive = false }
  }, [range])

  const winLabel = s?.window.label ?? ''

  return (
    <TooltipProvider>
      <div style={{ padding: 'clamp(18px, 4vw, 28px) clamp(14px, 4vw, 24px) 64px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          {/* Kopf + globaler Zeitraum-Filter */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em', color: C.text }}>Insights</h1>
              <p style={{ fontSize: 13.5, color: C.text2, margin: 0 }}>Website-Nutzung, Aktivierung und Marktplatz-Potenzial. Hover für Details, Klick öffnet den Bereich.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {refreshing && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite', color: C.text3 }} />}
              <Segmented value={range} onChange={setRange} options={RANGE_OPTS} />
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: C.text2, padding: '40px 0', fontSize: 13.5 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Insights werden geladen…
            </div>
          ) : error || !s ? (
            <EmptyNote text={error || 'Keine Statistik verfügbar.'} />
          ) : (
            <div style={{ opacity: refreshing ? 0.55 : 1, transition: 'opacity .2s' }}>

              {/* ── Website-Nutzung ── */}
              <SectionHead icon={Activity} title="Website-Nutzung" sub={`Aktivität aus Aktionen der Nutzer · Zeitraum: ${winLabel}`} />
              <div style={{ ...kpiGrid, marginBottom: 14 }}>
                <Kpi label="Aktive Nutzer" value={nf(s.usage.activeTotal)} sub={`im Zeitraum (${winLabel})`} highlight tip={<span>Eindeutige Nutzer mit mindestens einer Aktion im Zeitraum.</span>} />
                <Kpi label="Aktionen gesamt" value={nf(s.usage.totalActions)} sub="Gäste, Nachrichten, Dateien, Marktplatz" />
                <Kpi label="Ø Aktionen / aktiver Nutzer" value={s.usage.activeTotal > 0 ? nf(Math.round(s.usage.totalActions / s.usage.activeTotal)) : '—'} />
                <Kpi label="Aktiv (30 Tage)" value={nf(s.activation.funnel[2]?.value ?? 0)} sub="wiederkehrende Nutzung" />
              </div>
              <div style={{ ...grid2, marginBottom: 14 }}>
                <Panel title="Aktive Nutzer über Zeit" hint={winLabel}><GrowthArea data={s.usage.activeUsersSeries} valueLabel="aktive Nutzer" /></Panel>
                <Panel title="Genutzte Bereiche"><HBars data={s.usage.actionsByArea} color={CAT[0]} unit={(n) => `${nf(n)} Aktionen`} /></Panel>
              </div>
              <div style={grid2}>
                <Panel title="Aktivität nach Rolle"><Donut data={s.usage.actionsByRole} centerLabel="Aktionen" /></Panel>
                <Panel title="Aktivität nach Wochentag & Uhrzeit"><Heatmap cells={s.usage.heatmap} max={s.usage.heatMax} weekdays={s.usage.weekdays} /></Panel>
              </div>

              {/* ── Aktivierung & Einladungen ── */}
              <SectionHead icon={UserCheck} title="Aktivierung & Einladungen" sub="Wo Nutzer im Trichter stehen — und wo Potenzial liegt" />
              <div style={grid2}>
                <Panel title="Aktivierungs-Trichter" hint="Registrierung → aktiv"><Funnel stages={s.activation.funnel} onStage={() => onNav?.('veranstalter')} /></Panel>
                <Panel title="Einladungen — versendet vs. angenommen">
                  <InviteBars invites={s.activation.invites} />
                  <p style={{ fontSize: 11.5, color: C.text3, margin: '14px 0 0' }}>Onboarding-Tour: {nf(s.activation.tour.completed)}/{nf(s.activation.tour.started)} abgeschlossen</p>
                </Panel>
              </div>

              {/* ── Marktplatz-Potenzial ── */}
              <SectionHead icon={TrendingUp} title="Marktplatz-Potenzial" sub={`Reichweite → Buchung und offene Pipeline · ${winLabel}`} />
              <div style={{ ...kpiGrid, marginBottom: 14 }}>
                <Kpi label="Offene Pipeline" value={eur(s.potential.pipelineValue)} sub={`${nf(s.potential.openCount)} Angebote offen`} highlight tip={<span>Summe versendeter, noch nicht gebuchter Angebote — potenzieller Umsatz.</span>} onClick={() => onNav?.('anbieter')} />
                <Kpi label="Conversion-Rate" value={`${s.potential.conversionRate}%`} sub="Anfrage → Buchung" />
                <Kpi label="Gebuchtes Volumen" value={eur(s.potential.bookedRevenue)} />
                <Kpi label="Merkliste-Interesse" value={nf(s.potential.favorites)} sub="Vormerkungen im Zeitraum" />
              </div>
              <div style={{ ...grid2, marginBottom: 14 }}>
                <Panel title="Potenzial-Trichter" hint="Sichtbarkeit → Buchung"><Funnel stages={s.potential.funnel} onStage={() => onNav?.('anbieter')} /></Panel>
                <Panel title="Profilaufrufe über Zeit" hint={winLabel}><GrowthArea data={s.potential.reachSeries} color={CAT[1]} valueLabel="Aufrufe" /></Panel>
              </div>
              <div style={{ ...kpiGrid, marginBottom: 14 }}>
                <Kpi label="Ø Angebotswert" value={s.potential.avgOfferValue > 0 ? eur(s.potential.avgOfferValue) : '—'} />
                <Kpi label="Ø Reaktionszeit" value={s.potential.avgResponseHours != null ? `${nf(s.potential.avgResponseHours)} h` : '—'} sub="Anfrage → Antwort" />
              </div>
              <div style={grid2}>
                <Panel title="Anfragen nach Gewerk"><HBars data={s.potential.requestsByCategory} color={CAT[0]} onBar={() => onNav?.('anbieter')} /></Panel>
              </div>

              {/* ── Orte & Angebot/Nachfrage ── */}
              <SectionHead icon={MapPin} title="Orte & Angebot/Nachfrage" sub="Regionale Verteilung und Expansions-Potenzial" />
              <div style={{ ...grid2, marginBottom: 14 }}>
                <Panel title="Dienstleister nach Stadt"><HBars data={s.geo.vendorsByCity} color={CAT[7]} onBar={() => onNav?.('anbieter')} /></Panel>
                <Panel title="Events nach Stadt"><HBars data={s.geo.eventsByCity} color={CAT[1]} /></Panel>
              </div>
              <div style={grid2}>
                <Panel title="Angebot/Nachfrage nach Stadt" hint="Lücke = Potenzial"><GroupedBars data={s.geo.gapByCity} /></Panel>
                <Panel title="Angebot/Nachfrage nach Gewerk" hint="Lücke = Potenzial"><GroupedBars data={s.geo.gapByCategory} /></Panel>
              </div>

              {/* ── Nutzer & Wachstum ── */}
              <SectionHead icon={Users} title="Nutzer & Wachstum" sub="Bestand, Rollen und Neuanmeldungen" />
              <div style={{ ...kpiGrid, marginBottom: 14 }}>
                <Kpi label="Veranstalter" value={nf(s.users.approvedOrganizers)} sub={`${s.users.activationRate}% mit Event aktiv`} onClick={() => onNav?.('veranstalter')} />
                <Kpi label="Brautpaare" value={nf(s.users.totalCouples)} sub={`${nf(s.users.soloCouples)} Solo · ${nf(s.users.organizedCouples)} betreut`} highlight />
                <Kpi label="Dienstleister" value={nf(s.users.vendors)} sub="im Marktplatz" onClick={() => onNav?.('anbieter')} />
                <Kpi label="Events gesamt" value={nf(s.events.total)} sub={`${nf(s.events.upcoming)} anstehend`} />
              </div>
              <div style={grid2}>
                <Panel title="Neuanmeldungen" hint={winLabel}><GrowthArea data={s.users.signupsSeries} valueLabel="Neuanmeldungen" /></Panel>
                <Panel title="Rollenverteilung"><Donut data={s.users.roleDistribution} centerLabel="Nutzer" onSlice={(l) => onNav?.(l.startsWith('Dienst') ? 'anbieter' : 'veranstalter')} /></Panel>
              </div>

              {/* ── Events ── */}
              <SectionHead icon={CalendarDays} title="Events" sub="Typen, Saisonalität und Projektphasen" />
              <div style={{ ...kpiGrid, marginBottom: 14 }}>
                <Kpi label="Ø Gäste / Event" value={nf(s.events.avgGuests)} />
                <Kpi label="Ø Budget / Event" value={s.events.avgBudget > 0 ? eur(s.events.avgBudget) : '—'} />
                <Kpi label="Onboarding abgeschlossen" value={`${s.events.onboardingRate}%`} />
                <Kpi label="Vergangene Events" value={nf(s.events.past)} />
              </div>
              <div style={grid2}>
                <Panel title="Events pro Monat (nach Datum)"><PeriodBars data={s.events.eventsByMonth} /></Panel>
                <Panel title="Event-Typen"><Donut data={s.events.eventTypes} centerLabel="Events" /></Panel>
                <Panel title="Projektphasen"><HBars data={s.events.phases} color={CAT[4]} /></Panel>
              </div>

              {/* ── Modulnutzung ── */}
              <SectionHead icon={Sparkles} title="Modulnutzung" sub={`Welche Module in den ${nf(s.adoption.totalEvents)} Events gepflegt werden — und welche nicht`} />
              <Panel title="Anteil der Events mit Daten je Modul"><AdoptionBars modules={s.adoption.modules} total={s.adoption.totalEvents} /></Panel>

              {/* ── Dienstleister-Angebot ── */}
              <SectionHead icon={Store} title="Dienstleister-Angebot" sub="Marktplatz-Supply und Qualität" />
              <div style={{ ...kpiGrid, marginBottom: 14 }}>
                <Kpi label="Ø Bewertung" value={s.supply.avgRating != null ? `${s.supply.avgRating.toLocaleString('de-DE')} ★` : '—'} sub={`${nf(s.supply.reviewCount)} Bewertungen`} />
                <Kpi label="Freigegeben" value={nf(s.supply.moderation.find(m => m.label === 'Freigegeben')?.value ?? 0)} onClick={() => onNav?.('anbieter')} />
              </div>
              <div style={grid2}>
                <Panel title="Dienstleister nach Kategorie"><HBars data={s.geo.vendorsByCategory} color={CAT[7]} onBar={() => onNav?.('anbieter')} /></Panel>
                <Panel title="Moderationsstatus"><Donut data={s.supply.moderation} centerLabel="Anbieter" onSlice={() => onNav?.('anbieter')} /></Panel>
              </div>

            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
