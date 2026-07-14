'use client'

import React, { useEffect, useState } from 'react'
import {
  Loader2, Users, CalendarDays, TrendingUp, Store, MapPin, Sparkles,
} from 'lucide-react'

// Statistik-Blöcke für die Admin-Übersicht: Nutzer & Wachstum, Events,
// Marktplatz-Conversion, Geografie, Brautpaar-Modulnutzung, Dienstleister-Angebot.
// Reine Anzeige — Daten kommen aus GET /api/admin/stats.

// ── Farben & Basis-Styles (an AdminClient angelehnt) ─────────────────────────

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

// ── Datentypen ───────────────────────────────────────────────────────────────

interface Item { label: string; value: number }
interface Stats {
  users: {
    approvedOrganizers: number; totalCouples: number; soloCouples: number; organizedCouples: number
    vendors: number; activeOrganizers: number; activationRate: number
    roleDistribution: Item[]; signupsSeries: Item[]
  }
  events: {
    total: number; upcoming: number; past: number; avgGuests: number; avgBudget: number
    onboardingRate: number; eventTypes: Item[]; phases: Item[]; eventsByMonth: Item[]
  }
  conversion: {
    funnel: Item[]; conversionRate: number; reqTotal: number; reqResponded: number
    reqAccepted: number; reqDeclined: number; offersReleased: number; offersAccepted: number
    bookedRevenue: number; avgOfferValue: number; avgResponseHours: number | null; requestsByCategory: Item[]
  }
  geo: { eventsByCity: Item[]; organizersByCity: Item[] }
  adoption: { totalEvents: number; modules: { label: string; value: number; pct: number }[] }
  supply: { vendorsByCategory: Item[]; moderation: Item[]; avgRating: number | null; reviewCount: number }
}

// ── Bausteine ────────────────────────────────────────────────────────────────

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

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? C.text : C.surface,
      border: `1px solid ${highlight ? 'transparent' : C.border}`,
      borderRadius: 12, padding: '15px 16px',
    }}>
      <p style={{ fontSize: 11.5, color: highlight ? 'rgba(255,255,255,0.6)' : C.text2, margin: '0 0 7px' }}>{label}</p>
      <p style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', color: highlight ? '#fff' : C.text, lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: highlight ? 'rgba(255,255,255,0.5)' : C.text3, margin: '5px 0 0' }}>{sub}</p>}
    </div>
  )
}

function Panel({ title, children, minH }: { title: string; children: React.ReactNode; minH?: number }) {
  return (
    <div style={{ ...card, minHeight: minH }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>{title}</h3>
      {children}
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return <p style={{ fontSize: 12.5, color: C.text3, margin: '6px 0' }}>{text}</p>
}

// Donut (Ring) mit abgerundeten Segment-Enden + Legende.
function Donut({ data, centerLabel }: { data: Item[]; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <EmptyNote text="Noch keine Daten." />
  const size = 132, stroke = 16, r = (size - stroke) / 2, circ = 2 * Math.PI * r
  const gap = data.length > 1 ? 3 : 0 // kleine Lücke zwischen Segmenten
  let offset = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((d, i) => {
            const frac = d.value / total
            const len = Math.max(0, frac * circ - gap)
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={CAT[i % CAT.length]} strokeWidth={stroke}
                strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset}
                strokeLinecap="round" />
            )
            offset += frac * circ
            return el
          })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: C.text }} dominantBaseline="middle">{nf(total)}</text>
        {centerLabel && <text x="50%" y="62%" textAnchor="middle" style={{ fontSize: 10, fill: C.text3 }} dominantBaseline="middle">{centerLabel}</text>}
      </svg>
      <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: CAT[i % CAT.length], flexShrink: 0 }} />
            <span style={{ flex: 1, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
            <span style={{ color: C.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{nf(d.value)}</span>
            <span style={{ color: C.text3, minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Horizontale Balkenliste (leicht gerundet).
function HBars({ data, color = C.accent, unit }: { data: Item[]; color?: string; unit?: (n: number) => string }) {
  if (data.length === 0) return <EmptyNote text="Noch keine Daten." />
  const max = Math.max(1, ...data.map(d => d.value))
  const fmt = unit ?? nf
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((d, i) => (
        <div key={i}>
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

// Monats-Balken (vertikal, gerundete Köpfe).
function MonthBars({ data, color = C.accent }: { data: Item[]; color?: string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 120 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }} title={`${d.label}: ${nf(d.value)}`}>
            {d.value > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{d.value}</span>}
            <div style={{ width: '100%', maxWidth: 26, height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 4 : 0, background: color, borderRadius: '5px 5px 2px 2px', transition: 'height .5s ease' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
        {data.map((d, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: C.text3, whiteSpace: 'nowrap' }}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

// Geglättete Wachstums-Linie (Fläche + Linie), leicht gerundet.
function GrowthArea({ data, color = C.accent }: { data: Item[]; color?: string }) {
  const W = 640, H = 150, padX = 8, padTop = 14, padBottom = 22
  const max = Math.max(1, ...data.map(d => d.value))
  const n = data.length
  const x = (i: number) => padX + (i * (W - 2 * padX)) / Math.max(1, n - 1)
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom)
  const pts = data.map((d, i) => [x(i), y(d.value)] as const)
  const line = smoothPath(pts)
  const area = `${line} L ${x(n - 1).toFixed(1)} ${(H - padBottom).toFixed(1)} L ${x(0).toFixed(1)} ${(H - padBottom).toFixed(1)} Z`
  const gid = 'adm-grow-grad'
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Neuanmeldungen der letzten 12 Monate">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} stroke="none" />
        <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {data.map((d, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: C.text3 }}>{i % 2 === 0 ? d.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

// Catmull-Rom → Bézier, sanfte Glättung (nicht zu stark).
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length === 0) return ''
  if (pts.length < 3) return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const t = 0.18 // Spannung: klein = dezente Rundung
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? pts[i + 1]
    const c1x = p1[0] + (p2[0] - p0[0]) * t
    const c1y = p1[1] + (p2[1] - p0[1]) * t
    const c2x = p2[0] - (p3[0] - p1[0]) * t
    const c2y = p2[1] - (p3[1] - p1[1]) * t
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

// Conversion-Trichter (gerundete Stufen + Rate dazwischen).
function Funnel({ stages, colors = [CAT[0], CAT[1], CAT[3]] }: { stages: Item[]; colors?: string[] }) {
  const top = Math.max(1, stages[0]?.value ?? 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stages.map((s, i) => {
        const w = Math.max(8, (s.value / top) * 100)
        const prev = stages[i - 1]
        const stepRate = prev && prev.value > 0 ? Math.round((s.value / prev.value) * 100) : null
        return (
          <div key={i}>
            {i > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}>
                <span style={{ fontSize: 10.5, color: C.text3, fontWeight: 600 }}>↓ {stepRate}%</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 130, fontSize: 12.5, color: C.text2, flexShrink: 0 }}>{s.label}</span>
              <div style={{ flex: 1, height: 30, background: C.track, borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${w}%`, background: colors[i % colors.length], borderRadius: 7, display: 'flex', alignItems: 'center', paddingLeft: 10, transition: 'width .5s ease' }}>
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

// Modulnutzung: genutzt vs. nicht genutzt (gerundeter Fortschrittsbalken).
function AdoptionBars({ modules, total }: { modules: { label: string; value: number; pct: number }[]; total: number }) {
  if (modules.length === 0) return <EmptyNote text="Noch keine Daten." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {modules.map((m, i) => {
        const color = m.pct >= 66 ? CAT[3] : m.pct >= 33 ? CAT[2] : CAT[7]
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 8 }}>
              <span style={{ fontSize: 12.5, color: C.text, fontWeight: 500 }}>{m.label}</span>
              <span style={{ fontSize: 12, color: C.text2, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                <strong style={{ color: C.text }}>{m.pct}%</strong> · {nf(m.value)}/{nf(total)}
              </span>
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

// ── Hauptkomponente ──────────────────────────────────────────────────────────

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }
const kpiGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }

export default function AdminStatsSection() {
  const [s, setS] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error))))
      .then((d: Stats) => setS(d))
      .catch(e => setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: C.text2, padding: '30px 0', fontSize: 13.5 }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Statistiken werden geladen…
      </div>
    )
  }
  if (error || !s) return <EmptyNote text={error || 'Keine Statistik verfügbar.'} />

  return (
    <div>
      {/* ── A · Nutzer & Wachstum ── */}
      <SectionHead icon={Users} title="Nutzer & Wachstum" sub="Accounts, Rollen und Neuanmeldungen" />
      <div style={{ ...kpiGrid, marginBottom: 14 }}>
        <Kpi label="Veranstalter" value={nf(s.users.approvedOrganizers)} sub={`${s.users.activationRate}% mit Event aktiv`} />
        <Kpi label="Brautpaare" value={nf(s.users.totalCouples)} sub={`${nf(s.users.soloCouples)} Solo · ${nf(s.users.organizedCouples)} betreut`} highlight />
        <Kpi label="Dienstleister" value={nf(s.users.vendors)} sub="im Marktplatz" />
        <Kpi label="Events gesamt" value={nf(s.events.total)} sub={`${nf(s.events.upcoming)} anstehend`} />
      </div>
      <div style={grid2}>
        <Panel title="Neuanmeldungen · letzte 12 Monate"><GrowthArea data={s.users.signupsSeries} /></Panel>
        <Panel title="Rollenverteilung"><Donut data={s.users.roleDistribution} centerLabel="Nutzer" /></Panel>
      </div>

      {/* ── B · Events ── */}
      <SectionHead icon={CalendarDays} title="Events" sub="Typen, Saisonalität und Projektphasen" />
      <div style={{ ...kpiGrid, marginBottom: 14 }}>
        <Kpi label="Ø Gäste / Event" value={nf(s.events.avgGuests)} />
        <Kpi label="Ø Budget / Event" value={s.events.avgBudget > 0 ? eur(s.events.avgBudget) : '—'} />
        <Kpi label="Onboarding abgeschlossen" value={`${s.events.onboardingRate}%`} />
        <Kpi label="Vergangene Events" value={nf(s.events.past)} />
      </div>
      <div style={grid2}>
        <Panel title="Events pro Monat (nach Datum)"><MonthBars data={s.events.eventsByMonth} /></Panel>
        <Panel title="Event-Typen"><Donut data={s.events.eventTypes} centerLabel="Events" /></Panel>
        <Panel title="Projektphasen"><HBars data={s.events.phases} color={CAT[4]} /></Panel>
      </div>

      {/* ── C · Marktplatz-Conversion ── */}
      <SectionHead icon={TrendingUp} title="Marktplatz-Conversion" sub="Von der Anfrage zur Buchung" />
      <div style={{ ...kpiGrid, marginBottom: 14 }}>
        <Kpi label="Conversion-Rate" value={`${s.conversion.conversionRate}%`} sub="Anfrage → Buchung" highlight />
        <Kpi label="Gebuchtes Volumen" value={eur(s.conversion.bookedRevenue)} sub={`${nf(s.conversion.offersAccepted)} angenommen`} />
        <Kpi label="Ø Angebotswert" value={s.conversion.avgOfferValue > 0 ? eur(s.conversion.avgOfferValue) : '—'} />
        <Kpi label="Ø Reaktionszeit" value={s.conversion.avgResponseHours != null ? `${nf(s.conversion.avgResponseHours)} h` : '—'} />
      </div>
      <div style={grid2}>
        <Panel title="Conversion-Trichter"><Funnel stages={s.conversion.funnel} /></Panel>
        <Panel title="Anfragen nach Gewerk"><HBars data={s.conversion.requestsByCategory} color={CAT[0]} /></Panel>
      </div>

      {/* ── D · Geografie ── */}
      <SectionHead icon={MapPin} title="Orte" sub="Wo Events und Veranstalter sitzen" />
      <div style={grid2}>
        <Panel title="Events nach Stadt"><HBars data={s.geo.eventsByCity} color={CAT[1]} /></Panel>
        <Panel title="Veranstalter nach Stadt"><HBars data={s.geo.organizersByCity} color={CAT[5]} /></Panel>
      </div>

      {/* ── E · Brautpaar-Modulnutzung ── */}
      <SectionHead icon={Sparkles} title="Modulnutzung der Brautpaare" sub={`Was in den ${nf(s.adoption.totalEvents)} Events gepflegt wird – und was nicht`} />
      <Panel title="Anteil der Events mit Daten je Modul">
        <AdoptionBars modules={s.adoption.modules} total={s.adoption.totalEvents} />
      </Panel>

      {/* ── F · Dienstleister-Angebot ── */}
      <SectionHead icon={Store} title="Dienstleister-Angebot" sub="Marktplatz-Supply und Qualität" />
      <div style={{ ...kpiGrid, marginBottom: 14 }}>
        <Kpi label="Ø Bewertung" value={s.supply.avgRating != null ? `${s.supply.avgRating.toLocaleString('de-DE')} ★` : '—'} sub={`${nf(s.supply.reviewCount)} Bewertungen`} />
        <Kpi label="Freigegeben" value={nf(s.supply.moderation.find(m => m.label === 'Freigegeben')?.value ?? 0)} />
      </div>
      <div style={grid2}>
        <Panel title="Dienstleister nach Kategorie"><HBars data={s.supply.vendorsByCategory} color={CAT[7]} /></Panel>
        <Panel title="Moderationsstatus"><Donut data={s.supply.moderation} centerLabel="Anbieter" /></Panel>
      </div>
    </div>
  )
}
