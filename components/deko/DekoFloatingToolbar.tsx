'use client'
import React, { useState } from 'react'
import {
  Image, Link, Palette, Type, StickyNote, Heading,
  Flower2, Grid2X2, Minus, Vote, CheckSquare,
  Globe, LayoutGrid, Info, Users, Scissors,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import type { DekoItemType } from '@/lib/deko/types'

// ── Tool definitions ──────────────────────────────────────────────────────────

interface ToolItem {
  type: DekoItemType
  icon: React.ReactNode
  label: string
  group: string
}

// flat_rate_article is intentionally excluded — it's handled as an option inside the article item
const TOOLS: ToolItem[] = [
  { type: 'image_upload',  icon: <Image size={14} />,       label: 'Bild hochladen', group: 'Medien' },
  { type: 'image_url',     icon: <Globe size={14} />,       label: 'Bild-URL',       group: 'Medien' },
  { type: 'color_palette', icon: <Palette size={14} />,     label: 'Farbpalette',    group: 'Medien' },
  { type: 'text_block',    icon: <Type size={14} />,        label: 'Textblock',      group: 'Text' },
  { type: 'sticky_note',   icon: <StickyNote size={14} />,  label: 'Notizzettel',    group: 'Text' },
  { type: 'heading',       icon: <Heading size={14} />,     label: 'Überschrift',    group: 'Text' },
  { type: 'article',       icon: <Flower2 size={14} />,     label: 'Dekoartikel',   group: 'Artikel' },
  { type: 'fabric',        icon: <Scissors size={14} />,    label: 'Stoff',          group: 'Artikel' },
  { type: 'frame',         icon: <LayoutGrid size={14} />,  label: 'Rahmen',         group: 'Struktur' },
  { type: 'divider',       icon: <Minus size={14} />,       label: 'Trennlinie',     group: 'Struktur' },
  { type: 'vote_card',     icon: <Vote size={14} />,        label: 'Abstimmung',     group: 'Interaktiv' },
  { type: 'checklist',     icon: <CheckSquare size={14} />, label: 'Checkliste',     group: 'Interaktiv' },
  { type: 'link_card',     icon: <Link size={14} />,        label: 'Link-Karte',     group: 'Interaktiv' },
  { type: 'table_ref',     icon: <Grid2X2 size={14} />,     label: 'Tisch-Ref.',     group: 'Referenz' },
  { type: 'room_info',     icon: <Info size={14} />,        label: 'Rauminfo',       group: 'Referenz' },
  { type: 'guest_count',   icon: <Users size={14} />,       label: 'Gästezahl',      group: 'Referenz' },
]

const GROUPS = ['Medien', 'Text', 'Artikel', 'Struktur', 'Interaktiv', 'Referenz']

const GROUP_COLORS: Record<string, string> = {
  Medien: '#C9B99A',
  Text: '#9B8EA8',
  Artikel: '#89A89B',
  Struktur: '#A89889',
  Interaktiv: '#8A9BB0',
  Referenz: '#A8A889',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  pendingType: DekoItemType | null
  onSelect: (type: DekoItemType) => void
  onCancel: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DekoFloatingToolbar({ pendingType, onSelect, onCancel }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{
      flexShrink: 0,
      alignSelf: 'stretch',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      userSelect: 'none',
      width: collapsed ? 44 : 188,
      transition: 'width 0.15s ease',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', padding: '9px 8px 7px',
          borderBottom: '1px solid var(--border)', gap: 4,
          background: 'transparent', flexShrink: 0,
        }}
      >
        {!collapsed && (
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: 'var(--text-tertiary)', flex: 1,
          }}>
            Elemente
          </span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Ausklappen' : 'Einklappen'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-tertiary)', marginLeft: collapsed ? 'auto' : 0, marginRight: collapsed ? 'auto' : 0 }}
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      </div>

      {/* Pending banner */}
      {!collapsed && pendingType && (
        <div style={{
          margin: '6px 8px 2px', padding: '6px 8px',
          background: 'rgba(201,185,154,0.15)', borderRadius: 7,
          border: '1px solid rgba(201,185,154,0.4)',
          fontSize: 11, color: '#856404',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Auf Canvas klicken</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-tertiary)', display: 'flex' }}>
            <X size={11} />
          </button>
        </div>
      )}

      {/* Expanded list */}
      {!collapsed && (
        <div style={{ padding: '4px 0 6px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {GROUPS.map(group => {
            const tools = TOOLS.filter(t => t.group === group)
            const color = GROUP_COLORS[group]
            return (
              <div key={group}>
                <p style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'var(--text-tertiary)',
                  padding: '7px 10px 3px', margin: 0,
                }}>
                  {group}
                </p>
                {tools.map(tool => {
                  const active = pendingType === tool.type
                  return (
                    <button
                      key={tool.type}
                      onClick={() => { if (active) { onCancel(); return } onSelect(tool.type) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px',
                        background: active ? `${color}22` : 'none',
                        border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        color: active ? color : 'var(--text)',
                        textAlign: 'left', fontWeight: active ? 600 : 400,
                        borderLeft: active ? `2px solid ${color}` : '2px solid transparent',
                      }}
                    >
                      <span style={{ flexShrink: 0, color: active ? color : 'var(--text-secondary)', lineHeight: 0 }}>
                        {tool.icon}
                      </span>
                      <span>{tool.label}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Collapsed icon list */}
      {collapsed && (
        <div style={{ padding: '4px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {TOOLS.map(tool => {
            const active = pendingType === tool.type
            const color = GROUP_COLORS[tool.group]
            return (
              <button
                key={tool.type}
                title={tool.label}
                onClick={() => { if (active) { onCancel(); return } onSelect(tool.type) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '7px 0',
                  background: active ? `${color}22` : 'none',
                  border: 'none', cursor: 'pointer',
                  color: active ? color : 'var(--text-secondary)',
                  borderLeft: active ? `2px solid ${color}` : '2px solid transparent',
                }}
              >
                {tool.icon}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
