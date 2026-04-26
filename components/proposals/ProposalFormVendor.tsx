'use client'
import React from 'react'
import type { VendorProposalData } from '@/lib/proposals'
import { Section } from './ProposalSection'

interface Props {
  data: VendorProposalData
  onChange: (patch: Partial<VendorProposalData>) => void
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

export default function ProposalFormVendor({ data, onChange, enabledSections, onToggleSection, readOnly }: Props) {
  const sec = (k: string) => enabledSections.includes(k)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <Section sectionKey="info" label="Dienstleister-Info" enabled={sec('info')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Row label="Name">
            <input style={input} value={data.name ?? ''} placeholder="z.B. Floristik Müller"
              onChange={e => onChange({ name: e.target.value })} />
          </Row>
          <Row label="Kategorie">
            <input style={input} value={data.category ?? ''} placeholder="z.B. Fotograf, Florist…"
              onChange={e => onChange({ category: e.target.value })} />
          </Row>
        </div>
        <Row label="Beschreibung">
          <textarea value={data.description ?? ''} onChange={e => onChange({ description: e.target.value })}
            placeholder="Kurze Beschreibung des Dienstleisters…" rows={3} style={{ ...input, resize: 'vertical' }} />
        </Row>
        <Row label="Kostenvoranschlag (€)">
          <input style={input} type="number" min="0" value={data.price_estimate ?? ''}
            placeholder="z.B. 2500" onChange={e => onChange({ price_estimate: Number(e.target.value) })} />
        </Row>
      </Section>

      <Section sectionKey="contact" label="Kontakt" enabled={sec('contact')} onToggle={onToggleSection} readOnly={readOnly}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Row label="E-Mail">
            <input style={input} type="email" value={data.contact_email ?? ''} placeholder="info@example.com"
              onChange={e => onChange({ contact_email: e.target.value })} />
          </Row>
          <Row label="Telefon">
            <input style={input} type="tel" value={data.contact_phone ?? ''} placeholder="+49 …"
              onChange={e => onChange({ contact_phone: e.target.value })} />
          </Row>
        </div>
        <Row label="Website">
          <input style={input} type="url" value={data.website ?? ''} placeholder="https://…"
            onChange={e => onChange({ website: e.target.value })} />
        </Row>
      </Section>

      <Section sectionKey="notes" label="Anmerkungen" enabled={sec('notes')} onToggle={onToggleSection} readOnly={readOnly}>
        <textarea value={data.notes ?? ''} onChange={e => onChange({ notes: e.target.value })}
          placeholder="Weitere Informationen zum Dienstleister…" rows={4} style={{ ...input, resize: 'vertical' }} />
      </Section>

    </div>
  )
}
