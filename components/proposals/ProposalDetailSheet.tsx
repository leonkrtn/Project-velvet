'use client'
import React, { useState } from 'react'
import { X, CheckCircle, XCircle, MessageSquare, Clock, GitMerge, ChevronDown, ChevronUp } from 'lucide-react'
import {
  type ProposalWithDetails,
  type ProposalRole,
  type SegmentData,
  type FieldMergeSelection,
  MODULE_LABELS,
  MODULE_SECTIONS,
  buildDeltaFields,
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
import ProposalDeltaView from './ProposalDeltaView'
import ProposalMergeUI from './ProposalMergeUI'

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
  // V2: Snapshot enthält die Formulardaten
  const formData = proposal.snapshot?.snapshot_json as Record<string, unknown> | undefined
  const myRecipient = proposal.recipients.find(r => r.user_id === userId)
  const isPending = myRecipient?.status === 'pending'
  const sections = MODULE_SECTIONS[proposal.module].map(s => s.key)

  // Delta & Merge state
  const [showDelta, setShowDelta] = useState(false)
  const [showMerge, setShowMerge] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)
  const [loadedFields, setLoadedFields] = React.useState(proposal.fields)

  const isAccepted = proposal.status === 'accepted'
  const isCreator  = proposal.created_by === userId
  const canMerge   = isAccepted && isCreator && userRole === 'veranstalter'

  const deltas = buildDeltaFields(loadedFields)

  // Load fields on demand when opening merge UI (list view doesn't include them)
  const handleOpenMerge = React.useCallback(async () => {
    if (loadedFields.length === 0 && proposal.fields.length === 0) {
      const { fetchProposalFields } = await import('@/lib/proposals')
      const fields = await fetchProposalFields(proposal.id)
      setLoadedFields(fields)
    }
    setShowMerge(true)
  }, [proposal.id, proposal.fields.length, loadedFields.length])

  const handleMerge = async (mergedState: SegmentData, _selections: FieldMergeSelection) => {
    setMerging(true)
    setMergeError(null)
    // Validate before writing
    const { validateMerge: validate, finalizeMerge: finalize } = await import('@/lib/proposals')
    const validation = await validate(proposal.id)
    if (!validation.ok) {
      setMergeError(validation.reason ?? 'Merge nicht möglich')
      setMerging(false)
      return
    }
    // mergedState already computed by ProposalMergeUI → write directly
    const { error } = await finalize(proposal.id, mergedState)
    if (error) {
      setMergeError(error)
      setMerging(false)
      return
    }
    setShowMerge(false)
    setMerging(false)
    onRefresh()
    onClose()
  }

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
                {r.profile?.name ?? r.role} · {r.status === 'accepted' ? '✓' : r.status === 'rejected' ? '✗' : r.status === 'countered' ? '↩' : '…'}
              </span>
            ))}
          </div>
        )}

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 0' }}>
          {/* Merge-Modus */}
          {showMerge && proposal.snapshot ? (
            <>
              <p style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: 12,
              }}>
                Merge-Assistent
              </p>
              <ProposalMergeUI
                proposalId={proposal.id}
                snapshot={proposal.snapshot.snapshot_json as SegmentData}
                fields={loadedFields}
                onMerge={handleMerge}
                onCancel={() => setShowMerge(false)}
                loading={merging}
              />
              {mergeError && (
                <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>
                  Fehler: {mergeError}
                </p>
              )}
            </>
          ) : (
            <>
              {renderForm()}

              {/* Delta-Sektion */}
              {deltas.length > 0 && (
                <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <button
                    onClick={() => setShowDelta(v => !v)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', padding: 0,
                      display: 'flex', alignItems: 'center', gap: 6,
                      color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                      marginBottom: showDelta ? 12 : 0,
                    }}
                  >
                    {showDelta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {deltas.length} Änderung{deltas.length !== 1 ? 'en' : ''} anzeigen
                  </button>
                  {showDelta && <ProposalDeltaView deltas={deltas} />}
                </div>
              )}
            </>
          )}
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

        {!isPending && myRecipient && !canMerge && (
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

        {/* Merge-Button: nur für Veranstalter + Ersteller wenn Proposal accepted */}
        {canMerge && !showMerge && (
          <div style={{
            padding: '14px 18px calc(env(safe-area-inset-bottom) + 14px)',
            borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0,
          }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, textAlign: 'center' }}>
              <CheckCircle size={13} style={{ color: '#16a34a', verticalAlign: 'middle', marginRight: 5 }} />
              Alle haben zugestimmt. Jetzt Änderungen in den Eventplan übernehmen.
            </p>
            <button
              onClick={handleOpenMerge}
              style={{
                width: '100%', padding: '12px', borderRadius: 'var(--r-md)',
                border: 'none', background: 'var(--gold)',
                fontSize: 14, fontWeight: 600, color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <GitMerge size={16} /> Jetzt mergen
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  )
}
