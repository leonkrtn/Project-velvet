'use client'
import React, { useState, useEffect } from 'react'
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
  const [loading, setLoading]             = useState(true)
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

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Fotos</h1>

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
