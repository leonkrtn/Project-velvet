'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { RaumPoint, RaumElement } from '@/components/room/RaumKonfigurator'

const RaumViewer = dynamic(() => import('@/components/room/RaumViewer'), { ssr: false })
const RaumKonfigurator = dynamic(() => import('@/components/room/RaumKonfigurator'), { ssr: false })

export default function SitzplanPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  /* Global room (organizer-wide) */
  const [globalPoints, setGlobalPoints] = useState<RaumPoint[]>([])
  const [globalElements, setGlobalElements] = useState<RaumElement[]>([])

  /* Event-specific room override */
  const [eventPoints, setEventPoints] = useState<RaumPoint[] | null>(null)
  const [eventElements, setEventElements] = useState<RaumElement[] | null>(null)
  const [hasEventConfig, setHasEventConfig] = useState(false)

  /* UI */
  const [showDimensions, setShowDimensions] = useState(true)
  const [showConfigurator, setShowConfigurator] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)

  useEffect(() => { load() }, [eventId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: globalRow }, { data: eventRow }] = await Promise.all([
        supabase.from('organizer_room_configs').select('*').eq('user_id', user.id).single(),
        supabase.from('event_room_configs').select('*').eq('event_id', eventId).single(),
      ])

      if (globalRow) { setGlobalPoints(globalRow.points ?? []); setGlobalElements(globalRow.elements ?? []) }
      if (eventRow) {
        setEventPoints(eventRow.points ?? [])
        setEventElements(eventRow.elements ?? [])
        setHasEventConfig(true)
      }
    } finally {
      setLoading(false)
    }
  }

  /* Which room to display: event-specific if set, else global */
  const displayPoints   = (hasEventConfig && eventPoints) ? eventPoints   : globalPoints
  const displayElements = (hasEventConfig && eventElements) ? eventElements : globalElements

  const handleSaveEventConfig = useCallback(async (points: RaumPoint[], elements: RaumElement[]) => {
    if (!userId) return
    setConfigSaving(true)
    try {
      await supabase.from('event_room_configs').upsert(
        { event_id: eventId, user_id: userId, points, elements, updated_at: new Date().toISOString() },
        { onConflict: 'event_id' }
      )
      setEventPoints(points); setEventElements(elements); setHasEventConfig(true)
      setConfigSaved(true); setTimeout(() => setConfigSaved(false), 3000)
      setShowConfigurator(false)
    } finally {
      setConfigSaving(false)
    }
  }, [userId, eventId, supabase])

  async function resetToGlobal() {
    if (!eventId) return
    await supabase.from('event_room_configs').delete().eq('event_id', eventId)
    setEventPoints(null); setEventElements(null); setHasEventConfig(false)
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
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, gap:16, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:'-0.5px', marginBottom:4 }}>Sitzplan</h1>
          <p style={{ fontSize:14, color:'var(--text-secondary)', margin:0 }}>
            {hasEventConfig
              ? 'Event-spezifische Raumkonfiguration aktiv.'
              : 'Globale Raumkonfiguration wird angezeigt.'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {hasEventConfig && (
            <button onClick={resetToGlobal} style={{ padding:'8px 14px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'none', cursor:'pointer', fontSize:13, color:'var(--text-secondary)', fontFamily:'inherit' }}>
              Global zurücksetzen
            </button>
          )}
          <button onClick={() => setShowConfigurator(v => !v)} style={{
            display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
            borderRadius:'var(--radius-sm)', border:'1px solid rgba(0,0,0,0.14)',
            background: showConfigurator ? '#1D1D1F' : 'var(--surface)',
            color: showConfigurator ? '#fff' : 'var(--text)',
            cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'inherit',
            boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>
            Raum konfigurieren
          </button>
        </div>
      </div>

      {/* Configurator (event-specific override) */}
      {showConfigurator && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'24px', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <p style={{ fontSize:15, fontWeight:700, margin:'0 0 2px' }}>Event-spezifische Raumkonfiguration</p>
              <p style={{ fontSize:12, color:'var(--text-tertiary)', margin:0 }}>Diese Konfiguration gilt nur für dieses Event und überschreibt die globale Konfiguration.</p>
            </div>
          </div>
          <RaumKonfigurator
            initialPoints={hasEventConfig ? (eventPoints ?? []) : globalPoints}
            initialElements={hasEventConfig ? (eventElements ?? []) : globalElements}
            onSave={handleSaveEventConfig}
            saving={configSaving}
            saved={configSaved}
          />
        </div>
      )}

      {/* Read-only room view */}
      {!showConfigurator && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
          {/* Toolbar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)' }}>Grundriss</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Maße anzeigen</span>
              <div
                onClick={() => setShowDimensions(v => !v)}
                style={{
                  position:'relative', width:40, height:22,
                  background: showDimensions ? '#1D1D1F' : '#AEAEB2',
                  borderRadius:11, cursor:'pointer', transition:'background 0.2s', flexShrink:0,
                }}>
                <div style={{
                  position:'absolute', top:3, left:3, width:16, height:16,
                  background:'#fff', borderRadius:'50%', transition:'transform 0.2s',
                  transform: showDimensions ? 'translateX(18px)' : 'translateX(0)',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                }}/>
              </div>
            </div>
          </div>

          {displayPoints.length < 3 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:360, gap:12, color:'var(--text-secondary)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity:0.3 }}><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Kein Raum konfiguriert</p>
                <p style={{ fontSize:13, color:'var(--text-tertiary)' }}>
                  Konfiguriere zuerst den Raum unter{' '}
                  <a href="/veranstalter/konfiguration" style={{ color:'var(--accent)', textDecoration:'none', fontWeight:500 }}>Konfiguration</a>
                  {' '}oder erstelle eine event-spezifische Konfiguration oben rechts.
                </p>
              </div>
            </div>
          ) : (
            <RaumViewer
              points={displayPoints}
              elements={displayElements}
              showDimensions={showDimensions}
            />
          )}
        </div>
      )}
    </div>
  )
}
