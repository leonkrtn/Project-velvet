'use client'
import React, { useState, useRef, useCallback } from 'react'
import {
  Image, Link, Palette, Square, Type, StickyNote, Heading,
  Flower2, Package, Grid2X2, Minus, Tag, Vote, CheckSquare,
  Globe, LayoutGrid, Info, Users, Scissors, GripVertical,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import type { DekoItemType } from '@/lib/deko/types'

// ── Item type definitions ─────────────────────────────────────────────────────

interface ToolItem {
  type: DekoItemType
  icon: React.ReactNode
  label: string
  group: string
}

const TOOLS: ToolItem[] = [
  // Visuelle Items
  { type: 'image_upload',      icon: <Image size={15} />,       label: 'Bild-Upload',      group: 'Medien' },
  { type: 'image_url',         icon: <Globe size={15} />,       label: 'Bild-URL',         group: 'Medien' },
  { type: 'color_palette',     icon: <Palette size={15} />,     label: 'Farbpalette',      group: 'Medien' },
  { type: 'color_swatch',      icon: <Square size={15} />,      label: 'Farbfeld',         group: 'Medien' },
  // Text & Notizen
  { type: 'text_block',        icon: <Type size={15} />,        label: 'Textblock',        group: 'Text' },
  { type: 'sticky_note',       icon: <StickyNote size={15} />,  label: 'Notizzettel',      group: 'Text' },
  { type: 'heading',           icon: <Heading size={15} />,     label: 'Überschrift',      group: 'Text' },
  // Artikel
  { type: 'article',           icon: <Flower2 size={15} />,     label: 'Dekoartikel',      group: 'Artikel' },
  { type: 'flat_rate_article', icon: <Package size={15} />,     label: 'Pauschalen-Art.',  group: 'Artikel' },
  { type: 'fabric',            icon: <Scissors size={15} />,    label: 'Stoff',            group: 'Artikel' },
  // Struktur
  { type: 'frame',             icon: <LayoutGrid size={15} />,  label: 'Rahmen',           group: 'Struktur' },
  { type: 'divider',           icon: <Minus size={15} />,       label: 'Trennlinie',       group: 'Struktur' },
  { type: 'area_label',        icon: <Tag size={15} />,         label: 'Bereichs-Label',   group: 'Struktur' },
  // Interaktiv
  { type: 'vote_card',         icon: <Vote size={15} />,        label: 'Abstimmung',       group: 'Interaktiv' },
  { type: 'checklist',         icon: <CheckSquare size={15} />, label: 'Checkliste',       group: 'Interaktiv' },
  { type: 'link_card',         icon: <Link size={15} />,        label: 'Link-Karte',       group: 'Interaktiv' },
  // Referenz
  { type: 'table_ref',         icon: <Grid2X2 size={15} />,     label: 'Tisch-Ref.',       group: 'Referenz' },
  { type: 'room_info',         icon: <Info size={15} />,        label: 'Rauminfo',         group: 'Referenz' },
  { type: 'guest_count',       icon: <Users size={15} />,       label: 'Gästezahl',        group: 'Referenz' },
]

const GROUPS = ['Medien', 'Text', 'Artikel', 'Struktur', 'Interaktiv', 'Referenz']

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  pendingType: DekoItemType | null
  onSelect: (type: DekoItemType) => void
  onCancel: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DekoFloatingToolbar({ pendingType, onSelect, onCancel }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState({ x: 16, y: 120 })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const handleHandleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPos({ x: ev.clientX - dragOffset.current.x, y: ev.clientY - dragOffset.current.y })
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  return (
    <div style={{
      position: 'fixed',
      left: pos.x,
      top: pos.y,
      zIndex: 500,
      background: 'var(--sidebar-bg, #FAF8F5)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,.15)',
      userSelect: 'none',
      width: collapsed ? 42 : 160,
      transition: 'width 0.15s ease',
      overflow: 'hidden',
    }}>
      {/* Drag handle + collapse toggle */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 6px', borderBottom: '1px solid var(--border)', gap: 4, cursor: 'move' }}
        onMouseDown={handleHandleMouseDown}>
        <GripVertical size={13} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
        {!collapsed && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', flex: 1 }}>Elemente</span>}
        <button onClick={() => setCollapsed(c => !c)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '6px 0', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {pendingType && (
            <div style={{ margin: '4px 8px 8px', padding: '6px 8px', background: '#FFF3CD', borderRadius: 6, fontSize: 11, color: '#856404' }}>
              Klicke auf den Canvas um zu platzieren
              <button onClick={onCancel} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#856404', textDecoration: 'underline', padding: 0 }}>Abbrechen</button>
            </div>
          )}
          {GROUPS.map(group => {
            const items = TOOLS.filter(t => t.group === group)
            return (
              <div key={group}>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', padding: '6px 10px 3px' }}>{group}</p>
                {items.map(tool => (
                  <button
                    key={tool.type}
                    onClick={() => {
                      if (pendingType === tool.type) { onCancel(); return }
                      onSelect(tool.type)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', background: pendingType === tool.type ? 'var(--accent-light)' : 'none',
                      border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                      color: pendingType === tool.type ? 'var(--accent)' : 'var(--text)',
                      textAlign: 'left', fontWeight: pendingType === tool.type ? 600 : 400,
                    }}>
                    <span style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>{tool.icon}</span>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Collapsed: show only icons */}
      {collapsed && (
        <div style={{ padding: '4px 0' }}>
          {TOOLS.map(tool => (
            <button key={tool.type}
              title={tool.label}
              onClick={() => { if (pendingType === tool.type) { onCancel(); return } onSelect(tool.type) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '7px 0', background: pendingType === tool.type ? 'var(--accent-light)' : 'none',
                border: 'none', cursor: 'pointer', color: pendingType === tool.type ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
              {tool.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
