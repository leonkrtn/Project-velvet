'use client'
import React from 'react'
import {
  CalendarClock, Armchair, Users, UtensilsCrossed, Wine, Music,
  Cake, Database, type LucideIcon,
} from 'lucide-react'
import type { ModuleSnapshot, ShareModule, SnapshotBlock } from '@/lib/vendor/shares'

const GOLD = 'var(--bp-gold, #B89968)'
const GOLD_DEEP = 'var(--bp-gold-deep, #9C7F4F)'
const GOLD_PALE = 'var(--bp-gold-pale, #F5F0E8)'
const SERIF = "'Cormorant Garamond', Georgia, serif"

// Per-module banner (icon + a one-line caption describing what the package is).
const MODULE_THEME: Record<ShareModule, { icon: LucideIcon; caption: string }> = {
  ablaufplan:  { icon: CalendarClock,  caption: 'Zeitlicher Ablauf des Events' },
  sitzplan:    { icon: Armchair,       caption: 'Tische & Sitzordnung' },
  gaesteliste: { icon: Users,          caption: 'Gästezahlen & Essenswünsche' },
  catering:    { icon: UtensilsCrossed,caption: 'Catering-Konzept & Menü' },
  getraenke:   { icon: Wine,           caption: 'Getränke- & Cocktailplanung' },
  musik:       { icon: Music,          caption: 'Musikwünsche & Technik' },
  patisserie:  { icon: Cake,           caption: 'Torte & Patisserie' },
}

// Renders a ModuleSnapshot (the data inside a shared box) with a layout tuned per type.
export default function ShareBox({ snapshot }: { snapshot: ModuleSnapshot }) {
  const theme = MODULE_THEME[snapshot.module]
  const Icon = theme?.icon ?? Database

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, background: GOLD_PALE,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={22} style={{ color: GOLD_DEEP }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 600, lineHeight: 1.1, letterSpacing: '0.01em', color: 'var(--text-primary, #1d1d1f)' }}>
            {snapshot.label}
          </div>
          {theme && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary, #999)', marginTop: 2 }}>{theme.caption}</div>}
        </div>
      </div>

      {snapshot.empty || snapshot.blocks.length === 0 ? (
        <div style={{
          padding: '28px 20px', textAlign: 'center', borderRadius: 14,
          border: '1px dashed var(--border, #e5e0d8)', background: GOLD_PALE,
        }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-tertiary, #999)', fontStyle: 'italic', margin: 0 }}>
            Für diesen Bereich wurden noch keine Daten erfasst.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {snapshot.blocks.map((block, i) => <Block key={i} block={block} />)}
        </div>
      )}
    </div>
  )
}

function Heading({ text }: { text?: string }) {
  if (!text) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
      <span style={{ width: 16, height: 2, borderRadius: 2, background: GOLD, flexShrink: 0 }} />
      <span style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: GOLD_DEEP,
      }}>{text}</span>
    </div>
  )
}

function Block({ block }: { block: SnapshotBlock }) {
  switch (block.kind) {
    case 'stats':    return <StatsBlock block={block} />
    case 'timeline': return <TimelineBlock block={block} />
    case 'tags':     return <TagsBlock block={block} />
    case 'swatches': return <SwatchesBlock block={block} />
    case 'images':   return <ImagesBlock block={block} />
    case 'menu':     return <MenuBlock block={block} />
    case 'songs':    return <SongsBlock block={block} />
    case 'keyvalue': return <KeyValueBlock block={block} />
    case 'list':     return <ListBlock block={block} />
    case 'text':     return <TextBlock block={block} />
    case 'table':    return <TableBlock block={block} />
    default:         return null
  }
}

// ── Rich blocks ───────────────────────────────────────────────────────────────

function StatsBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'stats' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {block.items.map((it, i) => (
          <div key={i} style={{
            flex: '1 1 120px', minWidth: 110, padding: '14px 16px', borderRadius: 14,
            background: GOLD_PALE, border: `1px solid var(--border, #e5e0d8)`,
          }}>
            <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, lineHeight: 1, color: GOLD_DEEP }}>{it.value}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary, #555)', marginTop: 6 }}>{it.label}</div>
            {it.sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary, #999)', marginTop: 1 }}>{it.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'timeline' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ position: 'relative', paddingLeft: 18 }}>
        <span style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 2, background: 'var(--border, #e5e0d8)', borderRadius: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {block.items.map((it, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: -18, top: 4, width: 10, height: 10, borderRadius: '50%', background: GOLD, border: '2px solid var(--surface, #fff)', boxShadow: `0 0 0 1px ${GOLD}` }} />
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: GOLD_DEEP, minWidth: 52, flexShrink: 0 }}>{it.time}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #1d1d1f)' }}>{it.title}</div>
                  {(it.meta || it.category) && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary, #999)', marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {it.meta && <span>{it.meta}</span>}
                      {it.category && <span style={{ color: GOLD_DEEP }}>· {it.category}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TagsBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'tags' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {block.items.map((t, i) => (
          <span key={i} style={{
            fontSize: 13, fontWeight: 500, color: GOLD_DEEP, background: GOLD_PALE,
            border: `1px solid var(--border, #e5e0d8)`, borderRadius: 20, padding: '5px 13px',
          }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

function SwatchesBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'swatches' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {block.items.map((s, i) => (
          <div key={i} style={{ width: 72, textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 12, background: s.hex, border: '1px solid rgba(0,0,0,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)' }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #555)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || s.hex}</div>
            {s.name && <div style={{ fontSize: 10, color: 'var(--text-tertiary, #999)', fontFamily: 'monospace' }}>{s.hex}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ImagesBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'images' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        {block.items.map((img, i) => (
          <figure key={i} style={{ margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.caption ?? ''} loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border, #e5e0d8)', display: 'block' }} />
            {img.caption && <figcaption style={{ fontSize: 11, color: 'var(--text-tertiary, #999)', marginTop: 4, textAlign: 'center' }}>{img.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  )
}

function MenuBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'menu' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {block.items.map((it, i) => (
          <div key={i} style={{
            padding: '12px 16px', borderRadius: 12, background: 'var(--surface, #fff)',
            border: `1px solid var(--border, #e5e0d8)`, borderLeft: `3px solid ${GOLD}`,
          }}>
            <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: 'var(--text-primary, #1d1d1f)' }}>{it.name}</div>
            {it.note && <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #555)', marginTop: 3, lineHeight: 1.4 }}>{it.note}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function SongsBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'songs' }> }) {
  const nogo = block.tone === 'nogo'
  const accent = nogo ? '#C0392B' : GOLD_DEEP
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {block.items.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 4px', borderBottom: i < block.items.length - 1 ? '1px solid var(--border, #f0ece4)' : 'none' }}>
            <Music size={14} style={{ color: accent, flexShrink: 0, opacity: nogo ? 0.6 : 1 }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary, #1d1d1f)', textDecoration: nogo ? 'line-through' : 'none' }}>{s.title}</span>
            {s.artist && <span style={{ fontSize: 13, color: 'var(--text-tertiary, #999)' }}>· {s.artist}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Generic blocks (also used as fallback for older snapshots) ─────────────────

function KeyValueBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'keyvalue' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 12, border: '1px solid var(--border, #e5e0d8)', overflow: 'hidden' }}>
        {block.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13.5, lineHeight: 1.4, padding: '10px 14px', background: i % 2 ? 'var(--bg, #FAFAFA)' : 'var(--surface, #fff)' }}>
            <span style={{ color: 'var(--text-secondary, #555)', fontWeight: 600, minWidth: 150, flexShrink: 0 }}>{it.label}</span>
            <span style={{ color: 'var(--text-primary, #1d1d1f)', whiteSpace: 'pre-wrap' }}>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'list' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {block.items.map((it, i) => (
          <li key={i} style={{ fontSize: 13.5, color: 'var(--text-primary, #1d1d1f)', lineHeight: 1.4, display: 'flex', gap: 9 }}>
            <span style={{ color: GOLD, flexShrink: 0 }}>•</span>
            <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TextBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'text' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <p style={{ fontSize: 13.5, color: 'var(--text-primary, #1d1d1f)', whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }}>{block.text}</p>
    </div>
  )
}

function TableBlock({ block }: { block: Extract<SnapshotBlock, { kind: 'table' }> }) {
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ overflowX: 'auto', border: '1px solid var(--border, #e5e0d8)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {block.columns.map((c, i) => (
                <th key={i} style={{
                  textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: GOLD_DEEP, background: GOLD_PALE,
                  borderBottom: '1px solid var(--border, #e5e0d8)', whiteSpace: 'nowrap',
                }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? 'var(--bg, #FAFAFA)' : 'var(--surface, #fff)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '9px 14px', color: 'var(--text-primary, #1d1d1f)',
                    borderBottom: ri < block.rows.length - 1 ? '1px solid var(--border, #f0ece4)' : 'none',
                    verticalAlign: 'top',
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
