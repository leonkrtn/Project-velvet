'use client'

import React from 'react'
import { RotateCcw } from 'lucide-react'
import { HelpTip } from '@/components/ui/HelpTooltip'

// Gemeinsame, kompakte UI-Primitive für das Design-Studio (Optionen-Dialog-Stil).

export const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, gap: 6,
  padding: '7px 13px', borderRadius: 8, border: '1px solid var(--bp-rule)', background: '#fff',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--bp-ink-2)',
  transition: 'all .12s ease',
}
export const chipActive: React.CSSProperties = { background: 'var(--bp-ink)', color: '#fff', borderColor: 'var(--bp-ink)' }

// „?"-Hilfe pro Option (nutzt jetzt die zentrale, hover-fähige Komponente).
export function Help({ text }: { text: string }) {
  return <HelpTip text={text} />
}

// Beschriftung mit optionaler Hilfe.
export function Label({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', system-ui, sans-serif",
      fontSize: 13.5, fontWeight: 500, color: 'var(--bp-ink-2)' }}>
      {children}{help && <Help text={help} />}
    </span>
  )
}

// Zeile: Label links, Steuerung rechts (für Toggles / Segmente).
export function Row({ label, help, children }: { label: React.ReactNode; help?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, minHeight: 34 }}>
      <Label help={help}>{label}</Label>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

// Block: Label oben, Steuerung darunter (für breitere Controls).
export function Stack({ label, help, children }: { label: React.ReactNode; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}><Label help={help}>{label}</Label></div>
      {children}
    </div>
  )
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0,
        background: checked ? 'var(--bp-gold-deep)' : 'var(--bp-rule)', transition: 'background .15s ease' }}>
      <span style={{ display: 'block', width: 20, height: 20, borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: checked ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .15s ease' }} />
    </button>
  )
}

export function Segment<T extends string>({ value, onChange, options }:
  { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {options.map(([val, label]) => (
        <button key={val} type="button" onClick={() => onChange(val)}
          style={{ ...chip, padding: '6px 11px', ...(value === val ? chipActive : {}) }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// Farbauswahl: Presets + freie Farbe.
export function Swatches({ value, onChange, presets, allowCustom = true }:
  { value: string; onChange: (hex: string) => void; presets: { label: string; value: string }[]; allowCustom?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {presets.map(p => {
        const active = value.toLowerCase() === p.value.toLowerCase()
        return (
          <button key={p.value} type="button" title={p.label} onClick={() => onChange(p.value)}
            style={{ width: 28, height: 28, borderRadius: 8, background: p.value, cursor: 'pointer', position: 'relative',
              border: active ? '2px solid var(--bp-ink)' : '1px solid rgba(0,0,0,0.15)',
              boxShadow: active ? '0 0 0 2px #fff inset' : 'none' }} />
        )
      })}
      {allowCustom && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--bp-ink-3)', cursor: 'pointer' }}>
          <span style={{ position: 'relative', width: 28, height: 28, borderRadius: 8, overflow: 'hidden', border: '1px dashed var(--bp-rule)', display: 'inline-block' }}>
            <input type="color" value={value} onChange={e => onChange(e.target.value)}
              style={{ position: 'absolute', inset: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', border: 'none', padding: 0, cursor: 'pointer' }} />
          </span>
          Eigene
        </label>
      )}
    </div>
  )
}

export function Slider({ value, min, max, step = 1, onChange, suffix }:
  { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--bp-gold-deep)' }} />
      <span style={{ fontSize: 12, color: 'var(--bp-ink-2)', minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value}{suffix}
      </span>
    </div>
  )
}

// Gruppen-Überschrift mit optionalem „Zurücksetzen".
export function GroupTitle({ title, hint, onReset }: { title: string; hint?: string; onReset?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
      <div>
        <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '1.0625rem', fontWeight: 600, color: 'var(--bp-ink)', margin: 0 }}>{title}</h3>
        {hint && <p style={{ fontSize: 12.5, color: 'var(--bp-ink-3)', margin: '3px 0 0', maxWidth: 520, lineHeight: 1.45 }}>{hint}</p>}
      </div>
      {onReset && (
        <button type="button" onClick={onReset} title="Diesen Bereich zurücksetzen"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--bp-rule)', background: '#fff',
            borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 12, color: 'var(--bp-ink-2)', flexShrink: 0, fontFamily: 'inherit' }}>
          <RotateCcw size={12} /> Zurücksetzen
        </button>
      )}
    </div>
  )
}

// Dezente Trennlinie zwischen Optionen.
export function Hr() {
  return <div style={{ height: 1, background: 'var(--bp-rule)', margin: '18px 0' }} />
}
