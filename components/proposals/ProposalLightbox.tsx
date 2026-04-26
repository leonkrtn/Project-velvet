'use client'
import React, { useState, useCallback } from 'react'
import { X, Save, Send } from 'lucide-react'
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
  saveProposalDraft,
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
  currentData?: Record<string, unknown>
  onClose: () => void
  onSent?: () => void
  parentSubmissionId?: string
  myResponseId?: string
  initialData?: ProposalModuleData
  initialSections?: string[]
  existingProposalId?: string
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
  eventId, module, proposerRole, availableRecipients, currentData,
  onClose, onSent, parentSubmissionId, myResponseId,
  initialData, initialSections, existingProposalId,
}: Props) {
  const sections = MODULE_SECTIONS[module]
  const allSectionKeys = sections.map(s => s.key)

  const [data, setData] = useState<ProposalModuleData>(initialData ?? defaultData(module))
  const [enabledSections, setEnabledSections] = useState<string[]>(initialSections ?? allSectionKeys)
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(availableRecipients.map(r => r.userId))
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [savedDraftId, setSavedDraftId] = useState<string | undefined>(existingProposalId)
  const [savedSubmissionId, setSavedSubmissionId] = useState<string | undefined>()
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

  const handleSave = async () => {
    setSaving(true)
    try {
      let proposalId = savedDraftId
      if (!proposalId) {
        const draft = await createProposalDraft(eventId, proposerRole, module)
        proposalId = draft.id
        setSavedDraftId(draft.id)
      }
      const submission = await saveProposalDraft(proposalId, data, enabledSections, savedSubmissionId)
      setSavedSubmissionId(submission.id)
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
      let proposalId = savedDraftId
      let submissionId = savedSubmissionId
      if (!proposalId) {
        const draft = await createProposalDraft(eventId, proposerRole, module)
        proposalId = draft.id
      }
      const submission = await saveProposalDraft(proposalId, data, enabledSections, submissionId)
      submissionId = submission.id
      const recipients = availableRecipients.filter(r => selectedRecipients.includes(r.userId))
      await sendProposal(proposalId, submissionId, recipients)
      setToast('Vorschlag gesendet!')
      setTimeout(() => { onSent?.(); onClose() }, 1200)
    } catch {
      setToast('Fehler beim Senden')
    } finally {
      setSending(false)
    }
  }

  const renderForm = () => {
    const formProps = { enabledSections, onToggleSection: toggleSection, currentData }
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: 'var(--bg)', borderRadius: '20px 20px 0 0',
        maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        animation: 'slideUp 0.3s ease',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 0', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: 2 }}>
              {parentSubmissionId ? 'Gegenvorschlag' : 'Vorschlag machen'}
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: 'var(--text)', fontWeight: 500 }}>
              {MODULE_LABELS[module]}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 0' }}>
          {renderForm()}
          <div style={{ height: 16 }} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 18px calc(env(safe-area-inset-bottom) + 14px)',
          borderTop: '1px solid var(--border)', background: 'var(--surface)',
          flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
        }}>

          {/* Empfänger — immer sichtbar wenn kein Gegenvorschlag */}
          {!parentSubmissionId && availableRecipients.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 8 }}>
                Senden an
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {availableRecipients.map(r => {
                  const sel = selectedRecipients.includes(r.userId)
                  return (
                    <button key={r.userId} type="button"
                      onClick={() => setSelectedRecipients(prev =>
                        sel ? prev.filter(id => id !== r.userId) : [...prev, r.userId]
                      )}
                      style={{
                        padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                        background: sel ? 'var(--gold-pale)' : 'transparent',
                        color: sel ? 'var(--gold)' : 'var(--text-tertiary)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        opacity: sel ? 1 : 0.5,
                      }}>
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 1, padding: '12px', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)', background: 'var(--bg)',
              fontSize: 14, fontWeight: 600, color: 'var(--text-dim)',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <Save size={15} />
              {saving ? 'Speichert…' : 'Entwurf'}
            </button>
            <button onClick={() => setShowSendConfirm(true)}
              disabled={sending || selectedRecipients.length === 0}
              style={{
                flex: 2, padding: '12px', borderRadius: 'var(--r-md)',
                border: 'none', background: 'var(--gold)',
                fontSize: 14, fontWeight: 600, color: '#fff',
                cursor: selectedRecipients.length === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedRecipients.length === 0 ? 0.5 : 1,
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
              <Send size={15} />
              {sending ? 'Wird gesendet…' : 'Vorschlag senden'}
            </button>
          </div>

          {toast && (
            <p style={{ fontSize: 12, color: toast.includes('Fehler') ? '#dc2626' : 'var(--gold)', textAlign: 'center' }}>
              {toast}
            </p>
          )}
        </div>
      </div>

      {/* Sende-Bestätigung */}
      {showSendConfirm && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowSendConfirm(false)} />
          <div style={{
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 211, background: 'var(--surface)', borderRadius: 'var(--r-md)',
            padding: '24px 22px', maxWidth: 340, width: 'calc(100vw - 32px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Vorschlag senden?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.5 }}>
              Dein Vorschlag für <strong>{MODULE_LABELS[module]}</strong> wird an{' '}
              {availableRecipients.filter(r => selectedRecipients.includes(r.userId)).map(r => r.label).join(' und ')} gesendet.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowSendConfirm(false)}
                style={{ flex: 1, padding: '11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'none', fontSize: 14, fontWeight: 600, color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Abbrechen
              </button>
              <button onClick={() => { setShowSendConfirm(false); handleSend() }}
                style={{ flex: 1, padding: '11px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--gold)', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                Jetzt senden
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  )
}
