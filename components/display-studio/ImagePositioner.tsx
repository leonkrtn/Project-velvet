'use client'

import React, { useRef } from 'react'
import { ImagePlus, Loader2, Trash2, Move } from 'lucide-react'
import { focusPosition, focusSize, type ImageFocus } from '@/lib/display-settings'
import { Slider } from './ui'

// Bild-Zuschnitt/Positionierung: Vorschau-Rahmen mit ziehbarem Fokuspunkt + Zoom.
// Speichert keinen Pixel-Crop, sondern Fokus (x/y %) + Zoom → wird als
// background-position/-size angewendet (identisch in Vorschau & echter Seite).
export default function ImagePositioner({
  url, focus, onFocusChange, onPick, onRemove, busy, aspect = 16 / 9, uploadLabel = 'Bild hochladen',
}: {
  url: string | null
  focus: ImageFocus
  onFocusChange: (f: ImageFocus) => void
  onPick: (file: File) => void
  onRemove: () => void
  busy?: boolean
  aspect?: number
  uploadLabel?: string
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    if (!url) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, fx: focus.x, fy: focus.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    const nx = Math.max(0, Math.min(100, drag.current.fx - (dx / rect.width) * 100))
    const ny = Math.max(0, Math.min(100, drag.current.fy - (dy / rect.height) * 100))
    onFocusChange({ ...focus, x: Math.round(nx), y: Math.round(ny) })
  }
  function onPointerUp() { drag.current = null }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (f && f.type.startsWith('image/')) onPick(f)
  }

  return (
    <div>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: 'relative', width: '100%', aspectRatio: String(aspect), borderRadius: 12, overflow: 'hidden',
          border: '1px solid var(--bp-rule)', background: url ? '#000' : 'var(--bp-ivory-2)',
          backgroundImage: url ? `url(${url})` : undefined,
          backgroundSize: url ? focusSize(focus) : undefined,
          backgroundPosition: url ? focusPosition(focus) : undefined,
          backgroundRepeat: 'no-repeat',
          cursor: url ? 'move' : 'default', userSelect: 'none', touchAction: 'none',
        }}
      >
        {url ? (
          <div style={{ position: 'absolute', left: 8, bottom: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 7, pointerEvents: 'none' }}>
            <Move size={12} /> Ziehen zum Positionieren
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--bp-ink-3)', fontSize: 13, gap: 6 }}>
            <ImagePlus size={16} /> Noch kein Bild
          </div>
        )}
      </div>

      {url && (
        <div style={{ marginTop: 12 }}>
          <Slider value={focus.zoom} min={1} max={3} step={0.05} onChange={z => onFocusChange({ ...focus, zoom: Math.round(z * 100) / 100 })} suffix="×" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={handlePick} />
        <button type="button" className="bp-btn bp-btn-sm" disabled={busy} onClick={() => fileInput.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {busy ? <Loader2 size={14} className="bp-spin" /> : <ImagePlus size={14} />} {url ? 'Ersetzen' : uploadLabel}
        </button>
        {url && (
          <button type="button" className="bp-btn bp-btn-sm" disabled={busy} onClick={onRemove}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--bp-red)' }}>
            <Trash2 size={14} /> Entfernen
          </button>
        )}
      </div>
    </div>
  )
}
