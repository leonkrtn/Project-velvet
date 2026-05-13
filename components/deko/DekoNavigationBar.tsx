'use client'
import React, { useState, useEffect, useRef } from 'react'
import { Plus, ChevronDown, Map, GitBranch, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DekoArea, DekoCanvas, CanvasType } from '@/lib/deko/types'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  eventId: string
  areas: DekoArea[]
  moodboards: DekoCanvas[]
  activeCanvasId: string | null
  onSelectCanvas: (canvasId: string) => void
  canEdit: boolean
  onAreasChange: (areas: DekoArea[]) => void
  onMoodboardsChange: (mbs: DekoCanvas[]) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DekoNavigationBar({
  eventId, areas, moodboards, activeCanvasId,
  onSelectCanvas, canEdit, onAreasChange, onMoodboardsChange,
}: Props) {
  const AREA_SUGGESTIONS = [
    'Eingang', 'Empfang', 'Trauung', 'Cocktailstunde', 'Festsaal',
    'Haupttafel', 'Buffet', 'Tanzfläche', 'Bar', 'Lounge',
    'Außenbereich', 'Patisserie-Tisch', 'Brautpaarplatz', 'Sektempfang',
  ]

  const supabase = createClient()
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(areas[0]?.id ?? null)
  const [addingArea, setAddingArea] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [savingArea, setSavingArea] = useState(false)
  const [addingVariant, setAddingVariant] = useState<string | null>(null)
  const [newVariantName, setNewVariantName] = useState('')
  const moodboardCreated = useRef(false)

  // Keep expandedAreaId in sync when areas change (e.g. first area added)
  useEffect(() => {
    setExpandedAreaId(prev => {
      if (prev) return prev
      return areas[0]?.id ?? null
    })
  }, [areas])

  // Auto-create a single moodboard if none exists; trim duplicates to one
  useEffect(() => {
    if (!canEdit || moodboardCreated.current) return
    moodboardCreated.current = true
    async function syncMoodboard() {
      const { data: existing } = await supabase
        .from('deko_canvases')
        .select('id, name, canvas_type, area_id, is_frozen, event_id, created_at')
        .eq('event_id', eventId)
        .eq('canvas_type', 'moodboard')
        .order('created_at', { ascending: true })
      if (!existing) return

      if (existing.length > 1) {
        // Keep the oldest, delete the rest
        const toDelete = existing.slice(1).map(c => c.id)
        await Promise.all(toDelete.map(id => supabase.from('deko_canvases').delete().eq('id', id)))
        onMoodboardsChange([existing[0] as DekoCanvas])
        if (toDelete.includes(activeCanvasId ?? '')) onSelectCanvas(existing[0].id)
      } else if (existing.length === 1) {
        onMoodboardsChange([existing[0] as DekoCanvas])
      } else {
        // Create one
        const { data: canvas } = await supabase.from('deko_canvases').insert({
          event_id: eventId, area_id: null,
          name: 'Moodboard', canvas_type: 'moodboard' as CanvasType,
        }).select().single()
        if (canvas) {
          onMoodboardsChange([canvas as DekoCanvas])
          if (!activeCanvasId) onSelectCanvas(canvas.id)
        }
      }
    }
    syncMoodboard()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Create area ───────────────────────────────────────────────────────────

  async function createArea() {
    if (!newAreaName.trim()) return
    setSavingArea(true)
    const { data: area } = await supabase.from('deko_areas').insert({
      event_id: eventId,
      name: newAreaName.trim(),
      sort_order: areas.length,
    }).select().single()
    if (area) {
      const { data: canvas } = await supabase.from('deko_canvases').insert({
        event_id: eventId,
        area_id: area.id,
        name: newAreaName.trim(),
        canvas_type: 'main' as CanvasType,
      }).select().single()
      if (canvas) {
        const newArea = { ...area, canvases: [canvas] } as DekoArea
        onAreasChange([...areas, newArea])
        onSelectCanvas(canvas.id)
        setExpandedAreaId(area.id)
      }
    }
    setNewAreaName('')
    setAddingArea(false)
    setSavingArea(false)
  }

  // ── Create variant ────────────────────────────────────────────────────────

  async function createVariant(areaId: string) {
    if (!newVariantName.trim()) return
    const { data: canvas } = await supabase.from('deko_canvases').insert({
      event_id: eventId,
      area_id: areaId,
      name: newVariantName.trim(),
      canvas_type: 'variant' as CanvasType,
    }).select().single()
    if (canvas) {
      onAreasChange(areas.map(a => a.id === areaId ? {
        ...a, canvases: [...(a.canvases ?? []), canvas as DekoCanvas],
      } : a))
      onSelectCanvas(canvas.id)
    }
    setAddingVariant(null)
    setNewVariantName('')
  }

  return (
    <nav style={{
      width: 220, minWidth: 220, flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--sidebar-bg, #FAF8F5)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* ── Areas section ── */}
      <div style={{ padding: '12px 12px 6px' }}>
        <p style={sectionLabel}>Bereiche</p>
      </div>

      {areas.map(area => {
        const canvases = area.canvases ?? []
        const mainCanvas = canvases.find(c => c.canvas_type === 'main')
        const variants = canvases.filter(c => c.canvas_type === 'variant')
        const isExpanded = expandedAreaId === area.id
        const isMainActive = mainCanvas?.id === activeCanvasId

        return (
          <div key={area.id}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', cursor: 'pointer',
                background: isMainActive ? 'rgba(201,185,154,0.15)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onClick={() => {
                setExpandedAreaId(isExpanded && variants.length > 0 ? null : area.id)
                if (mainCanvas) onSelectCanvas(mainCanvas.id)
              }}
            >
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: area.color || '#C9B99A', flexShrink: 0,
              }} />
              <span style={{
                flex: 1, fontWeight: isMainActive ? 600 : 500, fontSize: 13,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: isMainActive ? 'var(--accent, #C9B99A)' : 'var(--text)',
              }}>
                {area.name}
              </span>
              {mainCanvas?.is_frozen && <span title="Eingefroren" style={{ fontSize: 10 }}>🔒</span>}
              {variants.length > 0 && (
                <ChevronDown size={12} color="var(--text-tertiary)"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '.15s', flexShrink: 0 }} />
              )}
            </div>

            {isExpanded && variants.map(v => (
              <div key={v.id}
                onClick={() => onSelectCanvas(v.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px 5px 28px', cursor: 'pointer', fontSize: 12,
                  background: v.id === activeCanvasId ? 'rgba(201,185,154,0.12)' : 'transparent',
                  color: v.id === activeCanvasId ? 'var(--accent, #C9B99A)' : 'var(--text-secondary)',
                  fontWeight: v.id === activeCanvasId ? 600 : 400,
                }}>
                <GitBranch size={10} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                {v.is_frozen && <span style={{ fontSize: 10 }}>🔒</span>}
              </div>
            ))}

            {addingVariant === area.id && (
              <div style={{ padding: '4px 8px 4px 28px', display: 'flex', gap: 4 }}>
                <input autoFocus value={newVariantName} onChange={e => setNewVariantName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createVariant(area.id); if (e.key === 'Escape') setAddingVariant(null) }}
                  placeholder="Variante…" style={inlineInputStyle} />
                <button onClick={() => createVariant(area.id)} style={miniBtn}><Check size={10} /></button>
                <button onClick={() => setAddingVariant(null)} style={miniBtn}><X size={10} /></button>
              </div>
            )}

            {isExpanded && canEdit && addingVariant !== area.id && (
              <button onClick={() => { setAddingVariant(area.id); setNewVariantName('') }}
                style={{ ...ghostRowStyle, paddingLeft: 28, fontSize: 11 }}>
                <GitBranch size={10} /> <span>Variante hinzufügen</span>
              </button>
            )}
          </div>
        )
      })}

      {canEdit && (
        addingArea
          ? <div style={{ padding: '6px 8px', borderTop: '1px dashed var(--border)' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <input autoFocus value={newAreaName} onChange={e => setNewAreaName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createArea(); if (e.key === 'Escape') setAddingArea(false) }}
                placeholder="Bereichsname…" style={{ ...inlineInputStyle, flex: 1 }} />
              <button onClick={createArea} disabled={savingArea} style={miniBtn}><Check size={10} /></button>
              <button onClick={() => setAddingArea(false)} style={miniBtn}><X size={10} /></button>
            </div>
            {/* Suggestion chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {AREA_SUGGESTIONS
                .filter(s => !areas.some(a => a.name.toLowerCase() === s.toLowerCase()))
                .slice(0, 8)
                .map(s => (
                  <button key={s} onClick={() => setNewAreaName(s)}
                    style={{ fontSize: 10, padding: '2px 7px', border: '1px solid var(--border)', borderRadius: 10, background: newAreaName === s ? 'rgba(201,185,154,0.2)' : 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                    {s}
                  </button>
                ))}
            </div>
          </div>
          : <button onClick={() => setAddingArea(true)} style={ghostRowStyle}>
            <Plus size={11} /> <span>Bereich hinzufügen</span>
          </button>
      )}

      {/* ── Moodboard section — always exactly one, auto-created ── */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '10px 12px 6px' }}>
          <p style={sectionLabel}>Moodboard</p>
        </div>
        {moodboards.map(mb => (
          <div key={mb.id}
            onClick={() => onSelectCanvas(mb.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', cursor: 'pointer',
              background: mb.id === activeCanvasId ? 'rgba(201,185,154,0.15)' : 'transparent',
            }}>
            <Map size={12} style={{ color: mb.id === activeCanvasId ? 'var(--accent, #C9B99A)' : 'var(--text-secondary)', flexShrink: 0 }} />
            <span style={{
              fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: mb.id === activeCanvasId ? 'var(--accent, #C9B99A)' : 'var(--text)',
              fontWeight: mb.id === activeCanvasId ? 600 : 400,
            }}>
              {mb.name}
            </span>
          </div>
        ))}
        {moodboards.length === 0 && (
          <p style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-tertiary)' }}>Wird erstellt…</p>
        )}
      </div>
    </nav>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: 0,
}

const ghostRowStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', background: 'none', border: 'none',
  cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)',
  fontFamily: 'inherit', textAlign: 'left',
}

const inlineInputStyle: React.CSSProperties = {
  fontSize: 12, padding: '4px 6px', border: '1px solid var(--border)',
  borderRadius: 4, fontFamily: 'inherit', outline: 'none',
  background: 'var(--surface)', flex: 1,
}

const miniBtn: React.CSSProperties = {
  width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 4,
  background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}
