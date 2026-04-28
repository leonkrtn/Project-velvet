'use client'
import React, { useState, useCallback } from 'react'
import { X, Save, Send, Users } from 'lucide-react'
import {
  type ProposalModule,
  type ProposalRole,
  type ProposalModuleData,
  type CateringProposalData,
  type AblaufplanProposalData,
  type SitzplanProposalData,
  type DekoProposalData,
  type MusikProposalData,
  type PatisserieProposalData,
  type VendorProposalData,
  type HotelProposalData,
  MODULE_SECTIONS,
  MODULE_LABELS,
  createProposalDraft,
  updateSnapshot,
  addRecipient,
  sendProposal,
} from '@/lib/proposals'
import ProposalFormCatering from './ProposalFormCatering'
import ProposalFormAblaufplan from './ProposalFormAblaufplan'
import ProposalFormDeko from './ProposalFormDeko'
import ProposalFormMusik from './ProposalFormMusik'
import ProposalFormPatisserie from './ProposalFormPatisserie'
import ProposalFormVendor from './ProposalFormVendor'
import ProposalFormHotel from './ProposalFormHotel'

interface Recipient {
  userId: string
  role: ProposalRole
  label: string
}

interface Props {
  eventId: string
  module: ProposalModule
  proposerRole: ProposalRole
  availableRecipients: Recipient[]
  onClose: () => void
  onSent?: () => void
  existingProposalId?: string
  initialData?: ProposalModuleData
  initialSections?: string[]
}

function defaultData(module: ProposalModule): ProposalModuleData {
  switch (module) {
    case 'catering':   return {} as CateringProposalData
    case 'ablaufplan': return { entries: [] } as AblaufplanProposalData
    case 'sitzplan':   return { tables: [], notes: '' } as SitzplanProposalData
    case 'deko':       return { wishes: [] } as DekoProposalData
    case 'musik':      return { songs: [], requirements: {} } as MusikProposalData
    case 'patisserie': return {} as PatisserieProposalData
    case 'vendor':     return {} as VendorProposalData
    case 'hotel':      return {} as HotelProposalData
  }
}

export default function ProposalLightbox({
  eventId, module, proposerRole, availableRecipients,
  onClose, onSent, existingProposalId, initialData, initialSections,
}: Props) {
  const sections = MODULE_SECTIONS[module]
  const allSectionKeys = sections.map(s => s.key)

  const [data, setData] = useState<ProposalModuleData>(initialData ?? defaultData(module))
  const [enabledSections, setEnabledSections] = useState<string[]>(initialSections ?? allSectionKeys)
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(availableRecipients.map(r => r.userId))
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [savedDraftId, setSavedDraftId] = useState<string | undefined>(existingProposalId)
  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const toggleSection = useCallback((key: string) => {
    setEnabledSections(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }, [])

  const patch = useCallback((p: Partial<ProposalModuleData>) => {
    setData(d => ({ ...d, ...p }))
  }, [])

  const ensureDraft = async (): Promise<string> => {
    if (savedDraftId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateSnapshot(savedDraftId, data as any)
      return savedDraftId
    }
    const result = await createProposalDraft({
      event_id: eventId,
      module,
      title: MODULE_LABELS[module],
      created_by_role: proposerRole,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      snapshot: data as any,
    })
    if ('error' in result) throw new Error(result.error)
    setSavedDraftId(result.proposal.id)
    return result.proposal.id
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await ensureDraft()
      setToast('Entwurf gespeichert')
    } catch {
      setToast('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const proposalId = await ensureDraft()

      const recipients = availableRecipients.filter(r => selectedRecipients.includes(r.userId))
      await Promise.all(recipients.map(r =>
        addRecipient({ proposal_id: proposalId, user_id: r.userId, role: r.role })
      ))

      const { error } = await sendProposal(proposalId)
      if (error) throw new Error(error)

      setToast('Vorschlag gesendet!')
      setTimeout(() => { onSent?.(); onClose() }, 1000)
    } catch {
      setToast('Fehler beim Senden')
      setSending(false)
    }
  }

  const renderForm = () => {
    const formProps = { enabledSections, onToggleSection: toggleSection }
    switch (module) {
      case 'catering':
        return <ProposalFormCatering data={data as CateringProposalData} onChange={patch as (p: Partial<CateringProposalData>) => void} {...formProps} />
      case 'ablaufplan':
        return <ProposalFormAblaufplan data={data as AblaufplanProposalData} onChange={patch as (p: Partial<AblaufplanProposalData>) => void} {...formProps} />
      case 'deko':
        return <ProposalFormDeko data={data as DekoProposalData} onChange={patch as (p: Partial<DekoProposalData>) => void} {...formProps} />
      case 'musik':
        return <ProposalFormMusik data={data as MusikProposalData} onChange={patch as (p: Partial<MusikProposalData>) => void} {...formProps} />
      case 'patisserie':
        return <ProposalFormPatisserie data={data as PatisserieProposalData} onChange={patch as (p: Partial<PatisserieProposalData>) => void} {...formProps} />
      case 'vendor':
        return <ProposalFormVendor data={data as VendorProposalData} onChange={patch as (p: Partial<VendorProposalData>) => void} {...formProps} />
      case 'hotel':
        return <ProposalFormHotel data={data as HotelProposalData} onChange={patch as (p: Partial<HotelProposalData>) => void} {...formProps} />
      default:
        return <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Formular für {MODULE_LABELS[module]} folgt.</div>
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
        height: 'min(92dvh, 840px)',
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
          padding: '20px 20px 0', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: 3 }}>
              Vorschlag erstellen
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.2 }}>
              {MODULE_LABELS[module]}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)', padding: 7, display: 'flex', flexShrink: 0, marginTop: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0 0', flexShrink: 0 }} />

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          {renderForm()}
          <div style={{ height: 16 }} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)', background: 'var(--surface)',
          flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12,
        }}>

          {availableRecipients.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Users size={12} style={{ color: 'var(--text-tertiary)' }} />
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
                  Senden an
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {availableRecipients.map(r => {
                  const sel = selectedRecipients.includes(r.userId)
                  return (
                    <button key={r.userId} type="button"
                      onClick={() => setSelectedRecipients(prev =>
                        sel ? prev.filter(id => id !== r.userId) : [...prev, r.userId]
                      )}
                      style={{
                        padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                        background: sel ? 'rgba(var(--gold-rgb, 180,140,70), 0.08)' : 'transparent',
                        color: sel ? 'var(--gold)' : 'var(--text-secondary)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}>
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {toast && (
            <p style={{ fontSize: 12, color: toast.includes('Fehler') ? '#dc2626' : 'var(--gold)', textAlign: 'center', margin: 0 }}>
              {toast}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 1, padding: '12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--bg)',
              fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <Save size={14} />
              {saving ? 'Speichert…' : 'Entwurf'}
            </button>
            <button
              onClick={() => setShowSendConfirm(true)}
              disabled={sending || selectedRecipients.length === 0}
              style={{
                flex: 2, padding: '12px', borderRadius: 10,
                border: 'none', background: 'var(--gold)',
                fontSize: 14, fontWeight: 600, color: '#fff',
                cursor: selectedRecipients.length === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedRecipients.length === 0 ? 0.5 : 1,
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'opacity 0.15s',
              }}>
              <Send size={14} />
              {sending ? 'Wird gesendet…' : 'Vorschlag senden'}
            </button>
          </div>
        </div>
      </div>

      {/* Sende-Bestätigung */}
      {showSendConfirm && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.2)' }}
            onClick={() => setShowSendConfirm(false)}
          />
          <div style={{
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 211, background: 'var(--bg)', borderRadius: 16,
            padding: '24px 22px', maxWidth: 360, width: 'calc(100dvw - 32px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            animation: 'modalIn 0.2s ease',
          }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Vorschlag senden?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Dein Vorschlag für <strong>{MODULE_LABELS[module]}</strong> wird an{' '}
              {availableRecipients.filter(r => selectedRecipients.includes(r.userId)).map(r => r.label).join(' und ')} gesendet.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowSendConfirm(false)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Abbrechen
              </button>
              <button onClick={() => { setShowSendConfirm(false); handleSend() }}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--gold)', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                Senden
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes modalIn {
          from { transform: translate(-50%,-49%) scale(0.97); opacity: 0 }
          to   { transform: translate(-50%,-50%) scale(1);    opacity: 1 }
        }
      `}</style>
    </>
  )
}
