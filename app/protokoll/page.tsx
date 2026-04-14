'use client'
import React, { useEffect, useState } from 'react'
import { useEvent } from '@/lib/event-context'
import { fetchAuditLog } from '@/lib/db/events'
import type { AuditEntry } from '@/lib/types/audit'

const ROLE_LABELS: Record<string, string> = {
  veranstalter: 'Veranstalter',
  brautpaar: 'Brautpaar',
  trauzeuge: 'Trauzeuge',
  dienstleister: 'Dienstleister',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Erstellt',
  update: 'Geändert',
  delete: 'Gelöscht',
  approve: 'Genehmigt',
  reject: 'Abgelehnt',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    create: '#d4f5e9', update: '#fff3cd', delete: '#fde8e8', approve: '#d4edda', reject: '#fde8e8',
  }
  const textColors: Record<string, string> = {
    create: '#15803d', update: '#92400e', delete: '#b91c1c', approve: '#15803d', reject: '#b91c1c',
  }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
      background: colors[action] ?? '#f3f4f6', color: textColors[action] ?? '#374151',
      padding: '2px 7px', borderRadius: 6,
    }}>
      {ACTION_LABELS[action] ?? action}
    </span>
  )
}

export default function ProtokollPage() {
  const { event, currentRole } = useEvent()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!event?.id) return
    fetchAuditLog(event.id).then(data => {
      setEntries(data)
      setLoading(false)
    })
  }, [event?.id])

  if (!currentRole || !['veranstalter', 'brautpaar'].includes(currentRole)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Kein Zugriff.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: 600, margin: '0 auto' }}>
      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        Änderungsprotokoll
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
        Alle aufgezeichneten Aktionen in diesem Event.
      </p>

      {loading && (
        <p style={{ fontSize: 14, color: 'var(--text-dim)', textAlign: 'center', marginTop: 40 }}>Lädt…</p>
      )}

      {!loading && entries.length === 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: 32, textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Noch keine Einträge vorhanden.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(entry => (
          <div key={entry.id} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', padding: '14px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <ActionBadge action={entry.action} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {ROLE_LABELS[entry.actorRole ?? ''] ?? entry.actorRole}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>
                {fmtDate(entry.createdAt)}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
              Tabelle: <strong>{entry.tableName}</strong>
              {entry.recordId && <span style={{ color: 'var(--text-dim)', fontSize: 11 }}> · {entry.recordId.slice(0, 8)}…</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
