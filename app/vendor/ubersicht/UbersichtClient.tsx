'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Inbox, Loader2 } from 'lucide-react'

interface Stats {
  pendingAnfragen: number
  newAnfragenThisWeek: number
  releasedOffers: number
  offersValue: number
  acceptedOffers: number
  upcomingEvents: number
  nextEventDays: number | null
  pipelineValue: number
  pipelineAnfragenCount: number
  pipelineAnfragenValue: number
  pipelineAngeboteCount: number
  pipelineAngeboteValue: number
}

interface AttentionItem {
  id: string
  type: 'anfrage'
  title: string
  created_at: string
}

interface Data {
  vendorName: string
  stats: Stats
  attentionItems: AttentionItem[]
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE').format(Math.round(n)) + ' €'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return 'gerade'
  if (mins < 60) return `vor ${mins} Min.`
  if (hours < 24) return `vor ${hours} Std.`
  if (days < 7) return `vor ${days} Tagen`
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })
}

function todayGerman(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '20px',
}

const EMPTY_STATS: Stats = {
  pendingAnfragen: 0, newAnfragenThisWeek: 0, releasedOffers: 0, offersValue: 0,
  acceptedOffers: 0, upcomingEvents: 0, nextEventDays: null,
  pipelineValue: 0, pipelineAnfragenCount: 0, pipelineAnfragenValue: 0,
  pipelineAngeboteCount: 0, pipelineAngeboteValue: 0,
}

export default function UbersichtClient() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/vendor/ubersicht')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={20} className="ub-spin" style={{ color: 'var(--text-tertiary)' }} />
        <style>{`
          .ub-spin{animation:ubspin 1s linear infinite}@keyframes ubspin{to{transform:rotate(360deg)}}
          @media(max-width:860px){.ub-stat-grid{grid-template-columns:repeat(2,1fr)!important}}
          @media(max-width:480px){.ub-stat-grid{grid-template-columns:1fr!important}}
          @media(max-width:660px){.ub-bottom-grid{grid-template-columns:1fr!important}}
        `}</style>
      </div>
    )
  }

  const s = data?.stats ?? EMPTY_STATS
  const vendorName = data?.vendorName ?? ''
  const attention = data?.attentionItems ?? []
  const pipelineTotal = s.pipelineValue || 1

  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>

        {/* ── Greeting ── */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {todayGerman()}
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.1 }}>
            Guten Tag{vendorName ? `, ${vendorName}` : ''}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Hier ist dein Überblick über alle Anfragen, Angebote und Events.
          </p>
        </div>

        {/* ── 4 Stat cards ── */}
        <div className="ub-stat-grid" data-tour="vdr-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>

          {/* Offene Anfragen */}
          <Link href="/vendor/anfragen" style={{ ...card, display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Offene Anfragen</p>
            <p style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1, color: 'var(--text-primary)', marginBottom: 8 }}>
              {s.pendingAnfragen}
            </p>
            {s.newAnfragenThisWeek > 0
              ? <p style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 500 }}>+{s.newAnfragenThisWeek} diese Woche</p>
              : <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Keine neuen diese Woche</p>
            }
          </Link>

          {/* Angebote versendet */}
          <Link href="/vendor/angebote" style={{ ...card, display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Angebote versendet</p>
            <p style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1, color: 'var(--text-primary)', marginBottom: 8 }}>
              {s.releasedOffers}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {s.offersValue > 0 ? `Wert ${formatEur(s.offersValue)}` : 'Keine ausstehend'}
            </p>
          </Link>

          {/* Anstehende Events */}
          <Link href="/vendor/dashboard" style={{ ...card, display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Anstehende Events</p>
            <p style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1, color: 'var(--text-primary)', marginBottom: 8 }}>
              {s.upcomingEvents}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {s.nextEventDays === 0
                ? 'Heute'
                : s.nextEventDays != null
                ? `nächstes in ${s.nextEventDays} Tagen`
                : 'Keine bevorstehenden'}
            </p>
          </Link>

          {/* Pipeline-Wert — dark card */}
          <div style={{ ...card, background: 'var(--accent)', border: 'none' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>Pipeline-Wert</p>
            <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.8px', lineHeight: 1.15, color: '#fff', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatEur(s.pipelineValue)}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>offen · noch nicht gebucht</p>
          </div>
        </div>

        {/* ── Bottom: two columns ── */}
        <div className="ub-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'stretch' }}>

          {/* Braucht deine Aufmerksamkeit */}
          <div data-tour="vdr-attention" style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flex: 1, margin: 0 }}>
                Braucht deine Aufmerksamkeit
              </h2>
              {attention.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, background: 'var(--red)', color: '#fff',
                  borderRadius: '50%', width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {attention.length > 9 ? '9+' : attention.length}
                </span>
              )}
            </div>

            {attention.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 8 }}>
                <div style={{ opacity: 0.25 }}><Inbox size={28} /></div>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  Alles erledigt — keine offenen Anfragen.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {attention.map((item, i) => (
                  <Link
                    key={item.id}
                    href="/vendor/anfragen"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(255,149,0,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Inbox size={16} style={{ color: 'var(--orange)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
                      }}>
                        Neue Anfrage · {item.title}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {timeAgo(item.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div data-tour="vdr-pipeline" style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18, margin: '0 0 18px' }}>
              Pipeline
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Anfragen row */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Anfragen</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {s.pipelineAnfragenCount} · {formatEur(s.pipelineAnfragenValue)}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 100, background: 'var(--border2)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 100, background: 'var(--accent)',
                    width: `${Math.round((s.pipelineAnfragenValue / pipelineTotal) * 100)}%`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>

              {/* Angebote row */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Angebote</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {s.pipelineAngeboteCount} · {formatEur(s.pipelineAngeboteValue)}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 100, background: 'var(--border2)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 100, background: 'var(--accent)',
                    width: `${Math.round((s.pipelineAngeboteValue / pipelineTotal) * 100)}%`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            </div>

            {s.pipelineValue === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 16 }}>
                Noch keine Pipeline-Daten vorhanden.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
