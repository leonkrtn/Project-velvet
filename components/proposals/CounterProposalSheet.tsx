'use client'
import React, { useState, useCallback } from 'react'
import { X, CheckCircle } from 'lucide-react'
import {
  type ProposalWithDetails,
  type ProposalModuleData,
  type SegmentData,
  type CateringProposalData,
  type AblaufplanProposalData,
  type DekoProposalData,
  type MusikProposalData,
  type PatisserieProposalData,
  type VendorProposalData,
  type HotelProposalData,
  type ProposalRole,
  MODULE_SECTIONS,
  MODULE_LABELS,
  counterProposal,
  computeDeltas,
  updateSnapshot,
} from '@/lib/proposals'
import ProposalFormCatering from './ProposalFormCatering'
import ProposalFormAblaufplan from './ProposalFormAblaufplan'
import ProposalFormDeko from './ProposalFormDeko'
import ProposalFormMusik from './ProposalFormMusik'
import ProposalFormPatisserie from './ProposalFormPatisserie'
import ProposalFormVendor from './ProposalFormVendor'
import ProposalFormHotel from './ProposalFormHotel'

interface Props {
  proposal: ProposalWithDetails
  userId: string
  userRole: ProposalRole
  eventId: string
  onClose: () => void
  onSent: () => void
}

export default function CounterProposalSheet({ proposal, userRole, onClose, onSent }: Props) {
  const snapshotData = proposal.snapshot?.snapshot_json as ProposalModuleData | undefined
  const allSectionKeys = MODULE_SECTIONS[proposal.module].map(s => s.key)

  const [data, setData] = useState<ProposalModuleData>(snapshotData ?? {} as ProposalModuleData)
  const [enabledSections, setEnabledSections] = useState<string[]>(allSectionKeys)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const patch = useCallback((p: Partial<ProposalModuleData>) => setData(d => ({ ...d, ...p })), [])
  const toggleSection = useCallback((key: string) => setEnabledSections(prev =>
    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
  ), [])

  const renderForm = () => {
    const common = { enabledSections, onToggleSection: toggleSection, readOnly: false }
    switch (proposal.module) {
      case 'catering':
        return <ProposalFormCatering data={data as CateringProposalData} onChange={patch as (p: Partial<CateringProposalData>) => void} {...common} />
      case 'ablaufplan':
        return <ProposalFormAblaufplan data={data as AblaufplanProposalData} onChange={patch as (p: Partial<AblaufplanProposalData>) => void} {...common} />
      case 'deko':
        return <ProposalFormDeko data={data as DekoProposalData} onChange={patch as (p: Partial<DekoProposalData>) => void} {...common} />
      case 'musik':
        return <ProposalFormMusik data={data as MusikProposalData} onChange={patch as (p: Partial<MusikProposalData>) => void} {...common} />
      case 'patisserie':
        return <ProposalFormPatisserie data={data as PatisserieProposalData} onChange={patch as (p: Partial<PatisserieProposalData>) => void} {...common} />
      case 'vendor':
        return <ProposalFormVendor data={data as VendorProposalData} onChange={patch as (p: Partial<VendorProposalData>) => void} {...common} />
      case 'hotel':
        return <ProposalFormHotel data={data as HotelProposalData} onChange={patch as (p: Partial<HotelProposalData>) => void} {...common} />
      default:
        return <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Formular für {MODULE_LABELS[proposal.module]}.</p>
    }
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const deltas = computeDeltas(
        (snapshotData ?? null) as SegmentData | null,
        data as SegmentData,
        proposal.module
      )
      const { error } = await counterProposal(proposal.id, deltas)
      if (error) throw new Error(error)
      await updateSnapshot(proposal.id, data as SegmentData)
      setToast('Gegenvorschlag gesendet!')
      setTimeout(() => onSent(), 900)
    } catch (e) {
      setToast(`Fehler: ${e instanceof Error ? e.message : String(e)}`)
      setSending(false)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      />
      <div style={{
        position: 'fixed',
        left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 201,
        width: 'min(680px, calc(100dvw - 24px))',
        height: 'min(92dvh, 820px)',
        background: 'var(--bg)',
        borderRadius: 20,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        animation: 'modalIn 0.22s ease',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '20px 20px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: 3 }}>
              Gegenvorschlag · {userRole === 'veranstalter' ? 'Veranstalter' : 'Brautpaar'}
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.2 }}>
              {MODULE_LABELS[proposal.module]}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Passe den Vorschlag an und sende ihn zurück.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)', padding: 7, display: 'flex', flexShrink: 0, marginTop: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          {renderForm()}
          <div style={{ height: 24 }} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          {toast && (
            <p style={{ fontSize: 12, color: toast.includes('Fehler') ? '#dc2626' : 'var(--gold)', textAlign: 'center', marginBottom: 10 }}>
              {toast}
            </p>
          )}
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              width: '100%', padding: '13px', borderRadius: 12,
              border: 'none', background: 'var(--gold)',
              fontSize: 14, fontWeight: 600, color: '#fff',
              cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: sending ? 0.7 : 1, transition: 'opacity 0.15s',
            }}>
            <CheckCircle size={16} />
            {sending ? 'Wird gesendet…' : 'Gegenvorschlag senden'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalIn {
          from { transform: translate(-50%,-49%) scale(0.97); opacity: 0 }
          to   { transform: translate(-50%,-50%) scale(1);    opacity: 1 }
        }
      `}</style>
    </>
  )
}
