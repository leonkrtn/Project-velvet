'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumElement, RaumTablePool, PlacedTablePreview } from '@/components/room/RaumKonfigurator'

const RaumKonfigurator = dynamic(() => import('@/components/room/RaumKonfigurator'), { ssr: false })
const SitzplanEditor   = dynamic(() => import('@/components/sitzplan/SitzplanEditor'), { ssr: false })

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

  useEffect(() => { load() }, [eventId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: globalRow }, { data: eventRow }, { data: eventData }, { data: tablesData }] = await Promise.all([
        supabase.from('organizer_room_configs').select('*').eq('user_id', user.id).single(),
        supabase.from('event_room_configs').select('*').eq('event_id', eventId).single(),
        supabase.from('events').select('couple_name').eq('id', eventId).single(),
        supabase.from('seating_tables').select('pos_x,pos_y,rotation,shape,table_length,table_width,name').eq('event_id', eventId),
      ])

      if (globalRow)  { setGlobalPoints(globalRow.points ?? []); setGlobalElements(globalRow.elements ?? []) }
      if (eventRow)   {
        setEventPoints(eventRow.points ?? [])
        setEventElements(eventRow.elements ?? [])
        setEventTablePool(eventRow.table_pool ?? null)
        setHasEventConfig(true)
      }
      if (eventData)  setCoupleName(eventData.couple_name ?? '')
      if (tablesData) setPlacedTables(tablesData as PlacedTablePreview[])
    } finally {
      setLoading(false)
    }
  }

  const displayPoints   = (hasEventConfig && eventPoints)   ? eventPoints   : globalPoints
  const displayElements = (hasEventConfig && eventElements) ? eventElements : globalElements
  const displayPool: RaumTablePool = eventTablePool ?? { types: [] }

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
    </div>
  )
}
