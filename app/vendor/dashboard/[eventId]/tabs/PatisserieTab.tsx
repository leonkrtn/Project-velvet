'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Thermometer, Clock, MapPin } from 'lucide-react'

interface PatisserieConfig {
  cake_description: string; layers: number; flavors: string[]; dietary_notes: string
  delivery_date: string; delivery_time: string; cooling_required: boolean
  cooling_notes: string; setup_location: string; cake_table_provided: boolean
  dessert_buffet: boolean; dessert_items: string[]; price: number; vendor_notes: string
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: 'var(--text-tertiary)' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

export default function PatisserieTab({ eventId }: { eventId: string }) {
  const [config, setConfig] = useState<PatisserieConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('patisserie_config').select('*').eq('event_id', eventId).single()
      .then(({ data }) => { setConfig(data ?? null); setLoading(false) })
  }, [eventId])

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Patisserie</h1>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Wird geladen…</div>
      ) : !config ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
          Noch keine Patisserie-Informationen hinterlegt.
        </div>
      ) : (
        <div style={{ maxWidth: 640 }}>
          {/* Lieferung */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Lieferung</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <InfoCard icon={<Clock size={13} />}       label="Datum"          value={config.delivery_date || '—'} />
              <InfoCard icon={<Clock size={13} />}       label="Uhrzeit"        value={config.delivery_time || '—'} />
              <InfoCard icon={<MapPin size={13} />}      label="Aufstellort"    value={config.setup_location || '—'} />
            </div>
          </div>

          {/* Kühlung */}
          {config.cooling_required && (
            <div style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Thermometer size={16} style={{ color: '#FF9500', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#FF9500', marginBottom: 2 }}>Kühlung erforderlich</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{config.cooling_notes || 'Bitte kühl lagern'}</p>
              </div>
            </div>
          )}

          {/* Torte */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Hochzeitstorte</p>
            {config.cake_description && <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.6 }}>{config.cake_description}</p>}
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
              {config.layers > 0 && <span>{config.layers} Etagen</span>}
              {config.cake_table_provided && <span>Tisch wird gestellt</span>}
            </div>
            {config.flavors?.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {config.flavors.map(f => (
                  <span key={f} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: '#F0F0F2', color: 'var(--text-secondary)' }}>{f}</span>
                ))}
              </div>
            )}
            {config.dietary_notes && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{config.dietary_notes}</p>
            )}
          </div>

          {/* Dessert-Buffet */}
          {config.dessert_buffet && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Dessert-Buffet</p>
              {config.dessert_items?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {config.dessert_items.map(item => (
                    <div key={item} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>{item}</div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Details folgen</p>
              )}
            </div>
          )}

          {config.vendor_notes && (
            <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius)', padding: '16px 20px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Hinweise vom Veranstalter</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{config.vendor_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
