'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Send, CheckCircle, XCircle, MessageSquare, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  type ProposalWithDetails,
  type ProposalModule,
  type ProposalModuleData,
  type CateringProposalData,
  type AblaufplanProposalData,
  type DekoProposalData,
  type MusikProposalData,
  type PatisserieProposalData,
  type VendorProposalData,
  type HotelProposalData,
  type ProposalRole,
  type Case,
  type CaseMessage,
  MODULE_LABELS,
  MODULE_SECTIONS,
  fetchCase,
  fetchCaseMessages,
  sendCaseMessage,
  subscribeToCaseMessages,
  acceptProposal,
  rejectProposal,
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
  onRefresh: () => void
}

function noop() {}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function ReadonlyForm({ module, data, sections }: { module: ProposalModule; data: ProposalModuleData; sections: string[] }) {
  const common = { enabledSections: sections, onToggleSection: noop, readOnly: true }
  switch (module) {
    case 'catering':   return <ProposalFormCatering data={data as CateringProposalData} onChange={noop} {...common} />
    case 'ablaufplan': return <ProposalFormAblaufplan data={data as AblaufplanProposalData} onChange={noop} {...common} />
    case 'deko':       return <ProposalFormDeko data={data as DekoProposalData} onChange={noop} {...common} />
    case 'musik':      return <ProposalFormMusik data={data as MusikProposalData} onChange={noop} {...common} />
    case 'patisserie': return <ProposalFormPatisserie data={data as PatisserieProposalData} onChange={noop} {...common} />
    case 'vendor':     return <ProposalFormVendor data={data as VendorProposalData} onChange={noop} {...common} />
    case 'hotel':      return <ProposalFormHotel data={data as HotelProposalData} onChange={noop} {...common} />
    default:           return <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{MODULE_LABELS[module]}</p>
  }
}

export default function CaseLightbox({ proposal, userId, userRole, vendorName, onClose, onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<'chat' | 'form'>('chat')
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [messages, setMessages] = useState<CaseMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const sections = MODULE_SECTIONS[proposal.module].map(s => s.key)
  const formData = proposal.snapshot?.snapshot_json as ProposalModuleData | undefined
  const myRecipient = proposal.recipients.find(r => r.user_id === userId)
  const isPending = myRecipient?.status === 'pending'

  const loadMessages = useCallback(async (cId: string) => {
    const msgs = await fetchCaseMessages(cId)
    setMessages(msgs)
  }, [])

  useEffect(() => {
    fetchCase(proposal.id).then(c => {
      if (!c) return
      setCaseData(c)
      loadMessages(c.id)

      const sub = subscribeToCaseMessages(c.id, () => loadMessages(c.id))
      return () => sub.unsubscribe()
    })
  }, [proposal.id, loadMessages])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async () => {
    if (!newMsg.trim() || !caseData || sendingMsg) return
    setSendingMsg(true)
    const text = newMsg.trim()
    setNewMsg('')
    await sendCaseMessage(caseData.id, text)
    setSendingMsg(false)
  }

  const handleAccept = async () => {
    setSubmitting(true)
    const { error } = await acceptProposal(proposal.id)
    if (error) {
      setToast('Fehler beim Annehmen')
      setSubmitting(false)
    } else {
      setToast('Vorschlag angenommen!')
      setTimeout(() => { onRefresh(); onClose() }, 900)
    }
  }

  const handleReject = async () => {
    setSubmitting(true)
    const { error } = await rejectProposal(proposal.id)
    if (error) {
      setToast('Fehler beim Ablehnen')
      setSubmitting(false)
    } else {
      setToast('Vorschlag abgelehnt.')
      setTimeout(() => { onRefresh(); onClose() }, 900)
    }
  }

  const proposerLabel = proposal.created_by_role === 'dienstleister'
    ? (vendorName ?? 'Dienstleister')
    : proposal.created_by_role === 'veranstalter' ? 'Veranstalter' : 'Brautpaar'

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
          padding: '20px 20px 0', flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: '#ea580c', background: '#ffedd5', padding: '3px 8px', borderRadius: 100,
              }}>
                In Klärung
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                von {proposerLabel}
              </span>
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.2 }}>
              {MODULE_LABELS[proposal.module]}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)', padding: 7, display: 'flex', flexShrink: 0, marginTop: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '14px 20px 0', gap: 2, flexShrink: 0, borderBottom: '1px solid var(--border)', marginTop: 14 }}>
          {([
            { key: 'chat', label: 'Diskussion', Icon: MessageSquare },
            { key: 'form', label: 'Vorschlag',  Icon: FileText },
          ] as const).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: '8px 8px 0 0',
                border: 'none', background: 'none',
                fontFamily: 'inherit', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: activeTab === key ? 'var(--gold)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${activeTab === key ? 'var(--gold)' : 'transparent'}`,
                marginBottom: -1, transition: 'color 0.15s',
              }}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'chat' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{
                flex: 1, overflowY: 'auto', padding: '16px 20px',
                display: 'flex', flexDirection: 'column', gap: 10,
                background: 'var(--surface)',
              }}>
                {!caseData && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 40 }}>
                    Lade Diskussion…
                  </p>
                )}
                {caseData && messages.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                    <div style={{ textAlign: 'center' }}>
                      <MessageSquare size={28} style={{ opacity: 0.2, marginBottom: 10 }} />
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Noch keine Nachrichten.<br />Startet die Diskussion zum Vorschlag.
                      </p>
                    </div>
                  </div>
                )}
                {messages.map(msg => {
                  const isMe = msg.user_id === userId
                  const senderName = msg.profile?.name ?? 'Unbekannt'
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                      {!isMe && (
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', background: '#E5E5EA',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: '#636366', flexShrink: 0,
                        }}>
                          {initials(senderName)}
                        </div>
                      )}
                      <div style={{ maxWidth: '75%' }}>
                        {!isMe && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, marginLeft: 4 }}>
                            {senderName}
                          </div>
                        )}
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                          background: isMe ? 'var(--gold)' : '#E5E5EA',
                          color: isMe ? '#fff' : 'var(--text-primary)',
                          fontSize: 14, lineHeight: 1.5,
                        }}>
                          {msg.content}
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3,
                          textAlign: isMe ? 'right' : 'left',
                          marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0,
                        }}>
                          {fmtTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatBottomRef} />
              </div>
              <div style={{
                padding: '12px 20px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 10, background: 'var(--bg)', flexShrink: 0,
              }}>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  placeholder="Nachricht schreiben…"
                  disabled={!caseData}
                  style={{
                    flex: 1, padding: '10px 16px',
                    border: '1px solid var(--border)', borderRadius: 22,
                    fontSize: 14, outline: 'none', fontFamily: 'inherit',
                    background: 'var(--surface)',
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMsg.trim() || sendingMsg || !caseData}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: newMsg.trim() && caseData ? 'var(--gold)' : 'var(--border)',
                    border: 'none', cursor: newMsg.trim() && caseData ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: newMsg.trim() && caseData ? '#fff' : 'var(--text-secondary)', flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
              {formData
                ? <ReadonlyForm module={proposal.module} data={formData} sections={sections} />
                : <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Keine Snapshot-Daten vorhanden.</p>
              }
              <div style={{ height: 24 }} />
            </div>
          )}
        </div>

        {/* Footer actions */}
        {isPending && (
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0,
          }}>
            {toast && (
              <p style={{ fontSize: 12, color: toast.includes('Fehler') ? '#dc2626' : '#16a34a', textAlign: 'center', marginBottom: 10 }}>
                {toast}
              </p>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>
              Habt ihr euch geeinigt? Nehmt den Vorschlag an oder ab.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleReject}
                disabled={submitting}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'none',
                  fontSize: 14, fontWeight: 600, color: '#dc2626',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  opacity: submitting ? 0.6 : 1,
                }}>
                <XCircle size={15} /> Ablehnen
              </button>
              <button
                onClick={handleAccept}
                disabled={submitting}
                style={{
                  flex: 2, padding: '12px', borderRadius: 10,
                  border: 'none', background: 'var(--gold)',
                  fontSize: 14, fontWeight: 600, color: '#fff',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  opacity: submitting ? 0.6 : 1,
                }}>
                <CheckCircle size={15} /> Annehmen
              </button>
            </div>
          </div>
        )}

        {!isPending && myRecipient && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, textAlign: 'center',
          }}>
            {toast && (
              <p style={{ fontSize: 12, color: '#16a34a', marginBottom: 4 }}>{toast}</p>
            )}
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {myRecipient.status === 'accepted' && <><CheckCircle size={14} style={{ color: '#16a34a', verticalAlign: 'middle', marginRight: 5 }} />Du hast zugestimmt.</>}
              {myRecipient.status === 'rejected' && <><XCircle size={14} style={{ color: '#dc2626', verticalAlign: 'middle', marginRight: 5 }} />Du hast abgelehnt.</>}
              {myRecipient.status === 'countered' && <>Du hast einen Gegenvorschlag gemacht. Warte auf Antwort.</>}
            </p>
          </div>
        )}
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
