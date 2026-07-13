'use client'
import React from 'react'

export interface SegmentedToggleOption<T extends string> {
  key: T
  label: React.ReactNode
  icon?: React.ComponentType<{ size?: number }>
  'data-tour'?: string
}

interface Props<T extends string> {
  value: T
  onChange: (v: T) => void
  options: SegmentedToggleOption<T>[]
  size?: 'sm' | 'md'
  className?: string
  style?: React.CSSProperties
  'data-tour'?: string
}

/**
 * Einheitlicher Segmented-Toggle für die Vendor-Plattform (z.B. Kalender Monat/Agenda).
 * Aktiv = blau gefüllt, inaktiv = transparent, Hover auf inaktiven Optionen = blaue Fläche.
 */
export default function SegmentedToggle<T extends string>({
  value, onChange, options, size = 'md', className, style, ...rest
}: Props<T>) {
  const padY = size === 'sm' ? 5 : 6
  const padX = size === 'sm' ? 10 : 12
  const fontSize = size === 'sm' ? 12 : 13

  return (
    <div
      className={`vdr-segtoggle${className ? ` ${className}` : ''}`}
      style={{ display: 'flex', background: 'var(--bg)', borderRadius: 9, padding: 3, gap: 2, ...style }}
      {...rest}
    >
      {options.map(opt => {
        const active = opt.key === value
        const Icon = opt.icon
        return (
          <button
            key={opt.key}
            type="button"
            className="vdr-segtoggle-btn"
            data-active={active ? 'true' : undefined}
            data-tour={opt['data-tour']}
            onClick={() => onChange(opt.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: `${padY}px ${padX}px`, borderRadius: 7, fontSize, fontWeight: 500,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              background: active ? 'var(--accent, #2352C8)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary, #666)',
              transition: 'background .15s, color .15s',
              whiteSpace: 'nowrap',
            }}
          >
            {Icon && <Icon size={14} />}
            {opt.label}
          </button>
        )
      })}
      <style>{`
        .vdr-segtoggle-btn:not([data-active="true"]):hover{background:rgba(35,82,200,0.12)!important;color:var(--accent, #2352C8)!important}
      `}</style>
    </div>
  )
}
