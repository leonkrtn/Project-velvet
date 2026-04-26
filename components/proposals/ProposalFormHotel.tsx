'use client'
import React from 'react'
import type { HotelProposalData } from '@/lib/proposals'
import { Section } from './ProposalSection'

interface Props {
  data: HotelProposalData
  onChange: (patch: Partial<HotelProposalData>) => void
  enabledSections: string[]
  onToggleSection: (key: string) => void
  readOnly?: boolean
}

const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--border)',
  borderRadius: 8, background: 'var(--bg)', fontFamily: 'inherit',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 5 }}>{label}</label>}
      {children}
    </div>
  )
}

export default function ProposalFormHotel({ data, onChange, enabledSections, onToggleSection, readOnly }: Props) {
  const sec = (k: string) => enabledSections.includes(k)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <Section sectionKey="info" label="Hotel-Info" enabled={sec('info')} onToggle={onToggleSection} readOnly={readOnly}>
        <Row label="Hotelname">
          <input style={input} value={data.name ?? ''} placeholder="z.B. Schloss Hohenstein"
            onChange={e => onChange({ name: e.target.value })} />
        </Row>
        <Row label="Adresse">
          <input style={input} value={data.address ?? ''} placeholder="Straße, Ort"
            onChange={e => onChange({ address: e.target.value })} />
        </Row>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Row label="Entfernung (km)">
            <input style={input} type="number" min="0" step="0.1" value={data.distance_km ?? ''}
              placeholder="z.B. 2.5" onChange={e => onChange({ distance_km: Number(e.target.value) })} />
          </Row>
          <Row label="Preis/Nacht (€)">
            <input style={input} type="number" min="0" value={data.price_per_night ?? ''}
              placeholder="z.B. 120" onChange={e => onChange({ price_per_night: Number(e.target.value) })} />
          </Row>
          <Row label="Zimmer verfügbar">
            <input style={input} type="number" min="0" value={data.total_rooms ?? ''}
              placeholder="z.B. 30" onChange={e => onChange({ total_rooms: Number(e.target.value) })} />
          </Row>
        </div>
        <Row label="Beschreibung">
          <textarea value={data.description ?? ''} onChange={e => onChange({ description: e.target.value })}
            placeholder="Ausstattung, Besonderheiten, Parkmöglichkeiten…" rows={3} style={{ ...input, resize: 'vertical' }} />
        </Row>
      </Section>

      <Section sectionKey="contact" label="Kontakt & Buchung" enabled={sec('contact')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Row label="Kontakt E-Mail">
            <input style={input} type="email" value={data.contact_email ?? ''} placeholder="reservierung@hotel.de"
              onChange={e => onChange({ contact_email: e.target.value })} />
          </Row>
          <Row label="Website / Buchungslink">
            <input style={input} type="url" value={data.website ?? ''} placeholder="https://…"
              onChange={e => onChange({ website: e.target.value })} />
          </Row>
        </div>
      </Section>

      <Section sectionKey="notes" label="Anmerkungen" enabled={sec('notes')} onToggle={onToggleSection} readOnly={readOnly}>
        <textarea value={data.notes ?? ''} onChange={e => onChange({ notes: e.target.value })}
          placeholder="Weitere Hinweise (Kontingent, Sonderkonditionen…)" rows={4} style={{ ...input, resize: 'vertical' }} />
      </Section>

    </div>
  )
}
