'use client'
import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ChevronRight, Package, AlertTriangle } from 'lucide-react'
import {
  type ProposalWithDetails,
  MODULE_LABELS,
  fetchProposalsForEvent,
  subscribeToProposals,
  acceptProposal,
  rejectProposal,
} from '@/lib/proposals'
import { createClient } from '@/lib/supabase/client'
import ProposalDetailSheet from '@/components/proposals/ProposalDetailSheet'

const CounterProposalSheet = dynamic(() => import('@/components/proposals/CounterProposalSheet'), { ssr: false })

interface Props {
  eventId: string
  userId: string
}

const STATUS_LABEL: Record<string, string> = {
  pending:  'Ausstehend',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
  in_case:  'In Klärung',
  draft:    'Entwurf',
}

const STATUS_COLOR: Record<string, string> = {
  pending:  'var(--gold)',
  accepted: '#16a34a',
  rejected: '#dc2626',
  in_case:  '#ea580c',
  draft:    'var(--text-tertiary)',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  return `vor ${Math.floor(hours / 24)} Tagen`
}

export default function DienstleisterVorschlaegeClient({ eventId, userId }: Props) {
  const [proposals, setProposals] = useState<ProposalWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProposalWithDetails | null>(null)
  const [counterTarget, setCounterTarget] = useState<ProposalWithDetails | null>(null)
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const all = await fetchProposalsForEvent(eventId)
    const vendorProposals = all.filter(p => p.created_by_role === 'dienstleister')
    setProposals(vendorProposals)

    const ids = Array.from(new Set(vendorProposals.map(p => p.created_by)))
    if (ids.length > 0) {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ids)
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((p: { id: string; name: string | null }) => { map[p.id] = p.name ?? 'Unbekannt' })
        setVendorNames(map)
      }
    }
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
    const unsub = subscribeToProposals(eventId, load)
    return unsub
  }, [eventId, load])

  const pendingProposals = proposals.filter(p => {
    const myRecipient = p.recipients.find(r => r.user_id === userId)
    return myRecipient?.status === 'pending'
  })
  const otherProposals = proposals.filter(p => {
    const myRecipient = p.recipients.find(r => r.user_id === userId)
    return !myRecipient || myRecipient.status !== 'pending'
  })

  const handleAccept = async (proposal: ProposalWithDetails) => {
    await acceptProposal(proposal.id)
    setSelected(null)
    load()
  }

  const handleReject = async (proposal: ProposalWithDetails) => {
    await rejectProposal(proposal.id)
    setSelected(null)
    load()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Laden…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
          Dienstleister-Vorschläge
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Eingehende Vorschläge deiner Dienstleister für dieses Event.
        </p>
      </div>

      {proposals.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: '1px dashed var(--border)', borderRadius: 12,
          color: 'var(--text-secondary)',
        }}>
          <Package size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>Noch keine Vorschläge von Dienstleistern.</p>
        </div>
      )}

      {pendingProposals.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
            Ausstehend ({pendingProposals.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingProposals.map(p => (
              <ProposalCard
                key={p.id}
                proposal={p}
                vendorName={vendorNames[p.created_by] ?? '…'}
                userId={userId}
                eventId={eventId}
                onOpen={() => setSelected(p)}
                highlighted
              />
            ))}
          </div>
        </div>
      )}

      {otherProposals.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
            Verlauf ({otherProposals.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {otherProposals.map(p => (
              <ProposalCard
                key={p.id}
                proposal={p}
                vendorName={vendorNames[p.created_by] ?? '…'}
                userId={userId}
                eventId={eventId}
                onOpen={() => setSelected(p)}
              />
            ))}
          </div>
        </div>
      )}

      {selected && (
        <ProposalDetailSheet
          proposal={selected}
          userId={userId}
          userRole="veranstalter"
          vendorName={vendorNames[selected.created_by] ?? 'Dienstleister'}
          onClose={() => setSelected(null)}
          onAccept={() => handleAccept(selected)}
          onReject={() => handleReject(selected)}
          onCounter={() => { setCounterTarget(selected); setSelected(null) }}
          onRefresh={load}
        />
      )}

      {counterTarget && (
        <CounterProposalSheet
          proposal={counterTarget}
          userId={userId}
          userRole="veranstalter"
          eventId={eventId}
          onClose={() => setCounterTarget(null)}
          onSent={() => { setCounterTarget(null); load() }}
        />
      )}
    </div>
  )
}

function ProposalCard({
  proposal, vendorName, userId, eventId, onOpen, highlighted,
}: {
  proposal: ProposalWithDetails
  vendorName: string
  userId: string
  eventId: string
  onOpen: () => void
  highlighted?: boolean
}) {
  const myRecipient = proposal.recipients.find(r => r.user_id === userId)
  const isInCase = proposal.status === 'in_case'

  if (isInCase) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 10,
        background: '#fff7ed', border: '1px solid #fed7aa',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <AlertTriangle size={18} style={{ color: '#ea580c', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {MODULE_LABELS[proposal.module]}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#ea580c', background: '#ffedd5', padding: '2px 7px', borderRadius: 100 }}>
              In Klärung
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {vendorName} · Gegenvorschlag läuft
          </div>
        </div>
        <Link
          href={`/veranstalter/${eventId}/dienstleister-vorschlaege/konflikt/${proposal.id}`}
          style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: '#ea580c', color: '#fff', textDecoration: 'none', flexShrink: 0,
          }}>
          Öffnen
        </Link>
      </div>
    )
  }

  const status = myRecipient?.status === 'pending' ? 'pending' : (proposal.status ?? 'draft')

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 10, textAlign: 'left', width: '100%',
        background: highlighted ? 'var(--surface)' : 'var(--bg)',
        border: `1px solid ${highlighted ? 'var(--gold-pale, #fef3c7)' : 'var(--border)'}`,
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: highlighted ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        transition: 'box-shadow 0.15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {MODULE_LABELS[proposal.module]}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: STATUS_COLOR[status] ?? 'var(--text-tertiary)',
            background: `${STATUS_COLOR[status] ?? 'var(--border)'}18`,
            padding: '2px 7px', borderRadius: 100,
          }}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {vendorName} · {timeAgo(proposal.created_at)}
        </div>
      </div>
      <ChevronRight size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
    </button>
  )
}
