'use client'

import React from 'react'
import { Eye, Mail, Phone, Globe, Share2, Inbox } from 'lucide-react'
import { EVENT_LABELS, type Counts, type DayPoint, type EventType } from '@/lib/marketplace/stats'

// Prop-getriebene Statistik-Anzeige (Kacheln + 30-Tage-Verlauf). Wird in der
// Vendor-Statistik und im Admin-Panel verwendet.

const ICONS: Record<EventType, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  profile_view: Eye, contact_email: Mail, contact_phone: Phone, website: Globe, social: Share2, request: Inbox,
}
const ORDER: EventType[] = ['profile_view', 'contact_email', 'contact_phone', 'website', 'social', 'request']

export default function VendorStatsPanel({
  total, last30, series, accent = '#2352C8', compact = false,
}: {
  total: Counts; last30: Counts; series: DayPoint[]; accent?: string; compact?: boolean
}) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 120 : 150}px, 1fr))`, gap: 10, marginBottom: series.length ? 18 : 0 }}>
        {ORDER.map(t => {
          const Icon = ICONS[t]
          return (
            <div key={t} style={{ border: '1px solid #E6EAF2', borderRadius: 12, padding: compact ? '10px 12px' : '14px 16px', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7480', fontSize: 12, fontWeight: 600 }}>
                <Icon size={14} style={{ color: accent }} /> {EVENT_LABELS[t]}
              </div>
              <div style={{ fontSize: compact ? 20 : 26, fontWeight: 800, color: '#111827', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {total[t].toLocaleString('de-DE')}
              </div>
              <div style={{ fontSize: 11.5, color: last30[t] > 0 ? '#15803D' : '#94A3B8', fontWeight: 600 }}>
                +{last30[t].toLocaleString('de-DE')} in 30 Tagen
              </div>
            </div>
          )
        })}
      </div>

      {series.length > 0 && <MiniChart series={series} accent={accent} />}
    </div>
  )
}

// Schlichtes 30-Tage-Liniendiagramm: Profilaufrufe + Kontaktklicks (E-Mail+Telefon).
function MiniChart({ series, accent }: { series: DayPoint[]; accent: string }) {
  const W = 720, H = 140, padX = 6, padY = 12
  const views = series.map(p => p.counts.profile_view)
  const contacts = series.map(p => p.counts.contact_email + p.counts.contact_phone)
  const max = Math.max(1, ...views, ...contacts)
  const x = (i: number) => padX + (i * (W - 2 * padX)) / Math.max(1, series.length - 1)
  const y = (v: number) => H - padY - (v * (H - 2 * padY)) / max
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  const first = series[0]?.day
  const last = series[series.length - 1]?.day
  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '')

  return (
    <div style={{ border: '1px solid #E6EAF2', borderRadius: 12, padding: 14, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, fontSize: 12, color: '#4B5768', flexWrap: 'wrap' }}>
        <strong style={{ color: '#111827', fontSize: 13 }}>Letzte 30 Tage</strong>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 3, borderRadius: 2, background: accent, display: 'inline-block' }} /> Profilaufrufe</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 3, borderRadius: 2, background: '#15803D', display: 'inline-block' }} /> Kontaktklicks</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Verlauf der letzten 30 Tage">
        <path d={path(views)} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path(contacts)} fill="none" stroke="#15803D" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
        <span>{fmt(first)}</span><span>{fmt(last)}</span>
      </div>
    </div>
  )
}
