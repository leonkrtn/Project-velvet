'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Phone, Mail, KeyRound, Zap, Clock } from 'lucide-react'

interface LocationDetails {
  parking_info: string; contact_name: string; contact_phone: string
  contact_email: string; access_code: string; power_connections: string
  floor_plan_url: string; load_in_time: string; load_out_time: string; notes: string
}

interface EventLocation {
  venue: string | null; venue_address: string | null
  location_name: string | null; location_street: string | null
  location_zip: string | null; location_city: string | null
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-line' as const }}>{value}</div>
      </div>
    </div>
  )
}

export default function LocationTab({ eventId }: { eventId: string }) {
  const [details, setDetails] = useState<LocationDetails | null>(null)
  const [evtLoc, setEvtLoc]   = useState<EventLocation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('location_details').select('*').eq('event_id', eventId).single(),
      supabase.from('events').select('venue, venue_address, location_name, location_street, location_zip, location_city').eq('id', eventId).single(),
    ]).then(([{ data: det }, { data: evt }]) => {
      setDetails(det ?? null)
      setEvtLoc(evt ?? null)
      setLoading(false)
    })
  }, [eventId])

  const address = evtLoc
    ? [evtLoc.location_name || evtLoc.venue, evtLoc.location_street || evtLoc.venue_address, evtLoc.location_zip && evtLoc.location_city ? `${evtLoc.location_zip} ${evtLoc.location_city}` : null].filter(Boolean).join('\n')
    : ''

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Veranstaltungsort</h1>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius)' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
          {address && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <MapPin size={16} style={{ color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Adresse</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{address}</div>
                </div>
              </div>
            </div>
          )}

          {details && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '4px 20px 4px' }}>
              <InfoRow icon={<Phone size={14} />}    label="Ansprechpartner" value={[details.contact_name, details.contact_phone].filter(Boolean).join(' · ')} />
              <InfoRow icon={<Mail size={14} />}     label="E-Mail"          value={details.contact_email} />
              <InfoRow icon={<KeyRound size={14} />} label="Zugangscode"     value={details.access_code} />
              <InfoRow icon={<Clock size={14} />}    label="Aufbau / Abbau"  value={[details.load_in_time && `Aufbau: ${details.load_in_time}`, details.load_out_time && `Abbau: ${details.load_out_time}`].filter(Boolean).join('  ·  ')} />
              <InfoRow icon={<Zap size={14} />}      label="Stromanschlüsse" value={details.power_connections} />
              <InfoRow icon={<MapPin size={14} />}   label="Parkplatz"       value={details.parking_info} />
            </div>
          )}

          {details?.floor_plan_url && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Grundriss</div>
              <a href={details.floor_plan_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Grundriss öffnen →</a>
            </div>
          )}

          {details?.notes && (
            <div style={{ background: '#F5F5F7', borderRadius: 'var(--radius)', padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Hinweise</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{details.notes}</p>
            </div>
          )}

          {!details && !address && (
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
              Noch keine Standortinformationen hinterlegt.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
