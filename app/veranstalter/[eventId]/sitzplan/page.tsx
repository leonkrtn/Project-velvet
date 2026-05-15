'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import type { RaumPoint, RaumElement, RaumTablePool, PlacedTablePreview } from '@/components/room/RaumKonfigurator'

const RaumKonfigurator = dynamic(() => import('@/components/room/RaumKonfigurator'), { ssr: false })
const SitzplanEditor   = dynamic(() => import('@/components/sitzplan/SitzplanEditor'), { ssr: false })

type SeatingConcept = {
  id: string; name: string
  points: RaumPoint[]; elements: RaumElement[]; table_pool: RaumTablePool
}

const EMPTY_POOL: RaumTablePool = { types: [] }

function normalizePool(raw: unknown): RaumTablePool {
  if (!raw || typeof raw !== 'object') return EMPTY_POOL
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.types)) return { types: r.types as RaumTablePool['types'] }
  // Legacy format: {round: {count, diameter}, rect: {count, length, width}}
  const types: RaumTablePool['types'] = []
  const round = r.round as Record<string, number> | undefined
  const rect  = r.rect  as Record<string, number> | undefined
  if (round?.count) types.push({ id: 'legacy-round', shape: 'round', count: round.count, diameter: round.diameter ?? 1.5, length: round.diameter ?? 1.5, width: round.diameter ?? 1.5 })
  if (rect?.count)  types.push({ id: 'legacy-rect',  shape: 'rectangular', count: rect.count, diameter: 1.5, length: rect.length ?? 2.0, width: rect.width ?? 0.8 })
  return { types }
}

export default function SitzplanPage() {
  const params  = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [coupleName, setCoupleName] = useState('')

  // Room config
  const [globalPoints,   setGlobalPoints]   = useState<RaumPoint[]>([])
  const [globalElements, setGlobalElements] = useState<RaumElement[]>([])
  const [eventPoints,    setEventPoints]    = useState<RaumPoint[] | null>(null)
  const [eventElements,  setEventElements]  = useState<RaumElement[] | null>(null)
  const [eventTablePool, setEventTablePool] = useState<RaumTablePool | null>(null)
  const [hasEventConfig, setHasEventConfig] = useState(false)

  // Placed tables (for overlay in RaumKonfigurator)
  const [placedTables, setPlacedTables] = useState<PlacedTablePreview[]>([])

  // UI
  const [showConfigurator, setShowConfigurator] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved,  setConfigSaved]  = useState(false)

  // Seating concepts
  const [concepts, setConcepts] = useState<SeatingConcept[]>([])
  const [showConceptDialog, setShowConceptDialog] = useState(false)
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null)
  const [applyMode, setApplyMode] = useState<'replace' | 'merge'>('replace')
  const [applyingConcept, setApplyingConcept] = useState(false)

  useEffect(() => { load() }, [eventId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: globalRow }, { data: eventRow }, { data: eventData }, { data: tablesData }, { data: conceptRows }] = await Promise.all([
        supabase.from('organizer_room_configs').select('*').eq('user_id', user.id).single(),
        supabase.from('event_room_configs').select('*').eq('event_id', eventId).single(),
        supabase.from('events').select('couple_name').eq('id', eventId).single(),
        supabase.from('seating_tables').select('pos_x,pos_y,rotation,shape,table_length,table_width,name').eq('event_id', eventId),
        supabase.from('organizer_seating_concepts').select('id,name,points,elements,table_pool').eq('organizer_id', user.id).order('sort_order'),
      ])

      if (globalRow)  { setGlobalPoints(globalRow.points ?? []); setGlobalElements(globalRow.elements ?? []) }
      if (eventRow)   {
        setEventPoints(eventRow.points ?? [])
        setEventElements(eventRow.elements ?? [])
        setEventTablePool(normalizePool(eventRow.table_pool))
        setHasEventConfig(true)
      }
      if (eventData)  setCoupleName(eventData.couple_name ?? '')
      if (tablesData) setPlacedTables(tablesData as PlacedTablePreview[])
      setConcepts((conceptRows ?? []) as SeatingConcept[])
    } finally {
      setLoading(false)
    }
  }

  const displayPoints   = (hasEventConfig && eventPoints)   ? eventPoints   : globalPoints
  const displayElements = (hasEventConfig && eventElements) ? eventElements : globalElements
  const displayPool: RaumTablePool = eventTablePool ?? EMPTY_POOL

  const handleSaveEventConfig = useCallback(async (
    points: RaumPoint[], elements: RaumElement[], tablePool: RaumTablePool
  ) => {
    if (!userId) return
    setConfigSaving(true)
    try {
      await supabase.from('event_room_configs').upsert(
        { event_id: eventId, user_id: userId, points, elements, table_pool: tablePool, updated_at: new Date().toISOString() },
        { onConflict: 'event_id' }
      )
      setEventPoints(points); setEventElements(elements); setEventTablePool(tablePool); setHasEventConfig(true)
      setConfigSaved(true); setTimeout(() => setConfigSaved(false), 3000)
      setShowConfigurator(false)
    } finally {
      setConfigSaving(false)
    }
  }, [userId, eventId, supabase])

  async function resetToGlobal() {
    await supabase.from('event_room_configs').delete().eq('event_id', eventId)
    setEventPoints(null); setEventElements(null); setEventTablePool(null); setHasEventConfig(false)
    setShowConfigurator(false)
  }

  async function applyConceptToEvent() {
    if (!selectedConceptId || !userId) return
    const concept = concepts.find(c => c.id === selectedConceptId)
    if (!concept) return
    setApplyingConcept(true)
    try {
      if (applyMode === 'replace') {
        await supabase.from('event_room_configs').upsert(
          { event_id: eventId, user_id: userId, points: concept.points, elements: concept.elements, table_pool: concept.table_pool, updated_at: new Date().toISOString() },
          { onConflict: 'event_id' }
        )
        setEventPoints(concept.points); setEventElements(concept.elements); setEventTablePool(concept.table_pool); setHasEventConfig(true)
      } else {
        // Merge: add table pool types from concept that don't already exist (by shape/dimensions)
        const current = eventTablePool ?? { types: [] }
        const existingKeys = new Set(current.types.map(t => `${t.shape}-${t.length}-${t.width}-${t.diameter}`))
        const newTypes = (concept.table_pool.types ?? []).filter(t => !existingKeys.has(`${t.shape}-${t.length}-${t.width}-${t.diameter}`))
        const mergedPool: RaumTablePool = { types: [...current.types, ...newTypes] }
        const newPoints  = hasEventConfig ? (eventPoints ?? globalPoints) : globalPoints
        const newElements = hasEventConfig ? (eventElements ?? globalElements) : globalElements
        await supabase.from('event_room_configs').upsert(
          { event_id: eventId, user_id: userId, points: newPoints, elements: newElements, table_pool: mergedPool, updated_at: new Date().toISOString() },
          { onConflict: 'event_id' }
        )
        setEventTablePool(mergedPool); setHasEventConfig(true)
      }
      setShowConceptDialog(false); setSelectedConceptId(null)
    } finally {
      setApplyingConcept(false)
    }
  }

  if (loading) return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ height: 400, borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4 }}>Sitzplan</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            {hasEventConfig ? 'Event-spezifische Raumkonfiguration aktiv.' : 'Globale Raumkonfiguration wird angezeigt.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {concepts.length > 0 && (
            <button onClick={() => { setShowConceptDialog(true); setSelectedConceptId(concepts[0].id); setApplyMode('replace') }} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
              Konzept laden
            </button>
          )}
          {hasEventConfig && (
            <button onClick={resetToGlobal} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
              Global zurücksetzen
            </button>
          )}
          <button onClick={() => setShowConfigurator(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,0,0,0.14)',
            background: showConfigurator ? '#1D1D1F' : 'var(--surface)',
            color: showConfigurator ? '#fff' : 'var(--text)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>
            Raum konfigurieren
          </button>
        </div>
      </div>

      {/* Configurator */}
      {showConfigurator && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', marginBottom: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>Event-spezifische Raumkonfiguration</p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Diese Konfiguration gilt nur für dieses Event und überschreibt die globale Konfiguration.</p>
          </div>
          <RaumKonfigurator
            initialPoints={hasEventConfig ? (eventPoints ?? []) : globalPoints}
            initialElements={hasEventConfig ? (eventElements ?? []) : globalElements}
            initialTablePool={displayPool}
            placedTables={placedTables}
            onSave={handleSaveEventConfig}
            saving={configSaving}
            saved={configSaved}
          />
        </div>
      )}

      {/* Seating editor */}
      {!showConfigurator && (
        <SitzplanEditor
          eventId={eventId}
          canEditRoom={true}
          roomPoints={displayPoints}
          roomElements={displayElements}
          tablePool={displayPool}
          coupleName={coupleName}
        />
      )}

      {/* Concept apply dialog */}
      {showConceptDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowConceptDialog(false) }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '28px', width: 460, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Tischkonzept laden</h3>
              <button onClick={() => setShowConceptDialog(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Konzept</label>
              <select
                value={selectedConceptId ?? ''}
                onChange={e => setSelectedConceptId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none' }}
              >
                {concepts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Anwendungsmodus</label>
              {(['replace', 'merge'] as const).map(mode => (
                <label key={mode} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: `1.5px solid ${applyMode === mode ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', marginBottom: 6, background: applyMode === mode ? 'var(--accent-light)' : 'transparent' }}>
                  <input type="radio" name="applyMode" value={mode} checked={applyMode === mode} onChange={() => setApplyMode(mode)} style={{ marginTop: 2 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: applyMode === mode ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {mode === 'replace' ? 'Ersetzen' : 'Zusammenführen'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                      {mode === 'replace'
                        ? 'Raumform, Elemente und Tischpool werden vollständig durch das Konzept ersetzt.'
                        : 'Nur neue Tischtypen aus dem Konzept werden zum bestehenden Tischpool hinzugefügt.'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConceptDialog(false)} style={{ padding: '9px 18px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Abbrechen
              </button>
              <button onClick={applyConceptToEvent} disabled={applyingConcept || !selectedConceptId} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: applyingConcept ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', opacity: applyingConcept ? 0.6 : 1 }}>
                {applyingConcept ? 'Wird angewendet…' : 'Anwenden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
