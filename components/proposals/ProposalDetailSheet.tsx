'use client'
import React from 'react'
import { X, CheckCircle, XCircle, MessageSquare, Clock } from 'lucide-react'
import {
  type ProposalWithDetails,
  type ProposalRole,
  MODULE_LABELS,
  MODULE_SECTIONS,
} from '@/lib/proposals'
import type {
  CateringProposalData, AblaufplanProposalData, DekoProposalData,
  MusikProposalData, PatisserieProposalData, VendorProposalData, HotelProposalData,
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
  vendorName?: string
  onClose: () => void
  onAccept: () => void
  onReject: () => void
  onCounter: () => void
  onRefresh: () => void
}

function noop() {}

export default function ProposalDetailSheet({
  proposal, userId, userRole, vendorName, onClose, onAccept, onReject, onCounter,
}: Props) {
  // V2: Snapshot enthält die Formulardaten
  const formData = proposal.snapshot?.snapshot_json as Record<string, unknown> | undefined
  const myRecipient = proposal.recipients.find(r => r.user_id === userId)
  const isPending = myRecipient?.status === 'pending'
  const sections = MODULE_SECTIONS[proposal.module].map(s => s.key)

  const renderForm = () => {
    if (!formData) return (
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Keine Daten vorhanden.</p>
    )
    const common = { enabledSections: sections, onToggleSection: noop, readOnly: true }
    switch (proposal.module) {
      case 'catering':
        return <ProposalFormCatering data={formData as CateringProposalData} onChange={noop} {...common} />
      case 'ablaufplan':
        return <ProposalFormAblaufplan data={formData as AblaufplanProposalData} onChange={noop} {...common} />
      case 'deko':
        return <ProposalFormDeko data={formData as DekoProposalData} onChange={noop} {...common} />
      case 'musik':
        return <ProposalFormMusik data={formData as MusikProposalData} onChange={noop} {...common} />
      case 'patisserie':
        return <ProposalFormPatisserie data={formData as PatisserieProposalData} onChange={noop} {...common} />
      case 'vendor':
        return <ProposalFormVendor data={formData as VendorProposalData} onChange={noop} {...common} />
      case 'hotel':
        return <ProposalFormHotel data={formData as HotelProposalData} onChange={noop} {...common} />
      default:
        return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Formular für {MODULE_LABELS[proposal.module]}.</p>
    }
  }

  // V2: created_by_role statt proposer_role
  const proposerLabel = proposal.created_by_role === 'dienstleister'
    ? (vendorName ?? 'Dienstleister')
    : proposal.created_by_role === 'veranstalter'
      ? 'Veranstalter'
      : 'Brautpaar'

  // Empfänger-Status anzeigen
  const recipientStatus = myRecipient?.status

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
              {proposal.title || MODULE_LABELS[proposal.module]}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Empfänger-Übersicht */}
        {proposal.recipients.length > 1 && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            {proposal.recipients.map(r => (
              <span key={r.id} style={{
                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 100,
                background: r.status === 'accepted' ? '#dcfce7' : r.status === 'rejected' ? '#fee2e2' : 'var(--surface)',
                color: r.status === 'accepted' ? '#16a34a' : r.status === 'rejected' ? '#dc2626' : 'var(--text-secondary)',
                border: '1px solid transparent',
              }}>
                {r.profile?.full_name ?? r.role} · {r.status === 'accepted' ? '✓' : r.status === 'rejected' ? '✗' : r.status === 'countered' ? '↩' : '…'}
              </span>
            ))}
          </div>
        )}

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 0' }}>
          {renderForm()}
          <div style={{ height: 24 }} />
        </div>

        {/* Footer actions */}
        {isPending && (
          <div style={{
            padding: '14px 18px calc(env(safe-area-inset-bottom) + 14px)',
            borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0,
          }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, textAlign: 'center' }}>
              Wie möchtest du auf diesen Vorschlag reagieren?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onReject} style={{
                flex: 1, padding: '11px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)', background: 'none',
                fontSize: 14, fontWeight: 600, color: '#dc2626',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <XCircle size={15} /> Ablehnen
              </button>
              <button onClick={onCounter} style={{
                flex: 1, padding: '11px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)', background: 'none',
                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <MessageSquare size={15} /> Gegenvorschlag
              </button>
              <button onClick={onAccept} style={{
                flex: 1, padding: '11px', borderRadius: 'var(--r-md)',
                border: 'none', background: 'var(--gold)',
                fontSize: 14, fontWeight: 600, color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <CheckCircle size={15} /> Annehmen
              </button>
            </div>
          </div>
        )}

        {!isPending && myRecipient && (
          <div style={{
            padding: '12px 18px calc(env(safe-area-inset-bottom) + 12px)',
            borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {recipientStatus === 'accepted' && <><CheckCircle size={14} style={{ color: '#16a34a', verticalAlign: 'middle', marginRight: 5 }} />Du hast diesen Vorschlag angenommen.</>}
              {recipientStatus === 'rejected' && <><XCircle size={14} style={{ color: '#dc2626', verticalAlign: 'middle', marginRight: 5 }} />Du hast diesen Vorschlag abgelehnt.</>}
              {recipientStatus === 'countered' && <><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Du hast einen Gegenvorschlag gemacht.</>}
            </p>
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  )
}
