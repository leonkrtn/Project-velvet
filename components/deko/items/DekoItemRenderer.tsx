'use client'
import React, { useState, useEffect } from 'react'
import { MapPin, Clock, Check, Link, Users, Info, Layers, Minus } from 'lucide-react'
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

function ImageUploadRenderer({ item }: RendererProps) {
  const d = item.data as ImageUploadData
  if (!d.preview_url) return (
    <div style={placeholderStyle('var(--surface)')}>
      <span style={{ fontSize: 28 }}>🖼</span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Doppelklick zum Bearbeiten</span>
    </div>
  )
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 4 }}>
      <img src={d.preview_url} alt={d.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {d.caption && <div style={captionStyle}>{d.caption}</div>}
    </div>
  )
}

// ── 2. ImageUrl ───────────────────────────────────────────────────────────────

function ImageUrlRenderer({ item }: RendererProps) {
  const d = item.data as ImageUrlData
  if (!d.url && !d.preview_url) return (
    <div style={placeholderStyle('var(--surface)')}>
      <span style={{ fontSize: 28 }}>🌐</span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Doppelklick → URL eingeben</span>
    </div>
  )
  const src = d.preview_url || d.url
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 4 }}>
      <img src={src} alt={d.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      {d.caption && <div style={captionStyle}>{d.caption}</div>}
    </div>
  )
}

// ── 3. ColorPalette ───────────────────────────────────────────────────────────

function ColorPaletteRenderer({ item }: RendererProps) {
  const d = item.data as ColorPaletteData
  const colors = d.colors ?? []
  if (!colors.length) return (
    <div style={placeholderStyle('#fff')}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Doppelklick → Farben bearbeiten</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', height: '100%', borderRadius: 4, overflow: 'hidden' }}>
      {colors.map(c => (
        <div key={c.hex} title={c.name} style={{ flex: 1, background: c.hex, position: 'relative' }}>
          <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)', fontWeight: 600 }}>{c.name}</span>
        </div>
      ))}
    </div>
  )
}

// ── 4. ColorSwatch ────────────────────────────────────────────────────────────

function ColorSwatchRenderer({ item }: RendererProps) {
  const d = item.data as ColorSwatchData
  return (
    <div style={{ width: '100%', height: '100%', background: d.hex || '#eee', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: 6, boxSizing: 'border-box' }}>
      {d.name && <span style={{ fontSize: 10, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.5)', fontWeight: 600 }}>{d.name}</span>}
    </div>
  )
}

// ── 5. TextBlock ──────────────────────────────────────────────────────────────

function TextBlockRenderer({ item, canEdit, onDataChange }: RendererProps) {
  const d = item.data as TextBlockData
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.content ?? '')

  if (editing) return (
    <textarea
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); onDataChange({ content: draft }) }}
      style={{ width: '100%', height: '100%', border: 'none', outline: 'none', resize: 'none', padding: 12, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', boxSizing: 'border-box', borderRadius: 4 }}
    />
  )
  return (
    <div
      style={{ width: '100%', height: '100%', padding: 12, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', borderRadius: 4, overflow: 'hidden', boxSizing: 'border-box', lineHeight: 1.6, whiteSpace: 'pre-wrap', cursor: canEdit ? 'text' : 'default' }}
      onDoubleClick={() => canEdit && setEditing(true)}
    >
      {d.content || <span style={{ color: 'var(--text-tertiary)' }}>Doppelklick → Text eingeben</span>}
    </div>
  )
}

// ── 6. StickyNote ─────────────────────────────────────────────────────────────

const STICKY_COLORS = ['#FFF3CD', '#D1ECF1', '#D4EDDA', '#F8D7DA', '#E2D9F3', '#FFE5B4']

function StickyNoteRenderer({ item, canEdit, onDataChange }: RendererProps) {
  const d = item.data as StickyNoteData
  const bg = d.color || STICKY_COLORS[0]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.content ?? '')
  return (
    <div style={{ width: '100%', height: '100%', background: bg, borderRadius: 4, padding: 12, boxSizing: 'border-box', boxShadow: '2px 3px 8px rgba(0,0,0,.1)', position: 'relative' }}>
      {/* color row */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {STICKY_COLORS.map(c => (
          <div key={c} onClick={() => onDataChange({ ...d, color: c })}
            style={{ width: 12, height: 12, borderRadius: '50%', background: c, cursor: 'pointer', border: c === bg ? '2px solid #666' : '1px solid rgba(0,0,0,.2)' }} />
        ))}
      </div>
      {editing
        ? <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={() => { setEditing(false); onDataChange({ ...d, content: draft }) }}
            style={{ width: '100%', height: 'calc(100% - 28px)', border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        : <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', cursor: canEdit ? 'text' : 'default' }}
            onDoubleClick={() => canEdit && setEditing(true)}>
            {d.content || <span style={{ color: 'rgba(0,0,0,.3)' }}>Notiz…</span>}
          </div>
      }
    </div>
  )
}

// ── 7. Heading ────────────────────────────────────────────────────────────────

function HeadingRenderer({ item, canEdit, onDataChange }: RendererProps) {
  const d = item.data as HeadingData
  const sizes: Record<number, number> = { 1: 28, 2: 20, 3: 15 }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.text ?? '')
  if (editing) return (
    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); onDataChange({ ...d, text: draft }) }}
      onKeyDown={e => e.key === 'Enter' && (setEditing(false), onDataChange({ ...d, text: draft }))}
      style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: sizes[d.level ?? 1], fontWeight: 700, letterSpacing: '-0.5px', fontFamily: 'inherit', boxSizing: 'border-box' }}
    />
  )
  return (
    <div style={{ fontSize: sizes[d.level ?? 1], fontWeight: 700, letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', height: '100%', display: 'flex', alignItems: 'center', cursor: canEdit ? 'text' : 'default' }}
      onDoubleClick={() => canEdit && setEditing(true)}>
      {d.text || <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 14 }}>Überschrift…</span>}
    </div>
  )
}

// ── 8. Article ────────────────────────────────────────────────────────────────

function ArticleRenderer({ item, catalog }: RendererProps) {
  const d = item.data as ArticleData
  const cat = catalog.find(c => c.id === d.catalog_item_id)
  if (!cat) return (
    <div style={cardStyle}>
      <div style={placeholderStyle('#f9f6f1')}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Artikel wählen (Doppelklick)</span>
      </div>
    </div>
  )
  const lineTotal = cat.is_free ? null : cat.flat_rate_id ? null : (cat.price_per_unit ?? 0) * (d.quantity ?? 1)
  return (
    <div style={cardStyle}>
      {cat.image_url
        ? <img src={cat.image_url} alt={cat.name} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
        : <div style={{ height: 80, background: '#f2ede7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🌸</div>
      }
      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{cat.name}</p>
        {cat.color && <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{cat.color}</p>}
        {cat.material && <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{cat.material}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 11, background: '#f2ede7', padding: '2px 6px', borderRadius: 20 }}>×{d.quantity ?? 1}</span>
          {cat.is_free
            ? <span style={{ fontSize: 10, color: '#4CAF50', fontWeight: 600 }}>Gratis</span>
            : cat.flat_rate_id
              ? <span style={{ fontSize: 10, color: '#C9B99A', fontWeight: 600 }}>Pauschale</span>
              : lineTotal != null && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{fmt(lineTotal)}</span>
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
        ? <img src={cat.image_url} alt={cat?.name ?? ''} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
        : <div style={{ height: 60, background: '#f2ede7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📦</div>
      }
      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{cat?.name ?? 'Pauschalen-Artikel'}</p>
        <div style={{ fontSize: 10, color: '#C9B99A', fontWeight: 600, marginBottom: 4 }}>
          {d.is_free ? '✓ Gratis' : fr ? `Pauschale: ${fr.name}` : 'Pauschale'}
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
      <div style={placeholderStyle('#f9f6f1')}>
        <span style={{ fontSize: 28 }}>🧵</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Stoff wählen (Doppelklick)</span>
      </div>
    </div>
  )
  const lineTotal = cat.is_free ? null : (cat.price_per_meter ?? 0) * (d.quantity_meters ?? 1)
  return (
    <div style={cardStyle}>
      {cat.image_url
        ? <img src={cat.image_url} alt={cat.name} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
        : <div style={{ height: 80, background: '#f0ebe4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🧵</div>
      }
      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{cat.name}</p>
        {cat.color && <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{cat.color}</p>}
        {cat.fabric_type && <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{cat.fabric_type}</p>}
        {cat.fabric_width_cm && <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Breite: {cat.fabric_width_cm} cm</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 11, background: '#f2ede7', padding: '2px 6px', borderRadius: 20 }}>{d.quantity_meters ?? 1} m</span>
          {lineTotal != null && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{fmt(lineTotal)}</span>}
        </div>
      </div>
    </div>
  )
}

// ── 11. Frame ─────────────────────────────────────────────────────────────────

function FrameRenderer({ item }: RendererProps) {
  const d = item.data as FrameData
  return (
    <div style={{
      width: '100%', height: '100%',
      background: d.color ? `${d.color}${Math.round((d.opacity ?? 0.1) * 255).toString(16).padStart(2, '0')}` : 'rgba(201,185,154,0.08)',
      border: `2px solid ${d.color || '#C9B99A'}`,
      borderRadius: 8, boxSizing: 'border-box',
    }}>
      {d.label && <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: d.color || '#C9B99A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d.label}</div>}
    </div>
  )
}

// ── 12. Divider ───────────────────────────────────────────────────────────────

function DividerRenderer({ item }: RendererProps) {
  const d = item.data as DividerData
  const isH = (d.orientation ?? 'horizontal') === 'horizontal'
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: isH ? '100%' : 2, height: isH ? 2 : '100%',
        background: d.color || 'var(--border)',
        borderStyle: d.style || 'solid',
      }} />
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
      borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', boxSizing: 'border-box',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: d.color || '#fff', whiteSpace: 'nowrap' }}>{d.text || 'Bereich'}</span>
    </div>
  )
}

// ── 14. VoteCard ──────────────────────────────────────────────────────────────

function VoteCardRenderer({ item, eventId, userId, onVoteChange }: RendererProps) {
  const d = item.data as VoteCardData
  const [votes, setVotes] = useState<{ up: number; down: number; mine: 'up' | 'down' | null }>({ up: 0, down: 0, mine: null })

  useEffect(() => {
    const supabase = createClient()
    supabase.from('deko_votes').select('vote, user_id').eq('item_id', item.id)
      .then(({ data }) => {
        if (!data) return
        const up = data.filter(v => v.vote === 'up').length
        const down = data.filter(v => v.vote === 'down').length
        const mine = data.find(v => v.user_id === userId)?.vote as 'up' | 'down' | null ?? null
        setVotes({ up, down, mine })
      })
  }, [item.id, userId])

  async function vote(v: 'up' | 'down') {
    const supabase = createClient()
    if (votes.mine === v) {
      await supabase.from('deko_votes').delete().eq('item_id', item.id).eq('user_id', userId)
      setVotes(p => ({ ...p, [v]: p[v] - 1, mine: null }))
    } else {
      if (votes.mine) {
        await supabase.from('deko_votes').update({ vote: v }).eq('item_id', item.id).eq('user_id', userId)
        setVotes(p => ({ ...p, [votes.mine!]: p[votes.mine!] - 1, [v]: p[v] + 1, mine: v }))
      } else {
        await supabase.from('deko_votes').insert({ item_id: item.id, event_id: eventId, user_id: userId, vote: v })
        setVotes(p => ({ ...p, [v]: p[v] + 1, mine: v }))
      }
    }
    onVoteChange()
  }

  return (
    <div style={cardStyle}>
      {d.image_url
        ? <img src={d.image_url} alt={d.title} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
        : <div style={{ height: 100, background: '#f2ede7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🗳</div>
      }
      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{d.title || 'Variante'}</p>
        {d.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>{d.description}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); vote('up') }}
            style={{ ...voteBtnStyle, background: votes.mine === 'up' ? '#D4EDDA' : '#f5f3f0', color: '#2d7a4f' }}>
            👍 {votes.up}
          </button>
          <button onClick={e => { e.stopPropagation(); vote('down') }}
            style={{ ...voteBtnStyle, background: votes.mine === 'down' ? '#F8D7DA' : '#f5f3f0', color: '#7a2d2d' }}>
            👎 {votes.down}
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
  function toggle(id: string) {
    if (!canEdit) return
    onDataChange({ ...d, items: items.map(i => i.id === id ? { ...i, checked: !i.checked } : i) })
  }
  const done = items.filter(i => i.checked).length
  return (
    <div style={{ ...cardStyle, padding: 12 }}>
      {d.title && <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{d.title}</p>}
      {items.length === 0 && <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Doppelklick → Punkte hinzufügen</p>}
      {items.map(i => (
        <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, cursor: canEdit ? 'pointer' : 'default' }}
          onClick={() => toggle(i.id)}>
          <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${i.checked ? '#4CAF50' : 'var(--border)'}`, background: i.checked ? '#4CAF50' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {i.checked && <Check size={9} color="white" />}
          </div>
          <span style={{ fontSize: 12, textDecoration: i.checked ? 'line-through' : 'none', color: i.checked ? 'var(--text-tertiary)' : 'var(--text)', lineHeight: 1.3 }}>{i.text}</span>
        </div>
      ))}
      {items.length > 0 && <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>{done}/{items.length}</p>}
    </div>
  )
}

// ── 16. LinkCard ──────────────────────────────────────────────────────────────

function LinkCardRenderer({ item }: RendererProps) {
  const d = item.data as LinkCardData
  if (!d.url) return (
    <div style={{ ...cardStyle, ...placeholderStyle('var(--surface)') }}>
      <Link size={20} color="var(--text-tertiary)" />
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Doppelklick → URL eingeben</span>
    </div>
  )
  return (
    <div style={{ ...cardStyle, overflow: 'hidden' }}
      onClick={e => { e.stopPropagation(); window.open(d.url, '_blank') }}>
      {d.image_url && <img src={d.image_url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
      <div style={{ padding: '8px 10px' }}>
        {d.domain && <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{d.domain}</p>}
        <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginBottom: 2 }}>{d.title || d.url}</p>
        {d.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.description}</p>}
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
      .then(({ data }) => { if (data) setTable(data as typeof table) })
  }, [d.table_id])
  return (
    <div style={{ ...cardStyle, padding: 12, background: '#f5f0ea' }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Tisch-Referenz</p>
      {table
        ? <>
          <p style={{ fontSize: 13, fontWeight: 700 }}>{table.name || d.label || 'Tisch'}</p>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{table.shape} · {table.capacity} Plätze</p>
        </>
        : <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Doppelklick → Tisch wählen</p>
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
        if (data?.config) {
          const c = data.config as Record<string, unknown>
          setInfo({ area_sqm: c.area_sqm as number, name: c.name as string })
        }
      })
  }, [eventId])
  return (
    <div style={{ ...cardStyle, padding: 12, background: '#f5f0ea' }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Rauminfo</p>
      {info
        ? <>
          {info.name && <p style={{ fontSize: 13, fontWeight: 700 }}>{info.name}</p>}
          {info.area_sqm && <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{info.area_sqm} m²</p>}
        </>
        : <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Kein Raum konfiguriert</p>
      }
    </div>
  )
}

// ── 19. GuestCount ────────────────────────────────────────────────────────────

function GuestCountRenderer({ eventId }: RendererProps) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.from('guests').select('id', { count: 'exact', head: true }).eq('event_id', eventId)
      .then(({ count: c }) => setCount(c))
  }, [eventId])
  return (
    <div style={{ ...cardStyle, padding: 12, background: '#f5f0ea', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <Users size={24} color="var(--text-tertiary)" style={{ marginBottom: 6 }} />
      <p style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{count ?? '…'}</p>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Gäste</p>
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
  if (!Comp) return <div style={{ padding: 8, fontSize: 11, color: 'red' }}>Unbekannter Typ: {props.item.type}</div>
  return <Comp {...props} />
}

// ── Shared styles ─────────────────────────────────────────────────────────────

function placeholderStyle(bg: string): React.CSSProperties {
  return { width: '100%', height: '100%', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: '1px dashed var(--border)' }
}

const cardStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  background: 'var(--surface)',
  borderRadius: 6,
  border: '1px solid var(--border)',
  overflow: 'hidden',
  boxSizing: 'border-box',
}

const captionStyle: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  background: 'rgba(0,0,0,.45)', color: '#fff',
  padding: '4px 8px', fontSize: 11,
}

function availBadge(availability: string | null | undefined) {
  if (!availability || availability === 'available') return null
  const map: Record<string, { label: string; color: string }> = {
    limited: { label: 'Begrenzt', color: '#E5C07B' },
    unavailable: { label: 'Nicht verfügbar', color: '#E06C75' },
  }
  const v = map[availability]
  if (!v) return null
  return <div style={{ marginTop: 4, fontSize: 10, color: v.color, fontWeight: 600 }}>● {v.label}</div>
}

const voteBtnStyle: React.CSSProperties = {
  flex: 1, padding: '4px 0', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
}
