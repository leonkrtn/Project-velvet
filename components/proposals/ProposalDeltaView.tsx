'use client'
import React from 'react'
import { Plus, Minus, Edit3 } from 'lucide-react'
import type { DeltaField } from '@/lib/proposals'

interface Props {
  deltas: DeltaField[]
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '–'
  if (typeof v === 'boolean')  return v ? 'Ja' : 'Nein'
  if (typeof v === 'number')   return v.toString()
  if (typeof v === 'string')   return v || '–'
  if (Array.isArray(v))        return v.length === 0 ? '(leer)' : v.map(String).join(', ')
  try { return JSON.stringify(v) } catch { return String(v) }
}

function fieldLabel(delta: DeltaField): string {
  const labels: Record<string, string> = {
    '__entity__':              'Eintrag',
    'name':                    'Name',
    'title':                   'Titel',
    'price':                   'Preis',
    'price_per_night':         'Preis/Nacht',
    'description':             'Beschreibung',
    'notes':                   'Notizen',
    'time':                    'Uhrzeit',
    'duration_minutes':        'Dauer (min)',
    'available':               'Verfügbar',
    'capacity':                'Kapazität',
    'quantity':                'Menge',
    'service_style':           'Service-Stil',
    'min_persons':             'Min. Personen',
    'contingent':              'Kontingent',
    'booked':                  'Gebucht',
    'visible_to_brautpaar':    'Für Brautpaar sichtbar',
    'availability_confirmed':  'Verfügbarkeit bestätigt',
    'deposit_amount':          'Anzahlung',
    'stars':                   'Sterne',
    'distance_km':             'Entfernung (km)',
    'check_in_date':           'Check-in',
    'check_out_date':          'Check-out',
    'date':                    'Datum',
    'stage_setup_notes':       'Bühnen-Notizen',
    'sound_check_time':        'Soundcheck',
    'load_in_time':            'Aufbauzeit',
    'theme':                   'Thema',
    'color_palette':           'Farbpalette',
    'style_tags':              'Stil-Tags',
    'moodboard_urls':          'Moodboard',
    'servings_total':          'Portionen gesamt',
    'delivery_time':           'Lieferzeit',
    'setup_time':              'Aufbauzeit',
    'allergens':               'Allergene',
    'flavors':                 'Geschmacksrichtungen',
    'tiers':                   'Etagen',
    'servings':                'Portionen',
  }
  return labels[delta.field_key] ?? delta.field_key
}

function segmentLabel(segment: string): string {
  const map: Record<string, string> = {
    'catering.row':        'Menügang',
    'catering.option':     'Menü-Option',
    'catering.item':       'Menü-Eintrag',
    'catering.meta':       'Catering-Einstellungen',
    'ablaufplan.slot':     'Ablaufpunkt',
    'ablaufplan.meta':     'Ablaufplan-Einstellungen',
    'hotel.info':          'Hotel',
    'hotel.room_type':     'Zimmertyp',
    'hotel.meta':          'Hotel-Einstellungen',
    'musik.act':           'Musikact',
    'musik.equipment':     'Equipment',
    'musik.meta':          'Musik-Einstellungen',
    'deko.item':           'Dekorations-Artikel',
    'deko.meta':           'Deko-Einstellungen',
    'patisserie.cake':     'Torte',
    'patisserie.dessert':  'Dessert',
    'patisserie.meta':     'Patisserie-Einstellungen',
    'vendor.package':      'Paket',
    'vendor.meta':         'Dienstleister-Einstellungen',
    'sitzplan.table':      'Tisch',
    'sitzplan.assignment': 'Sitzzuweisung',
    'sitzplan.meta':       'Sitzplan-Einstellungen',
  }
  return map[segment] ?? segment
}

export default function ProposalDeltaView({ deltas }: Props) {
  if (deltas.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '12px 0' }}>
        Keine Änderungen erfasst.
      </p>
    )
  }

  // Gruppieren nach Segment
  const grouped = deltas.reduce<Record<string, DeltaField[]>>((acc, d) => {
    const key = d.segment
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.entries(grouped).map(([segment, fields]) => (
        <div key={segment}>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 8,
          }}>
            {segmentLabel(segment)}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fields.map((d, i) => {
              const isAdd = d.is_addition
              const isDel = d.is_deletion
              const isChange = !isAdd && !isDel

              const accent = isAdd ? '#16a34a' : isDel ? '#dc2626' : 'var(--gold)'
              const bg     = isAdd ? '#f0fdf4'  : isDel ? '#fef2f2'  : '#fffbeb'

              return (
                <div key={i} style={{
                  background: bg, borderRadius: 8,
                  border: `1px solid ${isAdd ? '#bbf7d0' : isDel ? '#fecaca' : '#fde68a'}`,
                  padding: '8px 11px',
                  display: 'flex', alignItems: 'flex-start', gap: 9,
                }}>
                  <div style={{ marginTop: 1, flexShrink: 0 }}>
                    {isAdd && <Plus size={13} color={accent} />}
                    {isDel && <Minus size={13} color={accent} />}
                    {isChange && <Edit3 size={13} color={accent} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: accent, marginBottom: 2 }}>
                      {isAdd ? 'Neu: ' : isDel ? 'Entfernt: ' : ''}{fieldLabel(d)}
                    </p>
                    {isChange && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#dc2626', textDecoration: 'line-through' }}>
                          {formatValue(d.value_old)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>→</span>
                        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                          {formatValue(d.value_new)}
                        </span>
                      </div>
                    )}
                    {isAdd && (
                      <p style={{ fontSize: 11, color: '#16a34a' }}>
                        {d.field_key === '__entity__' ? 'Neuer Eintrag hinzugefügt' : formatValue(d.value_new)}
                      </p>
                    )}
                    {isDel && (
                      <p style={{ fontSize: 11, color: '#dc2626' }}>
                        {d.field_key === '__entity__' ? 'Eintrag wird entfernt' : formatValue(d.value_old)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
