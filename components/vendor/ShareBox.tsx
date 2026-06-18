'use client'
import React from 'react'
import type { ModuleSnapshot, SnapshotBlock } from '@/lib/vendor/shares'

// Renders a ModuleSnapshot (the data inside a shared box).
export default function ShareBox({ snapshot }: { snapshot: ModuleSnapshot }) {
  if (snapshot.empty || snapshot.blocks.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
        Für diesen Bereich wurden noch keine Daten erfasst.
      </p>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {snapshot.blocks.map((block, i) => <Block key={i} block={block} />)}
    </div>
  )
}

function Heading({ text }: { text?: string }) {
  if (!text) return null
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8,
    }}>
      {text}
    </div>
  )
}

function Block({ block }: { block: SnapshotBlock }) {
  if (block.kind === 'keyvalue') {
    return (
      <div>
        <Heading text={block.heading} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {block.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13.5, lineHeight: 1.4 }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500, minWidth: 150, flexShrink: 0 }}>{it.label}</span>
              <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{it.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (block.kind === 'list') {
    return (
      <div>
        <Heading text={block.heading} />
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {block.items.map((it, i) => (
            <li key={i} style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>{it}</li>
          ))}
        </ul>
      </div>
    )
  }
  if (block.kind === 'text') {
    return (
      <div>
        <Heading text={block.heading} />
        <p style={{ fontSize: 13.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }}>{block.text}</p>
      </div>
    )
  }
  // table
  return (
    <div>
      <Heading text={block.heading} />
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {block.columns.map((c, i) => (
                <th key={i} style={{
                  textAlign: 'left', padding: '8px 12px', fontWeight: 600,
                  color: 'var(--text-secondary)', background: 'var(--bg)',
                  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '8px 12px', color: 'var(--text-primary)',
                    borderBottom: ri < block.rows.length - 1 ? '1px solid var(--border)' : 'none',
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
