'use client'
import React, { useState } from 'react'
import { Plus, ChevronDown, Layers, Map, GitBranch, X, Check } from 'lucide-react'
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
  const supabase = createClient()
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(areas[0]?.id ?? null)
  const [addingArea, setAddingArea] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [savingArea, setSavingArea] = useState(false)
  const [addingVariant, setAddingVariant] = useState<string | null>(null) // area_id
  const [newVariantName, setNewVariantName] = useState('')

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
      // Auto-create main canvas for the area
      const { data: canvas } = await supabase.from('deko_canvases').insert({
        event_id: eventId,
        area_id: area.id,
        name: newAreaName.trim(),
        canvas_type: 'main',
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
      canvas_type: 'variant',
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

  // ── Create moodboard ──────────────────────────────────────────────────────

  async function createMoodboard() {
    const name = `Moodboard ${moodboards.length + 1}`
    const { data: canvas } = await supabase.from('deko_canvases').insert({
      event_id: eventId,
      area_id: null,
      name,
      canvas_type: 'moodboard',
    }).select().single()
    if (canvas) {
      onMoodboardsChange([...moodboards, canvas as DekoCanvas])
      onSelectCanvas(canvas.id)
    }
  }

  return (
    <nav style={{
      width: 220, minWidth: 220, flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--sidebar-bg, #FAF8F5)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
      fontSize: 13,
    }}>
      <div style={{ padding: '12px 12px 6px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>Bereiche</p>
      </div>

      {/* Areas */}
      {areas.map(area => {
        const canvases = area.canvases ?? []
        const mainCanvas = canvases.find(c => c.canvas_type === 'main')
        const variants = canvases.filter(c => c.canvas_type === 'variant')
        const isExpanded = expandedAreaId === area.id

        return (
          <div key={area.id}>
            {/* Area header */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', cursor: 'pointer',
                background: mainCanvas?.id === activeCanvasId ? 'var(--accent-light)' : 'transparent',
              }}
              onClick={() => {
                setExpandedAreaId(isExpanded ? null : area.id)
                if (mainCanvas) onSelectCanvas(mainCanvas.id)
              }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: area.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{area.name}</span>
              {mainCanvas?.is_frozen && <span title="Eingefroren" style={{ fontSize: 10 }}>🔒</span>}
              {variants.length > 0 && (
                <button onClick={e => { e.stopPropagation(); setExpandedAreaId(isExpanded ? null : area.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '.15s' }} />
                </button>
              )}
            </div>

            {/* Variants */}
            {isExpanded && variants.map(v => (
              <div key={v.id}
                onClick={() => onSelectCanvas(v.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px 5px 28px',
                  cursor: 'pointer', fontSize: 12,
                  background: v.id === activeCanvasId ? 'var(--accent-light)' : 'transparent',
                  color: 'var(--text-secondary)',
                }}>
                <GitBranch size={11} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                {v.is_frozen && <span style={{ fontSize: 10 }}>🔒</span>}
              </div>
            ))}

            {/* Add variant inline input */}
            {addingVariant === area.id && (
              <div style={{ padding: '4px 8px 4px 28px', display: 'flex', gap: 4 }}>
                <input autoFocus value={newVariantName} onChange={e => setNewVariantName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createVariant(area.id); if (e.key === 'Escape') setAddingVariant(null) }}
                  placeholder="Variante…" style={{ ...inlineInputStyle, flex: 1 }} />
                <button onClick={() => createVariant(area.id)} style={miniBtn}><Check size={11} /></button>
                <button onClick={() => setAddingVariant(null)} style={miniBtn}><X size={11} /></button>
              </div>
            )}

            {/* Add variant button */}
            {isExpanded && canEdit && addingVariant !== area.id && (
              <button onClick={() => { setAddingVariant(area.id); setNewVariantName('') }}
                style={{ ...ghostRowStyle, paddingLeft: 28 }}>
                <GitBranch size={11} /> <span>Variante hinzufügen</span>
              </button>
            )}
          </div>
        )
      })}

      {/* Add area */}
      {canEdit && (
        addingArea
          ? <div style={{ padding: '6px 8px', display: 'flex', gap: 4, borderTop: '1px dashed var(--border)' }}>
            <input autoFocus value={newAreaName} onChange={e => setNewAreaName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createArea(); if (e.key === 'Escape') setAddingArea(false) }}
              placeholder="Bereich…" style={{ ...inlineInputStyle, flex: 1 }} />
            <button onClick={createArea} disabled={savingArea} style={miniBtn}><Check size={11} /></button>
            <button onClick={() => setAddingArea(false)} style={miniBtn}><X size={11} /></button>
          </div>
          : <button onClick={() => setAddingArea(true)} style={ghostRowStyle}>
            <Plus size={12} /> <span>Bereich hinzufügen</span>
          </button>
      )}

      {/* Moodboards */}
      <div style={{ padding: '12px 12px 6px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginTop: 8 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>Moodboards</p>
      </div>
      {moodboards.map(mb => (
        <div key={mb.id}
          onClick={() => onSelectCanvas(mb.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer',
            background: mb.id === activeCanvasId ? 'var(--accent-light)' : 'transparent',
          }}>
          <Map size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mb.name}</span>
        </div>
      ))}
      {canEdit && (
        <button onClick={createMoodboard} style={ghostRowStyle}>
          <Plus size={12} /> <span>Moodboard hinzufügen</span>
        </button>
      )}
    </nav>
  )
}

const ghostRowStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'none', border: 'none',
  cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)',
  fontFamily: 'inherit', textAlign: 'left',
}
const inlineInputStyle: React.CSSProperties = {
  fontSize: 12, padding: '4px 6px', border: '1px solid var(--border)',
  borderRadius: 4, fontFamily: 'inherit', outline: 'none',
}
const miniBtn: React.CSSProperties = {
  width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 4,
  background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
