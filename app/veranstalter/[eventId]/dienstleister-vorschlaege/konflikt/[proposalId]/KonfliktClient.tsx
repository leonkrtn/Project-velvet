'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, Send, AlertTriangle, Check, X, MessageSquare } from 'lucide-react'
import {
  type ProposalModule,
  type ProposalRole,
  type ProposalSubmission,
  type ProposalResponse,
  type ProposalConflict,
  type ProposalModuleData,
  type CateringProposalData,
  type AblaufplanProposalData,
  type DekoProposalData,
  type MusikProposalData,
  type PatisserieProposalData,
  MODULE_LABELS,
  MODULE_SECTIONS,
} from '@/lib/proposals'
import { createClient } from '@/lib/supabase/client'
import ProposalFormCatering from '@/components/proposals/ProposalFormCatering'
import ProposalFormAblaufplan from '@/components/proposals/ProposalFormAblaufplan'
import ProposalFormDeko from '@/components/proposals/ProposalFormDeko'
import ProposalFormMusik from '@/components/proposals/ProposalFormMusik'
import ProposalFormPatisserie from '@/components/proposals/ProposalFormPatisserie'

interface Member {
  userId: string
  role: 'veranstalter' | 'brautpaar'
  name: string
}

interface Props {
  eventId: string
  proposal: {
    id: string
    module: ProposalModule
    proposer_id: string
    proposer_role: ProposalRole
    status: string
  }
  conflict: ProposalConflict
  submissions: ProposalSubmission[]
  responses: ProposalResponse[]
  currentUserId: string
  currentUserRole: 'veranstalter' | 'brautpaar'
  members: Member[]
}

interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string
  created_at: string
  sender?: { name: string } | null
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

function renderEditForm(
  module: ProposalModule,
  data: ProposalModuleData,
  sections: string[],
  onChange: (p: Partial<ProposalModuleData>) => void,
  onToggleSection: (k: string) => void,
) {
  const common = { enabledSections: sections, onToggleSection }
  switch (module) {
    case 'catering':   return <ProposalFormCatering data={data as CateringProposalData} onChange={onChange as (p: Partial<CateringProposalData>) => void} {...common} />
    case 'ablaufplan': return <ProposalFormAblaufplan data={data as AblaufplanProposalData} onChange={onChange as (p: Partial<AblaufplanProposalData>) => void} {...common} />
    case 'deko':       return <ProposalFormDeko data={data as DekoProposalData} onChange={onChange as (p: Partial<DekoProposalData>) => void} {...common} />
    case 'musik':      return <ProposalFormMusik data={data as MusikProposalData} onChange={onChange as (p: Partial<MusikProposalData>) => void} {...common} />
    case 'patisserie': return <ProposalFormPatisserie data={data as PatisserieProposalData} onChange={onChange as (p: Partial<PatisserieProposalData>) => void} {...common} />
    default: return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{MODULE_LABELS[module]}</p>
  }
}

export default function KonfliktClient({
  eventId, proposal, conflict, submissions, responses,
  currentUserId, currentUserRole, members,
}: Props) {
  const [jointDraft, setJointDraft] = useState<ProposalModuleData>(conflict.joint_draft as ProposalModuleData || {})
  const [jointSections, setJointSections] = useState<string[]>(
    conflict.joint_sections_enabled?.length > 0
      ? conflict.joint_sections_enabled
      : MODULE_SECTIONS[proposal.module].map(s => s.key)
  )
  const [myApproved, setMyApproved] = useState(
    currentUserRole === 'veranstalter' ? conflict.veranstalter_approved : conflict.brautpaar_approved
  )
  const [otherApproved, setOtherApproved] = useState(
    currentUserRole === 'veranstalter' ? conflict.brautpaar_approved : conflict.veranstalter_approved
  )
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(conflict.conversation_id)
  const [showChat, setShowChat] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Find the two countered submissions
  const counteredSubs = submissions.filter(s => s.parent_submission_id !== null)
  const veranstalterSub = counteredSubs.find(s => s.submitted_by_role === 'veranstalter')
  const brautpaarSub = counteredSubs.find(s => s.submitted_by_role === 'brautpaar')

  const myCounterSub = currentUserRole === 'veranstalter' ? veranstalterSub : brautpaarSub
  const otherCounterSub = currentUserRole === 'veranstalter' ? brautpaarSub : veranstalterSub
  const otherMember = members.find(m => m.role !== currentUserRole)
  const otherLabel = otherMember?.name ?? (currentUserRole === 'veranstalter' ? 'Brautpaar' : 'Veranstalter')

  // Load chat messages
  const loadMessages = useCallback(async () => {
    if (!conversationId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at, sender:profiles!sender_id(name)')
      .eq('conversation_id', conversationId)
      .order('created_at')
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setChatMessages(data.map((msg: any) => ({
        ...msg,
        sender: Array.isArray(msg.sender) ? msg.sender[0] ?? null : msg.sender,
      })) as ChatMessage[])
    }
  }, [conversationId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!conversationId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`conflict-chat:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => loadMessages())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, loadMessages])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Subscribe to conflict updates (joint draft, approvals)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`conflict:${conflict.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'proposal_conflicts', filter: `id=eq.${conflict.id}`,
      }, (payload) => {
        const c = payload.new as ProposalConflict
        setJointDraft(c.joint_draft as ProposalModuleData || {})
        setJointSections(c.joint_sections_enabled ?? [])
        setMyApproved(currentUserRole === 'veranstalter' ? c.veranstalter_approved : c.brautpaar_approved)
        setOtherApproved(currentUserRole === 'veranstalter' ? c.brautpaar_approved : c.veranstalter_approved)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conflict.id, currentUserRole])

  const ensureConversation = async (): Promise<string> => {
    if (conversationId) return conversationId
    const supabase = createClient()

    // Create a conversation for this conflict
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ name: `Konflikt: ${MODULE_LABELS[proposal.module]}`, created_by: currentUserId })
      .select()
      .single()

    if (!conv) throw new Error('Conversation konnte nicht erstellt werden')

    // Add all relevant members
    const participantIds = Array.from(new Set([
      ...members.map(m => m.userId),
      proposal.proposer_id,
    ]))
    await supabase.from('conversation_participants').insert(
      participantIds.map(uid => ({ conversation_id: conv.id, user_id: uid }))
    )

    // Link conversation to conflict
    await supabase
      .from('proposal_conflicts')
      .update({ conversation_id: conv.id })
      .eq('id', conflict.id)

    setConversationId(conv.id)
    return conv.id
  }

  const sendChatMessage = async () => {
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')
    const supabase = createClient()
    const convId = await ensureConversation()
    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: currentUserId,
      content: text,
    })
  }

  const saveDraft = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase
        .from('proposal_conflicts')
        .update({
          joint_draft: jointDraft,
          joint_sections_enabled: jointSections,
          // Reset approvals when draft changes
          veranstalter_approved: false,
          brautpaar_approved: false,
        })
        .eq('id', conflict.id)
      setMyApproved(false)
      setOtherApproved(false)
      setToast('Gemeinsamer Entwurf gespeichert')
    } catch {
      setToast('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const toggleApproval = async () => {
    const supabase = createClient()
    const newVal = !myApproved
    const field = currentUserRole === 'veranstalter' ? 'veranstalter_approved' : 'brautpaar_approved'
    await supabase
      .from('proposal_conflicts')
      .update({ [field]: newVal })
      .eq('id', conflict.id)
    setMyApproved(newVal)

    // If both approved → send final to vendor
    const otherField = currentUserRole === 'veranstalter' ? 'brautpaar_approved' : 'veranstalter_approved'
    const { data: fresh } = await supabase
      .from('proposal_conflicts')
      .select('veranstalter_approved, brautpaar_approved')
      .eq('id', conflict.id)
      .single()

    if (fresh && fresh.veranstalter_approved && fresh.brautpaar_approved) {
      await sendFinalToVendor()
    }
  }

  const sendFinalToVendor = async () => {
    setSending(true)
    try {
      const supabase = createClient()

      // Create a new submission with the joint draft
      const { data: newSub } = await supabase
        .from('proposal_submissions')
        .insert({
          proposal_id: proposal.id,
          submitted_by: currentUserId,
          submitted_by_role: currentUserRole,
          data: jointDraft,
          sections_enabled: jointSections,
          parent_submission_id: conflict.submission_id,
        })
        .select()
        .single()

      if (newSub) {
        // Send to vendor (original proposer)
        await supabase.from('proposal_responses').insert({
          submission_id: newSub.id,
          recipient_id: proposal.proposer_id,
          recipient_role: proposal.proposer_role,
          status: 'pending',
        })

        // Resolve conflict + update proposal status
        await supabase
          .from('proposal_conflicts')
          .update({ status: 'resolved' })
          .eq('id', conflict.id)

        await supabase
          .from('proposals')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('id', proposal.id)
      }

      setToast('Gemeinsamer Vorschlag an Dienstleister gesendet!')
    } catch {
      setToast('Fehler beim Senden')
    } finally {
      setSending(false)
    }
  }

  const bothApproved = myApproved && otherApproved

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <AlertTriangle size={16} style={{ color: '#ea580c' }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ea580c' }}>
            Konflikt
          </span>
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
          {MODULE_LABELS[proposal.module]} — Einigung finden
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Veranstalter und Brautpaar haben unterschiedliche Gegenvorschläge gemacht. Erarbeitet gemeinsam einen finalen Vorschlag.
        </p>
      </div>

      {/* Two counter-proposals side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Dein Gegenvorschlag', sub: myCounterSub, isMine: true },
          { label: `Gegenvorschlag: ${otherLabel}`, sub: otherCounterSub, isMine: false },
        ].map(({ label, sub, isMine }) => (
          <div key={label} style={{
            background: 'var(--surface)', border: `1px solid ${isMine ? 'var(--gold-pale, #fef3c7)' : 'var(--border)'}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: isMine ? 'var(--gold-pale, #fef3c7)' : 'var(--bg)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: isMine ? 'var(--gold)' : 'var(--text-secondary)' }}>
                {label}
              </p>
            </div>
            <div style={{ padding: 16, maxHeight: 320, overflowY: 'auto', fontSize: 13 }}>
              {sub
                ? renderReadonlyForm(proposal.module, sub.data as ProposalModuleData, sub.sections_enabled)
                : <p style={{ color: 'var(--text-secondary)' }}>Kein Gegenvorschlag.</p>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Joint draft editor */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 24 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 2 }}>
              Gemeinsamer Entwurf
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Beide können diesen Entwurf live bearbeiten
            </p>
          </div>
          <button
            onClick={saveDraft}
            disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg)',
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {saving ? 'Speichert…' : 'Entwurf speichern'}
          </button>
        </div>
        <div style={{ padding: 18 }}>
          {renderEditForm(
            proposal.module,
            jointDraft,
            jointSections,
            (p) => setJointDraft(d => ({ ...d, ...p })),
            (k) => setJointSections(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]),
          )}
        </div>
      </div>

      {/* Approval section */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
          Freigabe — beide müssen zustimmen, dann geht der Entwurf an den Dienstleister
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* My approval */}
          <button
            onClick={toggleApproval}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 8,
              border: `1px solid ${myApproved ? '#16a34a' : 'var(--border)'}`,
              background: myApproved ? '#dcfce7' : 'var(--bg)',
              fontSize: 13, fontWeight: 600,
              color: myApproved ? '#16a34a' : 'var(--text-primary)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
            {myApproved ? <Check size={15} /> : <X size={15} />}
            {currentUserRole === 'veranstalter' ? 'Veranstalter' : 'Brautpaar'}:&nbsp;
            {myApproved ? 'Freigegeben' : 'Noch nicht freigegeben'}
          </button>

          {/* Other's approval */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 8,
            border: `1px solid ${otherApproved ? '#16a34a' : 'var(--border)'}`,
            background: otherApproved ? '#dcfce7' : 'var(--bg)',
            fontSize: 13, fontWeight: 600,
            color: otherApproved ? '#16a34a' : 'var(--text-secondary)',
          }}>
            {otherApproved ? <Check size={15} /> : <X size={15} />}
            {currentUserRole === 'veranstalter' ? 'Brautpaar' : 'Veranstalter'}:&nbsp;
            {otherApproved ? 'Freigegeben' : 'Ausstehend'}
          </div>
        </div>

        {bothApproved && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: '#dcfce7', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={16} style={{ color: '#16a34a' }} />
            <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
              Beide haben freigegeben — Entwurf wird jetzt an den Dienstleister gesendet…
            </p>
          </div>
        )}
      </div>

      {/* Embedded chat */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setShowChat(v => !v)}
          style={{
            width: '100%', padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: showChat ? '1px solid var(--border)' : 'none',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={15} style={{ color: 'var(--gold)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Chat ({chatMessages.length})
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{showChat ? 'Schließen' : 'Öffnen'}</span>
        </button>

        {showChat && (
          <>
            <div style={{ maxHeight: 280, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chatMessages.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
                  Noch keine Nachrichten. Diskutiert den gemeinsamen Entwurf hier.
                </p>
              )}
              {chatMessages.map(msg => {
                const isMine = msg.sender_id === currentUserId
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%', padding: '8px 12px', borderRadius: 10,
                      background: isMine ? 'var(--gold)' : 'var(--bg)',
                      color: isMine ? '#fff' : 'var(--text-primary)',
                      fontSize: 13,
                    }}>
                      {!isMine && (
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', marginBottom: 3 }}>
                          {msg.sender?.name ?? 'Unbekannt'}
                        </p>
                      )}
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              <div ref={chatBottomRef} />
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                placeholder="Nachricht…"
                style={{
                  flex: 1, padding: '9px 12px', fontSize: 13,
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--bg)', color: 'var(--text-primary)',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                style={{
                  padding: '9px 14px', borderRadius: 8,
                  border: 'none', background: 'var(--gold)',
                  color: '#fff', cursor: 'pointer',
                  opacity: chatInput.trim() ? 1 : 0.5,
                }}>
                <Send size={14} />
              </button>
            </div>
          </>
        )}
      </div>

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
