'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Send, CheckCircle, MessageSquare, Edit3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string
  created_at: string
  sender?: { name: string } | null
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

async function findOrCreateProposalConversation(
  supabase: ReturnType<typeof createClient>,
  proposalId: string,
  eventId: string,
  currentUserId: string,
  participantIds: string[],
): Promise<string> {
  const convName = `__proposal_${proposalId}`

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('event_id', eventId)
    .eq('name', convName)
    .maybeSingle()

  if (existing) return existing.id

  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ event_id: eventId, name: convName, created_by: currentUserId })
    .select('id')
    .single()

  if (error || !conv) throw error ?? new Error('Konversation konnte nicht erstellt werden')

  const seen = new Set<string>()
  const uniqueIds = participantIds.filter(id => id && !seen.has(id) && seen.add(id))
  if (uniqueIds.length > 0) {
    await supabase.from('conversation_participants').insert(
      uniqueIds.map(uid => ({ conversation_id: conv.id, user_id: uid }))
    )
  }

  return conv.id
}

export default function CounterProposalSheet({ proposal, userId, userRole, eventId, onClose, onSent }: Props) {
  const [activeTab, setActiveTab] = useState<'form' | 'chat'>('form')

  const snapshotData = proposal.snapshot?.snapshot_json as ProposalModuleData | undefined
  const allSectionKeys = MODULE_SECTIONS[proposal.module].map(s => s.key)

  const [data, setData] = useState<ProposalModuleData>(snapshotData ?? {} as ProposalModuleData)
  const [enabledSections, setEnabledSections] = useState<string[]>(allSectionKeys)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const participantIds = [
      proposal.created_by,
      ...proposal.recipients.map(r => r.user_id),
    ]
    findOrCreateProposalConversation(supabase, proposal.id, eventId, userId, participantIds)
      .then(setConversationId)
      .catch(console.error)
  }, [proposal.id, proposal.created_by, proposal.recipients, eventId, userId, supabase])

  useEffect(() => {
    if (!conversationId) return

    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at, sender:profiles!sender_id(name)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data: msgs }) => {
        setMessages(msgs?.map(m => ({ ...m, sender: Array.isArray(m.sender) ? (m.sender[0] ?? null) : m.sender })) ?? [])
      })

    const channel = supabase
      .channel(`counter-chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const p = payload.new as Message
        setMessages(prev => prev.some(m => m.id === p.id) ? prev : [...prev, p])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      // Compute deltas between snapshot and edited data, then pass to counterProposal
      const deltas = computeDeltas(
        (snapshotData ?? null) as SegmentData | null,
        data as SegmentData,
        proposal.module
      )
      const { error } = await counterProposal(proposal.id, deltas)
      if (error) throw new Error(error)
      // Persist the edited form state as the new snapshot
      await updateSnapshot(proposal.id, data as SegmentData)
      setToast('Gegenvorschlag gesendet!')
      setTimeout(() => onSent(), 900)
    } catch (e) {
      setToast(`Fehler: ${e instanceof Error ? e.message : String(e)}`)
      setSending(false)
    }
  }

  const sendMessage = async () => {
    if (!newMsg.trim() || !conversationId || sendingMsg) return
    setSendingMsg(true)
    const content = newMsg.trim()
    setNewMsg('')
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: userId, content })
      .select('id, conversation_id, sender_id, content, created_at')
      .single()
    if (inserted) {
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, { ...inserted, sender: null }])
    }
    setSendingMsg(false)
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
          padding: '20px 20px 0', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: 3 }}>
              Gegenvorschlag · {userRole === 'veranstalter' ? 'Veranstalter' : 'Brautpaar'}
            </p>
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
            { key: 'form', label: 'Bearbeiten', Icon: Edit3 },
            { key: 'chat', label: 'Chat', Icon: MessageSquare },
          ] as const).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: '8px 8px 0 0',
                border: 'none', background: activeTab === key ? 'var(--bg)' : 'transparent',
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
          {activeTab === 'form' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
              {renderForm()}
              <div style={{ height: 24 }} />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{
                flex: 1, overflowY: 'auto', padding: '16px 20px',
                display: 'flex', flexDirection: 'column', gap: 10,
                background: 'var(--surface)',
              }}>
                {messages.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                    <div style={{ textAlign: 'center' }}>
                      <MessageSquare size={28} style={{ opacity: 0.2, marginBottom: 10 }} />
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Noch keine Nachrichten.<br />Schreib eine erste Nachricht.
                      </p>
                    </div>
                  </div>
                )}
                {messages.map(msg => {
                  const isMe = msg.sender_id === userId
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                      {!isMe && (
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', background: '#E5E5EA',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: '#636366', flexShrink: 0,
                        }}>
                          {initials(msg.sender?.name ?? '?')}
                        </div>
                      )}
                      <div style={{ maxWidth: '75%' }}>
                        {!isMe && msg.sender && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, marginLeft: 4 }}>
                            {msg.sender.name}
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
                <div ref={messagesEndRef} />
              </div>
              <div style={{
                padding: '12px 20px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 10, background: 'var(--bg)', flexShrink: 0,
              }}>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Nachricht schreiben…"
                  style={{
                    flex: 1, padding: '10px 16px', border: '1px solid var(--border)',
                    borderRadius: 22, fontSize: 14, outline: 'none',
                    fontFamily: 'inherit', background: 'var(--surface)',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMsg.trim() || sendingMsg || !conversationId}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: newMsg.trim() ? 'var(--gold)' : 'var(--border)',
                    border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: newMsg.trim() ? '#fff' : 'var(--text-secondary)', flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
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
