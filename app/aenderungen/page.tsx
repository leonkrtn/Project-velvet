'use client'
import React, { useEffect, useState } from 'react'
import { useEvent } from '@/lib/event-context'
import {
  fetchPendingChanges,
  resolvePendingChange,
  submitPendingChange,
} from '@/lib/db/events'
import type { PendingChange } from '@/lib/types/approvals'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'

const AREA_LABELS: Record<string, string> = {
  catering: 'Catering',
  budget: 'Budget',
  seating: 'Sitzplan',
  dienstleister: 'Dienstleister',
  guests: 'Gäste',
  timeline: 'Ablauf',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: '#fff3cd', color: '#92400e', label: 'Ausstehend' },
    approved: { bg: '#d4edda', color: '#15803d', label: 'Genehmigt' },
    rejected: { bg: '#fde8e8', color: '#b91c1c', label: 'Abgelehnt' },
  }
  const s = cfg[status] ?? { bg: '#f3f4f6', color: '#374151', label: status }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: s.bg, color: s.color, padding: '2px 7px', borderRadius: 6 }}>
      {s.label}
    </span>
  )
}

export default function AenderungenPage() {
  const { event, currentRole } = useEvent()
  const [changes, setChanges] = useState<PendingChange[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const canReview = currentRole === 'veranstalter' || currentRole === 'brautpaar'

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!event?.id) return
    fetchPendingChanges(event.id).then(data => {
      setChanges(data)
      setLoading(false)
    })
  }, [event?.id])

  async function resolve(id: string, status: 'approved' | 'rejected') {
    setResolving(id)
    await resolvePendingChange(id, status, noteMap[id])
    setChanges(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    setResolving(null)
  }

  const mine = changes.filter(c => c.proposedBy === currentUserId)
  const toReview = changes.filter(c => c.status === 'pending' && c.proposedBy !== currentUserId)

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        Änderungsvorschläge
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
        Vorschläge für Änderungen in kritischen Bereichen.
      </p>

      {loading && <p style={{ fontSize: 14, color: 'var(--text-dim)', textAlign: 'center', marginTop: 40 }}>Lädt…</p>}

      {/* To review section */}
      {canReview && toReview.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold)', marginBottom: 10 }}>
            Zu genehmigen ({toReview.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {toReview.map(c => (
              <ChangeCard
                key={c.id}
                change={c}
                canReview={canReview}
                resolving={resolving}
                note={noteMap[c.id] ?? ''}
                onNoteChange={v => setNoteMap(p => ({ ...p, [c.id]: v }))}
                onApprove={() => resolve(c.id, 'approved')}
                onReject={() => resolve(c.id, 'rejected')}
              />
            ))}
          </div>
        </div>
      )}

      {/* My proposals */}
      {mine.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>
            Meine Vorschläge
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mine.map(c => (
              <ChangeCard key={c.id} change={c} canReview={false} resolving={resolving} note="" onNoteChange={() => {}} onApprove={() => {}} onReject={() => {}} />
            ))}
          </div>
        </div>
      )}

      {!loading && changes.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Keine Vorschläge vorhanden.</p>
        </div>
      )}
    </div>
  )
}

function ChangeCard({
  change, canReview, resolving, note, onNoteChange, onApprove, onReject,
}: {
  change: PendingChange
  canReview: boolean
  resolving: string | null
  note: string
  onNoteChange: (v: string) => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {AREA_LABELS[change.area] ?? change.area}
        </span>
        <StatusBadge status={change.status} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>{fmtDate(change.createdAt)}</span>
      </div>
      {change.changeData.description && (
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 10px' }}>{change.changeData.description}</p>
      )}

      {canReview && change.status === 'pending' && (
        <>
          <input
            type="text"
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Anmerkung (optional)"
            style={{
              width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid var(--border)',
              borderRadius: 8, background: '#fff', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onApprove}
              disabled={resolving === change.id}
              style={{
                flex: 1, padding: '9px', background: '#15803d', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Genehmigen
            </button>
            <button
              onClick={onReject}
              disabled={resolving === change.id}
              style={{
                flex: 1, padding: '9px', background: '#fff', color: '#b91c1c', border: '1px solid #b91c1c',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Ablehnen
            </button>
          </div>
        </>
      )}

      {change.reviewNote && (
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, fontStyle: 'italic' }}>
          Anmerkung: {change.reviewNote}
        </p>
      )}
    </div>
  )
}
