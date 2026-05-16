'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Table { id: string; name: string | null; capacity: number | null }
interface Assignment { table_id: string; guest_id: string; guests: { name: string } | null }

export default function SeatingTab({ eventId }: { eventId: string }) {
  const [tables, setTables]   = useState<Table[]>([])
  const [assigns, setAssigns] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('seating_tables').select('id, name, capacity').eq('event_id', eventId).order('name')
      .then(async ({ data: t }) => {
        setTables(t ?? [])
        if (!t?.length) { setLoading(false); return }
        const ids = t.map(x => x.id)
        const { data: a } = await supabase.from('seating_assignments').select('table_id, guest_id, guests(name)').in('table_id', ids)
        setAssigns((a ?? []) as unknown as Assignment[])
        setLoading(false)
      })
  }, [eventId])

  function guestsAtTable(tableId: string) {
    return assigns.filter(a => a.table_id === tableId).map(a => (a.guests as any)?.name ?? '—')
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Tischordnung</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{tables.length} Tische · {assigns.length} platzierte Gäste</p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius)' }} />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
          Noch keine Tischordnung hinterlegt.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {tables.map(t => {
            const seated = guestsAtTable(t.id)
            return (
              <div key={t.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{t.name ?? 'Tisch'}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', background: '#F0F0F2', padding: '2px 8px', borderRadius: 4 }}>
                    {seated.length} / {t.capacity ?? '?'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {seated.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Keine Platzierungen</span>
                  ) : seated.map((name, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', borderBottom: i < seated.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
