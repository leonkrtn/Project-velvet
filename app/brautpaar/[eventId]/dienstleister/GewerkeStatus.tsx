'use client'

import React from 'react'
import { Check, Clock } from 'lucide-react'
import { categoryLabel } from '@/lib/marketplace/types'
import CategoryIcon from '@/components/marketplace/CategoryIcon'

// Kompakte Gewerke-Übersicht über den Tabs: welche Kategorien sind schon
// gebucht, welche nur angefragt? Zeigt nur Gewerke mit Aktivität.
export default function GewerkeStatus({ booked, requested }: { booked: string[]; requested: string[] }) {
  const requestedOnly = requested.filter(c => !booked.includes(c))
  if (booked.length === 0 && requestedOnly.length === 0) return null

  const chip = (category: string, state: 'booked' | 'requested') => (
    <span
      key={`${state}-${category}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600,
        background: state === 'booked' ? '#E6F4EA' : '#FEF3E0',
        color: state === 'booked' ? '#1E7E34' : '#B26A00',
        border: `1px solid ${state === 'booked' ? '#BBE5C4' : '#F5DFB8'}`,
        whiteSpace: 'nowrap',
      }}
    >
      {state === 'booked' ? <Check size={12} /> : <Clock size={12} />}
      <CategoryIcon category={category} size={12} />
      {categoryLabel(category)}
    </span>
  )

  return (
    <div className="bp-card" style={{ padding: '0.8rem 1.1rem', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-ink-3,#8C8076)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 2 }}>
        Gewerke
      </span>
      <span className="bp-caption" style={{ marginRight: 6 }}>
        {booked.length} gebucht{requestedOnly.length > 0 ? ` · ${requestedOnly.length} angefragt` : ''}
      </span>
      {booked.map(c => chip(c, 'booked'))}
      {requestedOnly.map(c => chip(c, 'requested'))}
    </div>
  )
}
