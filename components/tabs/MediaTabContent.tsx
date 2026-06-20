'use client'
import React, { useState, useEffect } from 'react'
import { ImageOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import GuestPhotosSection from '@/components/medien/GuestPhotosSection'

export interface ItemPerm { can_view: boolean; can_edit: boolean }

type Access = 'none' | 'read' | 'write'

interface Props {
  eventId: string
  mode: 'veranstalter' | 'dienstleister' | 'brautpaar'
  hasFullModuleAccess?: boolean
  itemPermissions?: Record<string, ItemPerm>
  tabAccess?: Access
  sectionPerms?: Record<string, Access>
  onPropose?: () => void
}

export default function MediaTabContent({ eventId, mode }: Props) {
  const [loading, setLoading]               = useState(true)
  const [galleryEnabled, setGalleryEnabled] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('feature_toggles')
      .select('enabled')
      .eq('event_id', eventId)
      .eq('key', 'gaeste-fotos')
      .maybeSingle()
      .then(({ data: ft }) => {
        setGalleryEnabled(ft?.enabled ?? true)
        setLoading(false)
      })
  }, [eventId])

  // ── Brautpaar: polished design-system look ──────────────────────────────
  if (mode === 'brautpaar') {
    return (
      <div>
        <div className="bp-page-header">
          <h1 className="bp-page-title">Bilder</h1>
          <p className="bp-page-subtitle">Sammelt die schönsten Momente eures Tages an einem Ort.</p>
        </div>

        {loading ? (
          <div className="bp-photo-skeleton-grid" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bp-skeleton" />
            ))}
          </div>
        ) : galleryEnabled ? (
          <GuestPhotosSection eventId={eventId} mode={mode} />
        ) : (
          <div className="bp-empty">
            <ImageOff className="bp-empty-icon" />
            <p className="bp-empty-title">Fotogalerie nicht aktiviert</p>
            <p className="bp-empty-body">
              Sobald die Gäste-Fotogalerie für euer Event freigeschaltet ist, erscheinen hier
              die Bilder eurer Gäste.
            </p>
          </div>
        )}
      </div>
    )
  }

  // ── Veranstalter / Dienstleister: unchanged ─────────────────────────────
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Bilder</h1>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : (
        galleryEnabled
          ? <GuestPhotosSection eventId={eventId} mode={mode} />
          : <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Fotogalerie ist nicht aktiviert.</div>
      )}
    </div>
  )
}
