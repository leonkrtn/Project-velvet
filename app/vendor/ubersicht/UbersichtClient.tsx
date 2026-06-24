'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Inbox, Calendar, ReceiptText, Check, ArrowRight, Loader2 } from 'lucide-react'

interface Stats {
  pendingAnfragen: number
  eventCount: number
  releasedOffers: number
  acceptedOffers: number
}

interface RecentAnfrage {
  id: string
  status: string
  created_at: string
  events: { title: string; date: string | null; couple_name: string | null } | null
}

interface Data {
  stats: Stats
  recentAnfragen: RecentAnfrage[]
}

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px',
}

function KpiCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href?: string }) {
  const inner = (
    <div style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(184,153,104,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.8px', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  )
  if (href) return <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{inner}</Link>
  return inner
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
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={20} className="ub-spin" style={{ color: 'var(--text-dim)' }} />
        <style>{`.ub-spin{animation:ubspin 1s linear infinite}@keyframes ubspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const stats = data?.stats ?? { pendingAnfragen: 0, eventCount: 0, releasedOffers: 0, acceptedOffers: 0 }
  const recent = data?.recentAnfragen ?? []

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Übersicht</h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 4 }}>Dein persönliches Anbieter-Dashboard.</p>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          <KpiCard
            icon={<Inbox size={18} style={{ color: 'var(--gold)' }} />}
            label="Offene Anfragen"
            value={stats.pendingAnfragen}
            href="/vendor/anfragen"
          />
          <KpiCard
            icon={<Calendar size={18} style={{ color: 'var(--gold)' }} />}
            label="Meine Events"
            value={stats.eventCount}
            href="/vendor/dashboard"
          />
          <KpiCard
            icon={<ReceiptText size={18} style={{ color: 'var(--gold)' }} />}
            label="Angebote versendet"
            value={stats.releasedOffers}
            href="/vendor/angebote"
          />
          <KpiCard
            icon={<Check size={18} style={{ color: 'var(--gold)' }} />}
            label="Aufträge angenommen"
            value={stats.acceptedOffers}
            href="/vendor/angebote"
          />
        </div>

        {/* Recent requests */}
        {recent.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Letzte Anfragen</h2>
              <Link href="/vendor/anfragen" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>
                Alle ansehen <ArrowRight size={14} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent.map(r => {
                const ev = r.events
                const title = ev?.couple_name ?? ev?.title ?? 'Anfrage'
                const date = ev?.date ? new Date(ev.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : null
                const statusMeta = r.status === 'pending'
                  ? { label: 'Offen', bg: 'rgba(184,153,104,0.14)', fg: 'var(--gold)' }
                  : r.status === 'accepted'
                  ? { label: 'Angenommen', bg: 'rgba(30,126,52,0.12)', fg: '#1E7E34' }
                  : { label: 'Erledigt', bg: 'var(--bg)', fg: 'var(--text-dim)' }
                return (
                  <Link key={r.id} href="/vendor/anfragen" style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit', transition: 'box-shadow .15s, border-color .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm, 0 4px 16px rgba(0,0,0,0.06))'; e.currentTarget.style.borderColor = 'var(--gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: statusMeta.bg, color: statusMeta.fg }}>{statusMeta.label}</span>
                      </div>
                      {date && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 3 }}>{date}</div>}
                    </div>
                    <ArrowRight size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {recent.length === 0 && stats.pendingAnfragen === 0 && (
          <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ opacity: 0.3, display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Inbox size={30} /></div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch keine Aktivität</p>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
              Sobald Brautpaare eine Anfrage stellen oder du einem Event beitrittst, erscheint hier deine Aktivität.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
