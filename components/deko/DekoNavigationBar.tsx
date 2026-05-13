'use client'
import React, { useState, useEffect, useRef } from 'react'
import { Plus, ChevronDown, Map, GitBranch, X, Check, Trash2 } from 'lucide-react'
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
  const [deleteConfirm, setDeleteConfirm] = useState<
    | { kind: 'area'; area: DekoArea }
    | { kind: 'variant'; areaId: string; canvas: DekoCanvas }
    | null
  >(null)
  const [deleting, setDeleting] = useState(false)
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

  // ── Create variant (copies main canvas items) ─────────────────────────────

  async function createVariant(areaId: string) {
    if (!newVariantName.trim()) return
    const { data: canvas } = await supabase.from('deko_canvases').insert({
      event_id: eventId,
      area_id: areaId,
      name: newVariantName.trim(),
      canvas_type: 'variant' as CanvasType,
    }).select().single()
    if (canvas) {
      // Copy items from the main canvas of this area
      const area = areas.find(a => a.id === areaId)
      const mainCanvas = area?.canvases?.find(c => c.canvas_type === 'main')
      if (mainCanvas) {
        const { data: mainItems } = await supabase
          .from('deko_items').select('*').eq('canvas_id', mainCanvas.id)
        if (mainItems && mainItems.length > 0) {
          const copies = (mainItems as Record<string, unknown>[]).map(item => {
            const copy = { ...item }
            delete copy.id
            delete copy.created_at
            delete copy.updated_at
            copy.canvas_id = canvas.id
            return copy
          })
          const { error } = await supabase.from('deko_items').insert(copies)
          if (error) console.error('[deko] createVariant copy failed', error)
        }
      }
      onAreasChange(areas.map(a => a.id === areaId ? {
        ...a, canvases: [...(a.canvases ?? []), canvas as DekoCanvas],
      } : a))
      onSelectCanvas(canvas.id)
    }
    setAddingVariant(null)
    setNewVariantName('')
  }

  // ── Delete area / variant ─────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteConfirm) return
    setDeleting(true)

    if (deleteConfirm.kind === 'area') {
      const area = deleteConfirm.area
      const canvasIds = (area.canvases ?? []).map(c => c.id)
      if (canvasIds.length > 0) {
        await supabase.from('deko_items').delete().in('canvas_id', canvasIds)
        await supabase.from('deko_canvases').delete().in('id', canvasIds)
      }
      await supabase.from('deko_areas').delete().eq('id', area.id)
      const remaining = areas.filter(a => a.id !== area.id)
      onAreasChange(remaining)
      const deletedIds = new Set(canvasIds)
      if (activeCanvasId && deletedIds.has(activeCanvasId)) {
        const next = remaining[0]?.canvases?.[0]?.id ?? null
        if (next) onSelectCanvas(next)
      }
    } else {
      const { areaId, canvas } = deleteConfirm
      await supabase.from('deko_items').delete().eq('canvas_id', canvas.id)
      await supabase.from('deko_canvases').delete().eq('id', canvas.id)
      onAreasChange(areas.map(a => a.id === areaId
        ? { ...a, canvases: (a.canvases ?? []).filter(c => c.id !== canvas.id) }
        : a
      ))
      if (activeCanvasId === canvas.id) {
        const area = areas.find(a => a.id === areaId)
        const next = area?.canvases?.find(c => c.id !== canvas.id)?.id ?? area?.canvases?.find(c => c.canvas_type === 'main')?.id ?? null
        if (next) onSelectCanvas(next)
      }
    }

    setDeleteConfirm(null)
    setDeleting(false)
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
              {canEdit && (
                <button
                  title="Bereich löschen"
                  onClick={e => { e.stopPropagation(); setDeleteConfirm({ kind: 'area', area }) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0, borderRadius: 4, lineHeight: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#E06C75')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {isExpanded && variants.map(v => (
              <div key={v.id}
                onClick={() => onSelectCanvas(v.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px 5px 28px', cursor: 'pointer', fontSize: 12,
                  background: v.id === activeCanvasId ? 'rgba(201,185,154,0.12)' : 'transparent',
                  color: v.id === activeCanvasId ? 'var(--accent, #C9B99A)' : 'var(--text-secondary)',
                  fontWeight: v.id === activeCanvasId ? 600 : 400,
                }}>
                <GitBranch size={10} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                {v.is_frozen && <span style={{ fontSize: 10 }}>🔒</span>}
                {canEdit && (
                  <button
                    title="Variante löschen"
                    onClick={e => { e.stopPropagation(); setDeleteConfirm({ kind: 'variant', areaId: area.id, canvas: v }) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0, borderRadius: 4, lineHeight: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#E06C75')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                  >
                    <X size={10} />
                  </button>
                )}
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
          ? <div style={{ padding: '6px 14px 6px 8px', borderTop: '1px dashed var(--border)' }}>
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
      {/* ── Delete confirmation modal ── */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => !deleting && setDeleteConfirm(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,0.22)', padding: '28px 28px 22px', maxWidth: 380, width: 'calc(100vw - 48px)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={16} color="#E06C75" />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                {deleteConfirm.kind === 'area' ? 'Bereich löschen' : 'Variante löschen'}
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 6 }}>
              <strong style={{ color: 'var(--text)' }}>
                „{deleteConfirm.kind === 'area' ? deleteConfirm.area.name : deleteConfirm.canvas.name}"
              </strong>
              {deleteConfirm.kind === 'area'
                ? ' und alle dazugehörigen Canvases und Dekoelemente werden '
                : ' und alle darin enthaltenen Dekoelemente werden '}
              <strong style={{ color: '#E06C75' }}>unwiderruflich gelöscht</strong>.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 22 }}>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--text-secondary)' }}>
                Abbrechen
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#E06C75', color: '#fff', cursor: deleting ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: deleting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                {deleting ? 'Wird gelöscht…' : <><Trash2 size={13} /> Löschen</>}
              </button>
            </div>
          </div>
        </div>
      )}
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
