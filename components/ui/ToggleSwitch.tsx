'use client'

import React from 'react'

/**
 * Wiederverwendbarer An/Aus-Schalter (iOS-Stil) als Ersatz fuer Checkbox-Toggles.
 * Drop-in: ersetzt ein <input type="checkbox"> — onChange liefert den neuen
 * Boolean direkt. Fuer Mehrfachauswahl/Selektion/Zustimmung weiterhin Checkbox.
 */
export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  onColor = '#34C759',
  title,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  onColor?: string
  title?: string
  id?: string
  'aria-label'?: string
}) {
  const w = size === 'sm' ? 34 : 42
  const h = size === 'sm' ? 20 : 24
  const knob = h - 4
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      id={id}
      disabled={disabled}
      onClick={e => { e.stopPropagation(); if (!disabled) onChange(!checked) }}
      style={{
        position: 'relative', width: w, height: h, flexShrink: 0, padding: 0,
        border: 'none', borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        background: checked ? onColor : '#D1D1D6',
        transition: 'background 0.2s ease', opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, left: checked ? w - knob - 2 : 2,
          width: knob, height: knob, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s ease',
        }}
      />
    </button>
  )
}
