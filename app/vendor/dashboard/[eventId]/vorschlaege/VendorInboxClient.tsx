'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Inbox, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface Proposal {
  id: string
  segment: string
  status: string
  created_at: string
  title: string | null
}

interface Recipient {
  id: string
  status: string | null
  proposal_id: string
  proposals: Proposal | null
}

const SEGMENT_LABELS: Record<string, string> = {
  catering:   'Catering',
  ablaufplan: 'Ablaufplan',
  hotel:      'Hotel',
  musik:      'Musik',
  dekoration: 'Dekoration',
  patisserie: 'Patisserie',
  vendor:     'Allgemein',
  sitzplan:   'Sitzplan',
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; color: string }> = {
  pending:   { label: 'Ausstehend',  icon: <Clock size={13} />,        bg: '#FFF8E6', color: '#B8860B' },
  accepted:  { label: 'Angenommen', icon: <CheckCircle size={13} />,  bg: '#EAF5EE', color: '#3D7A56' },
  rejected:  { label: 'Abgelehnt',  icon: <XCircle size={13} />,      bg: '#FDEAEA', color: '#A04040' },
  countered: { label: 'Gegenvorschlag', icon: <AlertCircle size={13} />, bg: '#EEF0FF', color: '#4040A0' },
}

export default function VendorInboxClient({ eventId, userId }: { eventId: string; userId: string }) {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('proposal_recipients')
      .select('id, status, proposal_id, proposals!inner(id, segment, status, created_at, title)')
      .eq('vendor_user_id', userId)
      .eq('proposals.event_id', eventId)
      .order('created_at', { ascending: false, referencedTable: 'proposals' })
      .then(({ data }) => {
        setRecipients(
          (data ?? []).map((r: { id: string; status: string | null; proposal_id: string; proposals: Proposal | Proposal[] | null }) => ({
            ...r,
            proposals: Array.isArray(r.proposals) ? (r.proposals[0] ?? null) : r.proposals,
          }))
        )
        setLoading(false)
      })
  }, [eventId, userId])

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Vorschläge</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Vom Veranstalter an Sie gesendete Vorschläge
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : recipients.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border)' }}>
          <Inbox size={36} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Keine Vorschläge</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Der Veranstalter hat noch keine Vorschläge an Sie gesendet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
          {recipients.map(r => {
            const proposal = r.proposals
            if (!proposal) return null
            const recipientStatus = r.status ?? proposal.status
            const cfg = STATUS_CONFIG[recipientStatus] ?? STATUS_CONFIG.pending
            const segment = SEGMENT_LABELS[proposal.segment] ?? proposal.segment
            const date = new Date(proposal.created_at).toLocaleDateString('de-DE', {
              day: '2-digit', month: 'long', year: 'numeric',
            })
            return (
              <div
                key={r.id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>
                    {proposal.title ?? segment}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {segment} · {date}
                  </div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 20,
                  background: cfg.bg, color: cfg.color,
                  fontSize: 12, fontWeight: 600, flexShrink: 0,
                }}>
                  {cfg.icon}
                  {cfg.label}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
