'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, XCircle, Send, MessageSquare } from 'lucide-react'
import {
  type ProposalModule,
  type ProposalModuleData,
  type CateringProposalData,
  type AblaufplanProposalData,
  type DekoProposalData,
  type MusikProposalData,
  type PatisserieProposalData,
  type CaseMessage,
  MODULE_LABELS,
  MODULE_SECTIONS,
  fetchCaseMessages,
  sendCaseMessage,
  subscribeToCaseMessages,
  acceptProposal,
  rejectProposal,
} from '@/lib/proposals'
import ProposalFormCatering from '@/components/proposals/ProposalFormCatering'
import ProposalFormAblaufplan from '@/components/proposals/ProposalFormAblaufplan'
import ProposalFormDeko from '@/components/proposals/ProposalFormDeko'
import ProposalFormMusik from '@/components/proposals/ProposalFormMusik'
import ProposalFormPatisserie from '@/components/proposals/ProposalFormPatisserie'

interface Props {
  eventId: string
  proposalId: string
  module: ProposalModule
  caseId: string
  snapshotData: Record<string, unknown> | null
  currentUserId: string
  currentUserRole: string
  myStatus: string | null
  backUrl: string
}

function noop() {}

function renderReadonlyForm(module: ProposalModule, data: ProposalModuleData, sections: string[]) {
  const common = { enabledSections: sections, onToggleSection: noop, readOnly: true }
  switch (module) {
    case 'catering':   return <ProposalFormCatering data={data as CateringProposalData} onChange={noop} {...common} />
    case 'ablaufplan': return <ProposalFormAblaufplan data={data as AblaufplanProposalData} onChange={noop} {...common} />
    case 'deko':       return <ProposalFormDeko data={data as DekoProposalData} onChange={noop} {...common} />
    case 'musik':      return <ProposalFormMusik data={data as MusikProposalData} onChange={noop} {...common} />
    case 'patisserie': return <ProposalFormPatisserie data={data as PatisserieProposalData} onChange={noop} {...common} />
    default: return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{MODULE_LABELS[module]}</p>
  }
}

function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export default function KonfliktClient({
  proposalId, module, caseId, snapshotData, currentUserId, myStatus, backUrl,
}: Props) {
  const sections = MODULE_SECTIONS[module].map(s => s.key)
  const [messages, setMessages] = useState<CaseMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'form' | 'chat'>('chat')
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    const msgs = await fetchCaseMessages(caseId)
    setMessages(msgs)
  }, [caseId])

  useEffect(() => {
    loadMessages()
    const sub = subscribeToCaseMessages(caseId, () => loadMessages())
    return () => sub.unsubscribe()
  }, [caseId, loadMessages])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async () => {
    const text = newMsg.trim()
    if (!text || sendingMsg) return
    setSendingMsg(true)
    setNewMsg('')
    await sendCaseMessage(caseId, text)
    setSendingMsg(false)
  }

  const handleAccept = async () => {
    setSubmitting(true)
    const { error } = await acceptProposal(proposalId)
    if (error) {
      setToast('Fehler beim Annehmen')
      setSubmitting(false)
    } else {
      setToast('Vorschlag angenommen!')
      setTimeout(() => { window.location.href = backUrl }, 1200)
    }
  }

  const handleReject = async () => {
    setSubmitting(true)
    const { error } = await rejectProposal(proposalId)
    if (error) {
      setToast('Fehler beim Ablehnen')
      setSubmitting(false)
    } else {
      setToast('Vorschlag abgelehnt.')
      setTimeout(() => { window.location.href = backUrl }, 1200)
    }
  }

  const isPending = myStatus === 'pending'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ea580c', marginBottom: 4 }}>
          In Klärung
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
          {MODULE_LABELS[module]}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Diskutiert den Vorschlag hier und nehmt ihn an oder ab, wenn ihr euch geeinigt habt.
        </p>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {([
          { key: 'chat', label: 'Chat' },
          { key: 'form', label: 'Vorschlag' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setActiveView(key)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              color: activeView === key ? 'var(--gold)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${activeView === key ? 'var(--gold)' : 'transparent'}`,
              marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Form view */}
      {activeView === 'form' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          {snapshotData
            ? renderReadonlyForm(module, snapshotData as ProposalModuleData, sections)
            : <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Keine Snapshot-Daten vorhanden.</p>
          }
        </div>
      )}

      {/* Chat view */}
      {activeView === 'chat' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ maxHeight: 400, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '30px 0' }}>
                Noch keine Nachrichten. Startet die Diskussion zum Vorschlag.
              </p>
            )}
            {messages.map(msg => {
              const isMe = msg.user_id === currentUserId
              const senderName = msg.profile?.full_name ?? 'Unbekannt'
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                  {!isMe && (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#636366', flexShrink: 0 }}>
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
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, textAlign: isMe ? 'right' : 'left', marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0 }}>
                      {fmtTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={chatBottomRef} />
          </div>
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
            <input
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
              placeholder="Nachricht schreiben…"
              style={{
                flex: 1, padding: '10px 16px', border: 'none', borderRadius: 22,
                fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#F0F0F2',
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMsg.trim() || sendingMsg}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: newMsg.trim() ? 'var(--gold)' : '#E5E5EA',
                border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: newMsg.trim() ? '#fff' : '#8E8E93', flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, textAlign: 'center' }}>
            Wie möchtest du auf diesen Vorschlag reagieren?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleReject}
              disabled={submitting}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--r-md)',
                border: '1px solid #dc2626', background: 'none',
                fontSize: 14, fontWeight: 600, color: '#dc2626',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
              <XCircle size={15} /> Ablehnen
            </button>
            <button
              onClick={handleAccept}
              disabled={submitting}
              style={{
                flex: 2, padding: '12px', borderRadius: 'var(--r-md)',
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

      {!isPending && myStatus && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {myStatus === 'accepted' && <><CheckCircle size={14} style={{ color: '#16a34a', verticalAlign: 'middle', marginRight: 5 }} />Du hast diesen Vorschlag angenommen.</>}
            {myStatus === 'rejected' && <><XCircle size={14} style={{ color: '#dc2626', verticalAlign: 'middle', marginRight: 5 }} />Du hast diesen Vorschlag abgelehnt.</>}
          </p>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.includes('Fehler') ? '#dc2626' : '#16a34a',
          color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          zIndex: 999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
