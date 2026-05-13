'use client'
import React, { useState, useEffect, useRef } from 'react'
import { Check, Link, Users, Info, ThumbsUp, ThumbsDown, X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  DekoItem, DekoRole, DekoCatalogItem, DekoFlatRate,
  ImageUploadData, ImageUrlData, ColorPaletteData, ColorSwatchData,
  TextBlockData, StickyNoteData, HeadingData,
  ArticleData, FlatRateArticleData, FabricData,
  FrameData, DividerData, AreaLabelData,
  VoteCardData, ChecklistData, LinkCardData,
  TableRefData, DekoItemData,
} from '@/lib/deko/types'

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#333333' : '#FFFFFF'
}

interface RendererProps {
  item: DekoItem
  catalog: DekoCatalogItem[]
  flatRates: DekoFlatRate[]
  role: DekoRole
  userId: string
  eventId: string
  canEdit: boolean
  onDataChange: (d: DekoItemData) => void
  onVoteChange: () => void
}

// ── 1. ImageUpload ────────────────────────────────────────────────────────────

function ImageUploadRenderer({ item, eventId }: RendererProps) {
  const d = item.data as ImageUploadData
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!d.storage_key) return
    fetch(`/api/deko/image-url?r2Key=${encodeURIComponent(d.storage_key)}&eventId=${eventId}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.url) setUrl(j.url) })
      .catch(() => {})
  }, [d.storage_key, eventId])

  if (!d.storage_key) return (
    <div style={emptyStyle}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>🖼</div>
      <span style={emptyLabel}>Doppelklick zum Hochladen</span>
    </div>
  )
  if (!url) return (
    <div style={emptyStyle}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: '#C9B99A', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
      <img src={url} alt={d.caption ?? ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {d.caption && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.55))', padding: '16px 10px 8px', color: '#fff', fontSize: 11, fontWeight: 500 }}>
          {d.caption}
        </div>
      )}
    </div>
  )
}

// ── 2. ImageUrl ───────────────────────────────────────────────────────────────

function ImageUrlRenderer({ item }: RendererProps) {
  const d = item.data as ImageUrlData
  if (!d.url && !d.preview_url) return (
    <div style={emptyStyle}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>🌐</div>
      <span style={emptyLabel}>Doppelklick → URL eingeben</span>
    </div>
  )
  const src = d.preview_url || d.url
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 8 }} onDragStart={e => e.preventDefault()}>
      <img src={src} alt={d.caption ?? ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      {d.caption && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.55))', padding: '16px 10px 8px', color: '#fff', fontSize: 11, fontWeight: 500 }}>
          {d.caption}
        </div>
      )}
    </div>
  )
}

// ── 3. ColorPalette ───────────────────────────────────────────────────────────

function ColorPaletteRenderer({ item }: RendererProps) {
  const d = item.data as ColorPaletteData
  const colors = d.colors ?? []
  if (!colors.length) return (
    <div style={emptyStyle}>
      <span style={emptyLabel}>Doppelklick → Farben hinzufügen</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', height: '100%', borderRadius: 8, overflow: 'hidden' }}>
      {colors.map((c, i) => {
        const textColor = contrastColor(c.hex)
        return (
          <div key={i} title={c.name} style={{ flex: 1, background: c.hex, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '4px 5px' }}>
            {c.name && (
              <span style={{ fontSize: 9, color: textColor, fontWeight: 600, lineHeight: 1.2, wordBreak: 'break-word' }}>{c.name}</span>
            )}
            <span style={{ fontSize: 8, color: textColor, opacity: 0.7, marginTop: 1 }}>{c.hex}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── 4. ColorSwatch ────────────────────────────────────────────────────────────

function ColorSwatchRenderer({ item }: RendererProps) {
  const d = item.data as ColorSwatchData
  const hex = d.hex || '#E8E0D5'
  const textColor = contrastColor(hex)
  return (
    <div style={{
      width: '100%', height: '100%',
      background: hex,
      borderRadius: 8,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 8, boxSizing: 'border-box',
      gap: 3,
    }}>
      {d.name && (
        <span style={{ fontSize: 11, color: textColor, fontWeight: 700, textAlign: 'center', wordBreak: 'break-word' }}>{d.name}</span>
      )}
      <span style={{ fontSize: 9, color: textColor, opacity: 0.7, fontFamily: 'monospace' }}>{hex.toUpperCase()}</span>
    </div>
  )
}

// ── 5. TextBlock ──────────────────────────────────────────────────────────────

const TEXT_FONT_SIZES = [10, 12, 13, 14, 16, 18, 20, 24]

function FormatBar({ fs, bold, italic, align, onSize, onBold, onItalic, onAlign, onClose, fontSizes = TEXT_FONT_SIZES }: {
  fs: number; bold: boolean; italic: boolean; align: string; fontSizes?: number[]
  onSize: (s: number) => void; onBold: () => void; onItalic: () => void
  onAlign: (a: 'left' | 'center' | 'right') => void; onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 200,
        background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.13)', padding: '5px 8px',
        display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap',
        whiteSpace: 'nowrap',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {fontSizes.map(s => (
        <button key={s} onClick={() => onSize(s)}
          style={{ padding: '2px 5px', border: `1px solid ${fs === s ? '#C9B99A' : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', background: fs === s ? 'rgba(201,185,154,0.15)' : 'none', color: fs === s ? '#C9B99A' : 'var(--text)', fontWeight: fs === s ? 700 : 400 }}>
          {s}
        </button>
      ))}
      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
      <button onClick={onBold}
        style={{ width: 26, height: 26, border: `1px solid ${bold ? '#C9B99A' : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', fontWeight: 800, fontSize: 13, background: bold ? 'rgba(201,185,154,0.15)' : 'none', fontFamily: 'inherit', color: bold ? '#C9B99A' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>B</button>
      <button onClick={onItalic}
        style={{ width: 26, height: 26, border: `1px solid ${italic ? '#C9B99A' : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', fontStyle: 'italic', fontSize: 13, background: italic ? 'rgba(201,185,154,0.15)' : 'none', fontFamily: 'inherit', color: italic ? '#C9B99A' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>I</button>
      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
      {(['left', 'center', 'right'] as const).map(a => {
        const active = align === a
        const icons: Record<string, string> = { left: '⇤', center: '↔', right: '⇥' }
        return (
          <button key={a} onClick={() => onAlign(a)}
            style={{ width: 26, height: 26, border: `1px solid ${active ? '#C9B99A' : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', fontSize: 12, background: active ? 'rgba(201,185,154,0.15)' : 'none', fontFamily: 'inherit', color: active ? '#C9B99A' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icons[a]}
          </button>
        )
      })}
      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
      <button onClick={onClose}
        style={{ width: 22, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={11} />
      </button>
    </div>
  )
}

function TextBlockRenderer({ item, canEdit, onDataChange }: RendererProps) {
  const d = item.data as TextBlockData
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.content ?? '')
  const [showFormat, setShowFormat] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (!editing) setDraft(d.content ?? '') }, [d.content, editing])
  useEffect(() => { if (editing) textareaRef.current?.focus() }, [editing])

  const textStyle: React.CSSProperties = {
    fontSize: d.font_size ?? 13,
    fontWeight: d.bold ? 700 : 400,
    fontStyle: d.italic ? 'italic' : 'normal',
    textAlign: d.align ?? 'left',
    color: 'var(--text)',
    lineHeight: 1.65,
  }

  function saveContent() { setEditing(false); onDataChange({ ...d, content: draft }) }
  function updateStyle(patch: Partial<TextBlockData>) { onDataChange({ ...d, content: draft, ...patch }) }

  const fs = d.font_size ?? 13

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {showFormat && canEdit && (
        <FormatBar
          fs={fs} bold={!!d.bold} italic={!!d.italic} align={d.align ?? 'left'}
          onSize={s => updateStyle({ font_size: s })}
          onBold={() => updateStyle({ bold: !d.bold })}
          onItalic={() => updateStyle({ italic: !d.italic })}
          onAlign={a => updateStyle({ align: a })}
          onClose={() => setShowFormat(false)}
        />
      )}

      {/* Display div — always in flow (drives auto-height), visibility:hidden when editing */}
      <div
        style={{
          width: '100%', height: '100%', padding: 14, background: '#fff',
          borderRadius: 8, overflow: 'hidden', boxSizing: 'border-box',
          whiteSpace: 'pre-wrap', cursor: canEdit ? 'text' : 'default',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...textStyle,
          visibility: editing ? 'hidden' : 'visible',
        }}
        onClick={() => canEdit && setEditing(true)}
        onDoubleClick={e => { e.stopPropagation(); if (canEdit) { setEditing(true); setShowFormat(s => !s) } }}
      >
        {d.content || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: 12, fontWeight: 400 }}>Klick → Text eingeben · Doppelklick → Format</span>}
      </div>

      {/* Textarea — absolute overlay, shown when editing; dblclick also toggles format bar */}
      {canEdit && (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={saveContent}
          onKeyDown={e => e.stopPropagation()}
          onDoubleClick={e => { e.stopPropagation(); setShowFormat(s => !s) }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', border: 'none', outline: 'none',
            resize: 'none', padding: 14, boxSizing: 'border-box', borderRadius: 8,
            background: '#fff', fontFamily: 'inherit', ...textStyle,
            visibility: editing ? 'visible' : 'hidden',
            pointerEvents: editing ? 'auto' : 'none',
          }}
        />
      )}
    </div>
  )
}

// ── 6. StickyNote ─────────────────────────────────────────────────────────────

const STICKY_COLORS = ['#FFF8DC', '#DDEEFF', '#DDFFDD', '#FFE4E4', '#EEE0FF', '#FFE4C0', '#F0F0F0']

function StickyColorDot({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 11, height: 11, borderRadius: '50%', background: color,
        cursor: 'pointer', flexShrink: 0,
        border: active ? '2px solid rgba(0,0,0,0.35)' : '1px solid rgba(0,0,0,0.12)',
      }}
    />
  )
}

function StickyNoteRenderer({ item, canEdit, onDataChange }: RendererProps) {
  const d = item.data as StickyNoteData
  const bg = d.color || STICKY_COLORS[0]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.content ?? '')
  return (
    <div style={{
      width: '100%', height: '100%', background: bg,
      borderRadius: 8, padding: 12, boxSizing: 'border-box',
      boxShadow: '2px 3px 10px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
      position: 'relative', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 9, flexShrink: 0, alignItems: 'center' }}>
        {STICKY_COLORS.map(c => (
          <StickyColorDot key={c} color={c} active={c === bg} onClick={() => onDataChange({ ...d, color: c })} />
        ))}
      </div>
      {editing
        ? <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={() => { setEditing(false); onDataChange({ ...d, content: draft }) }}
            style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6 }}
          />
        : <div style={{ flex: 1, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflow: 'hidden', cursor: canEdit ? 'text' : 'default' }}
            onDoubleClick={() => canEdit && setEditing(true)}>
            {d.content || <span style={{ color: 'rgba(0,0,0,0.25)', fontStyle: 'italic' }}>Notiz…</span>}
          </div>
      }
    </div>
  )
}

// ── 7. Heading ────────────────────────────────────────────────────────────────

const HEADING_DEFAULT_SIZES: Record<number, number> = { 1: 32, 2: 22, 3: 16 }
const HEADING_FONT_SIZES = [14, 16, 18, 20, 24, 28, 32, 36]

function HeadingRenderer({ item, canEdit, onDataChange }: RendererProps) {
  const d = item.data as HeadingData
  const [editing, setEditing] = useState(false)
  const [showFormat, setShowFormat] = useState(false)
  const [draft, setDraft] = useState(d.text ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!editing) setDraft(d.text ?? '') }, [d.text, editing])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const fontSize = d.font_size ?? HEADING_DEFAULT_SIZES[d.level ?? 1]
  const boldActive = d.bold !== false
  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight: boldActive ? 700 : 400,
    fontStyle: d.italic ? 'italic' : 'normal',
    textAlign: d.align ?? 'left',
    letterSpacing: '-0.4px',
    color: 'var(--text)',
  }

  function saveText() { setEditing(false); onDataChange({ ...d, text: draft }) }
  function updateStyle(patch: Partial<HeadingData>) { onDataChange({ ...d, text: draft, ...patch }) }

  const fs = d.font_size ?? HEADING_DEFAULT_SIZES[d.level ?? 1]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {showFormat && canEdit && (
        <FormatBar
          fs={fs} bold={boldActive} italic={!!d.italic} align={d.align ?? 'left'}
          fontSizes={HEADING_FONT_SIZES}
          onSize={s => updateStyle({ font_size: s })}
          onBold={() => updateStyle({ bold: !boldActive })}
          onItalic={() => updateStyle({ italic: !d.italic })}
          onAlign={a => updateStyle({ align: a })}
          onClose={() => setShowFormat(false)}
        />
      )}

      {/* Display div — always in flow */}
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center',
          overflow: 'hidden', cursor: canEdit ? 'text' : 'default',
          visibility: editing ? 'hidden' : 'visible',
        }}
        onClick={() => canEdit && setEditing(true)}
        onDoubleClick={e => { e.stopPropagation(); if (canEdit) { setEditing(true); setShowFormat(s => !s) } }}
      >
        <span style={{ ...textStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', display: 'block' }}>
          {d.text || <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 14, fontStyle: 'italic', letterSpacing: 'normal' }}>Überschrift…</span>}
        </span>
      </div>

      {/* Input — absolute overlay, visible when editing */}
      {canEdit && (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={saveText}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); saveText() }
            if (e.key === 'Escape') { setEditing(false); setDraft(d.text ?? '') }
            e.stopPropagation()
          }}
          onDoubleClick={e => { e.stopPropagation(); setShowFormat(s => !s) }}
          style={{
            position: 'absolute', inset: 0,
            border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'inherit', width: '100%', height: '100%', padding: 0,
            ...textStyle,
            visibility: editing ? 'visible' : 'hidden',
            pointerEvents: editing ? 'auto' : 'none',
          }}
        />
      )}
    </div>
  )
}

// ── 8. Article ────────────────────────────────────────────────────────────────

function ArticleRenderer({ item, catalog, flatRates }: RendererProps) {
  const d = item.data as ArticleData
  const cat = catalog.find(c => c.id === d.catalog_item_id)
  if (!cat) return (
    <div style={cardStyle}>
      <div style={emptyStyle}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🌸</div>
        <span style={emptyLabel}>Doppelklick → Artikel wählen</span>
      </div>
    </div>
  )
  const fr = cat.flat_rate_id ? flatRates.find(f => f.id === cat.flat_rate_id) : null
  const lineTotal = cat.is_free ? null : fr ? null : (cat.price_per_unit ?? 0) * (d.quantity ?? 1)
  return (
    <div style={cardStyle}>
      {cat.image_url
        ? <img src={cat.image_url} alt={cat.name} draggable={false} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
        : <div style={{ height: 70, background: 'linear-gradient(135deg,#f9f5f0,#f0e8de)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🌸</div>
      }
      <div style={{ padding: '9px 10px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</p>
        {cat.color && <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 1 }}>{cat.color}</p>}
        {cat.material && <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{cat.material}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 }}>
          <span style={{ fontSize: 10, background: '#f4ede4', color: '#8B6A50', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>×{d.quantity ?? 1}</span>
          {cat.is_free
            ? <span style={{ fontSize: 10, color: '#4CAF50', fontWeight: 700 }}>Gratis</span>
            : fr
              ? <span style={{ fontSize: 10, color: '#C9B99A', fontWeight: 700 }}>Pauschale</span>
              : lineTotal != null && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #C9B99A)' }}>{fmt(lineTotal)}</span>
          }
        </div>
        {availBadge(cat.availability)}
      </div>
    </div>
  )
}

// ── 9. FlatRateArticle ────────────────────────────────────────────────────────

function FlatRateArticleRenderer({ item, catalog, flatRates }: RendererProps) {
  const d = item.data as FlatRateArticleData
  const cat = catalog.find(c => c.id === d.catalog_item_id)
  const fr = flatRates.find(f => f.id === d.flat_rate_id)
  return (
    <div style={cardStyle}>
      {cat?.image_url
        ? <img src={cat.image_url} alt={cat?.name ?? ''} draggable={false} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
        : <div style={{ height: 60, background: 'linear-gradient(135deg,#f9f5f0,#ede3d5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📦</div>
      }
      <div style={{ padding: '9px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat?.name ?? 'Pauschalen-Artikel'}</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#C9B99A', fontWeight: 700, background: 'rgba(201,185,154,0.12)', padding: '2px 7px', borderRadius: 20, marginBottom: d.is_free ? 0 : 4 }}>
          📦 {d.is_free ? 'Gratis' : fr ? fr.name : 'Pauschale'}
        </div>
        {!d.is_free && fr && <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmt(fr.amount)}</p>}
      </div>
    </div>
  )
}

// ── 10. Fabric ────────────────────────────────────────────────────────────────

function FabricRenderer({ item, catalog }: RendererProps) {
  const d = item.data as FabricData
  const cat = catalog.find(c => c.id === d.catalog_item_id)
  if (!cat) return (
    <div style={cardStyle}>
      <div style={emptyStyle}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🧵</div>
        <span style={emptyLabel}>Doppelklick → Stoff wählen</span>
      </div>
    </div>
  )
  const lineTotal = cat.is_free ? null : (cat.price_per_meter ?? 0) * (d.quantity_meters ?? 1)
  return (
    <div style={cardStyle}>
      {cat.image_url
        ? <img src={cat.image_url} alt={cat.name} draggable={false} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
        : <div style={{ height: 70, background: 'linear-gradient(135deg,#f5f0ea,#e8dfd4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🧵</div>
      }
      <div style={{ padding: '9px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</p>
        {cat.color && <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 1 }}>{cat.color}</p>}
        {cat.fabric_type && <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{cat.fabric_type}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 }}>
          <span style={{ fontSize: 10, background: '#f4ede4', color: '#8B6A50', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{d.quantity_meters ?? 1} m</span>
          {lineTotal != null && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #C9B99A)' }}>{fmt(lineTotal)}</span>}
        </div>
      </div>
    </div>
  )
}

// ── 11. Frame ─────────────────────────────────────────────────────────────────

function FrameRenderer({ item }: RendererProps) {
  const d = item.data as FrameData
  const opacity = Math.min(1, Math.max(0, d.opacity ?? 0.06))
  const color = d.color || '#C9B99A'
  // Build background with correct opacity (0-1 scale)
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `rgba(${r},${g},${b},${opacity})`,
      border: `2px solid ${color}`,
      borderRadius: 10, boxSizing: 'border-box',
    }}>
      {d.label && (
        <div style={{
          padding: '6px 12px', fontSize: 11, fontWeight: 700,
          color, textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          {d.label}
        </div>
      )}
    </div>
  )
}

// ── 12. Divider ───────────────────────────────────────────────────────────────

function DividerRenderer({ item }: RendererProps) {
  const d = item.data as DividerData
  const isH = (d.orientation ?? 'horizontal') === 'horizontal'
  const color = d.color || 'var(--border)'
  const style = d.style || 'solid'
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {isH
        ? <div style={{ width: '100%', borderTop: `2px ${style} ${color}` }} />
        : <div style={{ height: '100%', borderLeft: `2px ${style} ${color}` }} />
      }
    </div>
  )
}

// ── 13. AreaLabel ─────────────────────────────────────────────────────────────

function AreaLabelRenderer({ item }: RendererProps) {
  const d = item.data as AreaLabelData
  return (
    <div style={{
      width: '100%', height: '100%',
      background: d.bg_color || '#C9B99A',
      borderRadius: 24, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '0 18px', boxSizing: 'border-box',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: d.color || '#fff', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>
        {d.text || 'Bereich'}
      </span>
    </div>
  )
}

// ── 14. VoteCard ──────────────────────────────────────────────────────────────

function VoteCardRenderer({ item, eventId, userId }: RendererProps) {
  const d = item.data as VoteCardData
  const [votes, setVotes] = useState<{ up: number; down: number; mine: 'up' | 'down' | null }>({ up: 0, down: 0, mine: null })
  const [voting, setVoting] = useState(false)
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('deko_votes').select('vote, user_id').eq('item_id', item.id)
      .then(({ data }) => {
        if (!data) return
        setVotes({
          up: data.filter(v => v.vote === 'up').length,
          down: data.filter(v => v.vote === 'down').length,
          mine: data.find(v => v.user_id === userId)?.vote as 'up' | 'down' | null ?? null,
        })
      }, () => {})
  }, [item.id, userId])

  useEffect(() => {
    if (!d.storage_key) return
    fetch(`/api/deko/image-url?r2Key=${encodeURIComponent(d.storage_key)}&eventId=${eventId}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.url) setResolvedImageUrl(j.url) })
      .catch(() => {})
  }, [d.storage_key, eventId])

  async function vote(v: 'up' | 'down') {
    if (voting) return
    setVoting(true)
    const supabase = createClient()
    try {
      if (votes.mine === v) {
        await supabase.from('deko_votes').delete().eq('item_id', item.id).eq('user_id', userId)
        setVotes(p => ({ ...p, [v]: Math.max(0, p[v] - 1), mine: null }))
      } else if (votes.mine) {
        await supabase.from('deko_votes').update({ vote: v }).eq('item_id', item.id).eq('user_id', userId)
        setVotes(p => ({ ...p, [p.mine!]: Math.max(0, p[p.mine!] - 1), [v]: p[v] + 1, mine: v }))
      } else {
        await supabase.from('deko_votes').insert({ item_id: item.id, event_id: eventId, user_id: userId, vote: v })
        setVotes(p => ({ ...p, [v]: p[v] + 1, mine: v }))
      }
    } catch (err) {
      console.error('[deko] vote failed', err)
    } finally {
      setVoting(false)
    }
  }

  const displayImage = d.storage_key ? resolvedImageUrl : d.image_url
  return (
    <div style={cardStyle}>
      {displayImage
        ? <img src={displayImage} alt={d.title} draggable={false} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
        : d.storage_key
          ? <div style={{ height: 90, background: 'linear-gradient(135deg,#f5f0ea,#ede0ce)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: '#C9B99A', animation: 'spin 0.8s linear infinite' }} /></div>
          : <div style={{ height: 90, background: 'linear-gradient(135deg,#f5f0ea,#ede0ce)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>🗳</div>
      }
      <div style={{ padding: '9px 10px', flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title || 'Variante'}</p>
        {d.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 9, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.description}</p>}
        <div style={{ display: 'flex', gap: 7, marginTop: 'auto' }}>
          <button
            onClick={e => { e.stopPropagation(); vote('up') }}
            disabled={voting}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '5px 0', border: `1.5px solid ${votes.mine === 'up' ? '#4CAF50' : 'var(--border)'}`,
              borderRadius: 7, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
              background: votes.mine === 'up' ? '#E8F5E9' : '#faf9f7', color: '#2d7a4f', fontWeight: 600,
            }}>
            <ThumbsUp size={11} /> {votes.up}
          </button>
          <button
            onClick={e => { e.stopPropagation(); vote('down') }}
            disabled={voting}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '5px 0', border: `1.5px solid ${votes.mine === 'down' ? '#E06C75' : 'var(--border)'}`,
              borderRadius: 7, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
              background: votes.mine === 'down' ? '#FEECEE' : '#faf9f7', color: '#a0343d', fontWeight: 600,
            }}>
            <ThumbsDown size={11} /> {votes.down}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 15. Checklist ─────────────────────────────────────────────────────────────

function ChecklistRenderer({ item, canEdit, onDataChange }: RendererProps) {
  const d = item.data as ChecklistData
  const items = d.items ?? []
  const [newText, setNewText] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(d.title ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!editingTitle) setTitleDraft(d.title ?? '') }, [d.title, editingTitle])

  function toggle(id: string) {
    if (!canEdit) return
    onDataChange({ ...d, items: items.map(i => i.id === id ? { ...i, checked: !i.checked } : i) })
  }
  function addItem() {
    if (!newText.trim() || !canEdit) return
    onDataChange({ ...d, items: [...items, { id: crypto.randomUUID(), text: newText.trim(), checked: false }] })
    setNewText('')
  }
  function removeItem(id: string) {
    onDataChange({ ...d, items: items.filter(i => i.id !== id) })
  }
  function saveTitle() {
    setEditingTitle(false)
    onDataChange({ ...d, title: titleDraft.trim() || undefined })
  }

  const done = items.filter(i => i.checked).length
  return (
    <div style={{ ...cardStyle, padding: '10px 10px 8px', display: 'flex', flexDirection: 'column' }}>
      {/* Inline-editable title — always shown */}
      <div style={{ marginBottom: 7, flexShrink: 0 }} onMouseDown={e => e.stopPropagation()}>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); e.stopPropagation() }}
            placeholder="Überschrift…"
            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', fontFamily: 'inherit', padding: 0 }}
          />
        ) : (
          <p
            onClick={() => canEdit && setEditingTitle(true)}
            style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, cursor: canEdit ? 'text' : 'default', color: d.title ? 'var(--text-tertiary)' : 'rgba(0,0,0,0.2)', fontStyle: d.title ? 'normal' : 'italic' }}>
            {d.title || 'Überschrift…'}
          </p>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.map(i => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
            <div onClick={() => toggle(i.id)}
              onMouseDown={e => e.stopPropagation()}
              style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, marginTop: 1, border: `2px solid ${i.checked ? '#4CAF50' : '#C9B99A'}`, background: i.checked ? '#4CAF50' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: canEdit ? 'pointer' : 'default' }}>
              {i.checked && <Check size={8} color="white" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: 12, lineHeight: 1.4, flex: 1, textDecoration: i.checked ? 'line-through' : 'none', color: i.checked ? 'var(--text-tertiary)' : 'var(--text)' }}>
              {i.text}
            </span>
            {canEdit && (
              <button onClick={() => removeItem(i.id)}
                onMouseDown={e => e.stopPropagation()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: 'var(--text-tertiary)', opacity: 0, lineHeight: 1, flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                <X size={9} />
              </button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 5, marginTop: 6, flexShrink: 0 }} onMouseDown={e => e.stopPropagation()}>
          <input ref={inputRef} value={newText} onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } e.stopPropagation() }}
            placeholder="Punkt hinzufügen…"
            style={{ flex: 1, fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 5, outline: 'none', fontFamily: 'inherit', background: 'var(--bg, #F5F3EF)' }}
          />
          <button onClick={addItem} style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 5, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Plus size={10} />
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${(done / items.length) * 100}%`, height: '100%', background: '#4CAF50', borderRadius: 2, transition: 'width 0.2s' }} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{done}/{items.length}</span>
        </div>
      )}
    </div>
  )
}

// ── 16. LinkCard ──────────────────────────────────────────────────────────────

function LinkCardRenderer({ item, eventId }: RendererProps) {
  const d = item.data as LinkCardData
  const [ogData, setOgData] = useState<{ title?: string; description?: string; image?: string; domain?: string } | null>(null)

  useEffect(() => {
    if (!d.url || d.title) return
    fetch(`/api/deko/og-preview?url=${encodeURIComponent(d.url)}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setOgData(j) })
      .catch(() => {})
  }, [d.url, d.title])

  if (!d.url) return (
    <div style={cardStyle}>
      <div style={emptyStyle}>
        <Link size={20} color="var(--text-tertiary)" />
        <span style={{ ...emptyLabel, marginTop: 6 }}>Doppelklick → URL eingeben</span>
      </div>
    </div>
  )

  const title = d.title || ogData?.title
  const description = d.description || ogData?.description
  const imageUrl = d.image_url || ogData?.image
  const domain = d.domain || ogData?.domain

  return (
    <div style={{ ...cardStyle, cursor: 'pointer', overflow: 'hidden' }}
      onClick={e => { e.stopPropagation(); window.open(d.url, '_blank') }}>
      {imageUrl && (
        <img src={imageUrl} alt="" draggable={false} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block', flexShrink: 0 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      )}
      <div style={{ padding: '9px 10px', flex: 1, overflow: 'hidden' }}>
        {domain && <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}><Link size={9} />{domain}</p>}
        <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{title || d.url}</p>
        {description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{description}</p>}
      </div>
    </div>
  )
}

// ── 17. TableRef ──────────────────────────────────────────────────────────────

function TableRefRenderer({ item, eventId }: RendererProps) {
  const d = item.data as TableRefData
  const [table, setTable] = useState<{ name: string; capacity: number; shape: string } | null>(null)
  useEffect(() => {
    if (!d.table_id) return
    const supabase = createClient()
    supabase.from('seating_tables').select('name, capacity, shape').eq('id', d.table_id).single()
      .then(({ data }) => { if (data) setTable(data as typeof table) }, () => {})
  }, [d.table_id])
  return (
    <div style={{ ...cardStyle, padding: 14, background: '#FDFAF6' }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Tisch-Referenz</p>
      {table
        ? <>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{d.label || table.name || 'Tisch'}</p>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{table.shape} · {table.capacity} Plätze</p>
        </>
        : <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Doppelklick → Tisch wählen</p>
      }
    </div>
  )
}

// ── 18. RoomInfo ──────────────────────────────────────────────────────────────

function RoomInfoRenderer({ eventId }: RendererProps) {
  const [info, setInfo] = useState<{ area_sqm?: number; name?: string } | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.from('event_room_configs').select('config').eq('event_id', eventId).maybeSingle()
      .then(({ data }) => {
        if (data?.config && typeof data.config === 'object') {
          const c = data.config as Record<string, unknown>
          setInfo({
            area_sqm: typeof c.area_sqm === 'number' ? c.area_sqm : undefined,
            name: typeof c.name === 'string' ? c.name : undefined,
          })
        }
      }, () => {})
  }, [eventId])
  return (
    <div style={{ ...cardStyle, padding: 14, background: '#FDFAF6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Info size={12} color="#C9B99A" />
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: 0 }}>Rauminfo</p>
      </div>
      {info
        ? <>
          {info.name && <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{info.name}</p>}
          {info.area_sqm && <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{info.area_sqm} m²</p>}
        </>
        : <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Kein Raum konfiguriert</p>
      }
    </div>
  )
}

// ── 19. GuestCount ────────────────────────────────────────────────────────────

function GuestCountRenderer({ eventId }: RendererProps) {
  const [total, setTotal] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState<number | null>(null)
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('guests').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('guests').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('rsvp_status', 'confirmed'),
    ]).then(([all, conf]) => {
      setTotal(all.count ?? null)
      setConfirmed(conf.count ?? null)
    }, () => {})
  }, [eventId])
  return (
    <div style={{ ...cardStyle, padding: 14, background: '#FDFAF6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <Users size={20} color="#C9B99A" style={{ marginBottom: 8 }} />
      <p style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: 'var(--text)', marginBottom: 4 }}>{total ?? '…'}</p>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Gäste gesamt</p>
      {confirmed !== null && (
        <div style={{ fontSize: 10, color: '#4CAF50', fontWeight: 600, background: '#E8F5E9', padding: '2px 8px', borderRadius: 20 }}>
          {confirmed} bestätigt
        </div>
      )}
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function DekoItemRenderer(props: RendererProps) {
  const map: Record<string, React.FC<RendererProps>> = {
    image_upload:      ImageUploadRenderer,
    image_url:         ImageUrlRenderer,
    color_palette:     ColorPaletteRenderer,
    color_swatch:      ColorSwatchRenderer,
    text_block:        TextBlockRenderer,
    sticky_note:       StickyNoteRenderer,
    heading:           HeadingRenderer,
    article:           ArticleRenderer,
    flat_rate_article: FlatRateArticleRenderer,
    fabric:            FabricRenderer,
    frame:             FrameRenderer,
    divider:           DividerRenderer,
    area_label:        AreaLabelRenderer,
    vote_card:         VoteCardRenderer,
    checklist:         ChecklistRenderer,
    link_card:         LinkCardRenderer,
    table_ref:         TableRefRenderer,
    room_info:         RoomInfoRenderer,
    guest_count:       GuestCountRenderer,
  }
  const Comp = map[props.item.type]
  if (!Comp) return <div style={{ padding: 8, fontSize: 11, color: '#E06C75' }}>Unbekannter Typ: {props.item.type}</div>
  return <Comp {...props} />
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  background: '#FFFFFF',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.07)',
  overflow: 'hidden',
  boxSizing: 'border-box',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  display: 'flex', flexDirection: 'column',
}

const emptyStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  background: '#faf8f5',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  borderRadius: 8,
  border: '1.5px dashed #d8d0c6',
  boxSizing: 'border-box',
}

const emptyLabel: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-tertiary)',
  textAlign: 'center', padding: '0 12px', lineHeight: 1.4,
}

function availBadge(availability: string | null | undefined) {
  if (!availability || availability === 'available') return null
  const map: Record<string, { label: string; color: string; bg: string }> = {
    limited: { label: 'Begrenzt', color: '#8B6914', bg: '#FFF8DC' },
    unavailable: { label: 'Nicht verfügbar', color: '#9B1C1C', bg: '#FEE2E2' },
  }
  const v = map[availability]
  if (!v) return null
  return (
    <div style={{ marginTop: 5, fontSize: 10, color: v.color, fontWeight: 600, background: v.bg, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 20 }}>
      ● {v.label}
    </div>
  )
}
