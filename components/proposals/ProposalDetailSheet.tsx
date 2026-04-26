'use client'
import React from 'react'
import { X, CheckCircle, XCircle, MessageSquare, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import {
  type ProposalWithDetails,
  type ProposalRole,
  MODULE_LABELS,
  MODULE_SECTIONS,
} from '@/lib/proposals'
import ProposalFormCatering from './ProposalFormCatering'
import ProposalFormAblaufplan from './ProposalFormAblaufplan'
import ProposalFormDeko from './ProposalFormDeko'
import ProposalFormMusik from './ProposalFormMusik'
import ProposalFormPatisserie from './ProposalFormPatisserie'
import ProposalFormVendor from './ProposalFormVendor'
import ProposalFormHotel from './ProposalFormHotel'
import type { CateringProposalData, AblaufplanProposalData, DekoProposalData, MusikProposalData, PatisserieProposalData, VendorProposalData, HotelProposalData } from '@/lib/proposals'

interface Props {
  proposal: ProposalWithDetails
  userId: string
  userRole: ProposalRole
  vendorName?: string
  onClose: () => void
  onAccept: () => void
  onReject: () => void
  onCounter: () => void
  onRefresh: () => void
}

function noop() {}

export default function ProposalDetailSheet({
  proposal, userId, userRole, vendorName, onClose, onAccept, onReject, onCounter, onRefresh,
}: Props) {
  const sub = proposal.latest_submission
  const myResponse = proposal.all_responses.find(r => r.recipient_id === userId)
  const isPending = myResponse?.status === 'pending'
  const sections = sub?.sections_enabled ?? MODULE_SECTIONS[proposal.module].map(s => s.key)

  const renderForm = () => {
    if (!sub) return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Keine Daten vorhanden.</p>
    const common = { enabledSections: sections, onToggleSection: noop, readOnly: true }
    switch (proposal.module) {
      case 'catering':
        return <ProposalFormCatering data={sub.data as CateringProposalData} onChange={noop} {...common} />
      case 'ablaufplan':
        return <ProposalFormAblaufplan data={sub.data as AblaufplanProposalData} onChange={noop} {...common} />
      case 'deko':
        return <ProposalFormDeko data={sub.data as DekoProposalData} onChange={noop} {...common} />
      case 'musik':
        return <ProposalFormMusik data={sub.data as MusikProposalData} onChange={noop} {...common} />
      case 'patisserie':
        return <ProposalFormPatisserie data={sub.data as PatisserieProposalData} onChange={noop} {...common} />
      case 'vendor':
        return <ProposalFormVendor data={sub.data as VendorProposalData} onChange={noop} {...common} />
      case 'hotel':
        return <ProposalFormHotel data={sub.data as HotelProposalData} onChange={noop} {...common} />
      default:
        return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Formular für {MODULE_LABELS[proposal.module]}.</p>
    }
  }

  const proposerLabel = proposal.proposer_role === 'dienstleister'
    ? (vendorName ?? 'Dienstleister')
    : proposal.proposer_role === 'veranstalter'
      ? 'Veranstalter'
      : 'Brautpaar'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: 'var(--bg)', borderRadius: '20px 20px 0 0',
        maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 14px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: 2 }}>
              Vorschlag von {proposerLabel}
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: 'var(--text-primary)', fontWeight: 500 }}>
              {MODULE_LABELS[proposal.module]}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 0' }}>
          {sub ? renderForm() : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Keine Daten vorhanden.</p>
          )}
          <div style={{ height: 24 }} />
        </div>

        {/* Footer actions */}
        {isPending && (
          <div style={{
            padding: '14px 18px calc(env(safe-area-inset-bottom) + 14px)',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, textAlign: 'center' }}>
              Wie möchtest du auf diesen Vorschlag reagieren?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onReject}
                style={{
                  flex: 1, padding: '11px', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)', background: 'none',
                  fontSize: 14, fontWeight: 600, color: '#dc2626',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}>
                <XCircle size={15} />
                Ablehnen
              </button>
              <button
                onClick={onCounter}
                style={{
                  flex: 1, padding: '11px', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)', background: 'none',
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}>
                <MessageSquare size={15} />
                Gegenvorschlag
              </button>
              <button
                onClick={onAccept}
                style={{
                  flex: 1, padding: '11px', borderRadius: 'var(--r-md)',
                  border: 'none', background: 'var(--gold)',
                  fontSize: 14, fontWeight: 600, color: '#fff',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}>
                <CheckCircle size={15} />
                Annehmen
              </button>
            </div>
          </div>
        )}

        {!isPending && myResponse && (
          <div style={{
            padding: '12px 18px calc(env(safe-area-inset-bottom) + 12px)',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {myResponse.status === 'accepted' && '✓ Du hast diesen Vorschlag angenommen.'}
              {myResponse.status === 'rejected' && '✗ Du hast diesen Vorschlag abgelehnt.'}
              {myResponse.status === 'countered' && 'Du hast einen Gegenvorschlag gemacht.'}
            </p>
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  )
}
