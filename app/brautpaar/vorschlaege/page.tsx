'use client'
import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Package, ChevronRight, AlertTriangle } from 'lucide-react'
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

export default function BrautpaarVorschlaegePage() {
  const [eventId, setEventId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [proposals, setProposals] = useState<ProposalWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProposalWithDetails | null>(null)
  const [counterTarget, setCounterTarget] = useState<ProposalWithDetails | null>(null)
  const [proposerNames, setProposerNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const { data: members } = await supabase
        .from('event_members')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('role', 'brautpaar')
        .limit(1)
        .single()

      if (members?.event_id) setEventId(members.event_id)
    })
  }, [])

  const load = useCallback(async () => {
    if (!eventId || !userId) return
    const all = await fetchProposalsForEvent(eventId)
    const myProposals = all.filter(p =>
      p.recipients.some(r => r.user_id === userId) ||
      p.created_by === userId
    )
    setProposals(myProposals)

    const ids = Array.from(new Set(myProposals.map(p => p.created_by).filter(id => id !== userId)))
    if (ids.length > 0) {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('id, name').in('id', ids)
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((p: { id: string; name: string | null }) => { map[p.id] = p.name ?? 'Unbekannt' })
        setProposerNames(map)
      }
    }
    setLoading(false)
  }, [eventId, userId])

  useEffect(() => {
    if (!eventId) return
    load()
    const unsub = subscribeToProposals(eventId, load)
    return unsub
  }, [eventId, load])

  const handleAccept = async (proposal: ProposalWithDetails) => {
    if (!userId) return
    await acceptProposal(proposal.id)
    setSelected(null)
    load()
  }

  const handleReject = async (proposal: ProposalWithDetails) => {
    if (!userId) return
    await rejectProposal(proposal.id)
    setSelected(null)
    load()
  }

  const pendingProposals = proposals.filter(p => {
    const myRecipient = p.recipients.find(r => r.user_id === userId)
    return myRecipient?.status === 'pending'
  })
  const otherProposals = proposals.filter(p => {
    const myRecipient = p.recipients.find(r => r.user_id === userId)
    return !myRecipient || myRecipient.status !== 'pending'
  })

  const proposerLabel = (proposal: ProposalWithDetails) => {
    if (proposal.created_by_role === 'dienstleister') return proposerNames[proposal.created_by] ?? 'Dienstleister'
    if (proposal.created_by_role === 'veranstalter') return 'Veranstalter'
    return 'Du'
  }

  if (loading && !eventId) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Laden…</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 20px 80px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
        Vorschläge
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
        Vorschläge von Veranstalter und Dienstleistern.
      </p>

      {proposals.length === 0 && !loading && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: '1px dashed var(--border)', borderRadius: 14,
          color: 'var(--text-dim)',
        }}>
          <Package size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>Noch keine Vorschläge vorhanden.</p>
        </div>
      )}

      {pendingProposals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 10 }}>
            Ausstehend ({pendingProposals.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingProposals.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14, textAlign: 'left', width: '100%',
                  background: 'var(--surface)',
                  border: '1px solid var(--gold-pale, #fef3c7)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {MODULE_LABELS[p.module]}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: 'var(--gold)', background: 'var(--gold-pale)', padding: '2px 7px', borderRadius: 100,
                    }}>
                      Neu
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    Von {proposerLabel(p)} · {timeAgo(p.created_at)}
                  </div>
                </div>
                <ChevronRight size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {otherProposals.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 10 }}>
            Verlauf ({otherProposals.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {otherProposals.map(p => {
              const myRecipient = p.recipients.find(r => r.user_id === userId)
              const status = myRecipient?.status === 'pending' ? 'pending' : (p.status ?? 'draft')

              if (p.status === 'in_case') {
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14,
                    background: '#fff7ed', border: '1px solid #fed7aa',
                  }}>
                    <AlertTriangle size={18} style={{ color: '#ea580c', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                          {MODULE_LABELS[p.module]}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#ea580c', background: '#ffedd5', padding: '2px 7px', borderRadius: 100 }}>
                          In Klärung
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        Gegenvorschlag läuft
                      </div>
                    </div>
                    <Link
                      href={`/brautpaar/vorschlaege/konflikt/${p.id}`}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#ea580c', color: '#fff', textDecoration: 'none', flexShrink: 0 }}>
                      Öffnen
                    </Link>
                  </div>
                )
              }

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14, textAlign: 'left', width: '100%',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        {MODULE_LABELS[p.module]}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: STATUS_COLOR[status] ?? 'var(--text-tertiary)',
                        background: `${STATUS_COLOR[status]}18`,
                        padding: '2px 7px', borderRadius: 100,
                      }}>
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      Von {proposerLabel(p)} · {timeAgo(p.created_at)}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selected && userId && (
        <ProposalDetailSheet
          proposal={selected}
          userId={userId}
          userRole="brautpaar"
          vendorName={proposerNames[selected.created_by]}
          onClose={() => setSelected(null)}
          onAccept={() => handleAccept(selected)}
          onReject={() => handleReject(selected)}
          onCounter={() => { setCounterTarget(selected); setSelected(null) }}
          onRefresh={load}
        />
      )}

      {counterTarget && userId && eventId && (
        <CounterProposalSheet
          proposal={counterTarget}
          userId={userId}
          userRole="brautpaar"
          eventId={eventId}
          onClose={() => setCounterTarget(null)}
          onSent={() => { setCounterTarget(null); load() }}
        />
      )}
    </div>
  )
}
