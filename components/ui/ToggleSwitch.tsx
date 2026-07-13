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
  // Trefferfläche auf min. 44px anheben (Touch-Target), Track bleibt visuell in Originalgröße zentriert.
  const hitW = Math.max(w, 44)
  const hitH = Math.max(h, 44)
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
        position: 'relative', width: hitW, height: hitH, flexShrink: 0, padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', borderRadius: 999, background: 'none', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'relative', width: w, height: h, borderRadius: 999,
          background: checked ? onColor : '#D1D1D6', transition: 'background 0.2s ease',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 2, left: checked ? w - knob - 2 : 2,
            width: knob, height: knob, borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s ease',
          }}
        />
      </span>
    </button>
  )
}
