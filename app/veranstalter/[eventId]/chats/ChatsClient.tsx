'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Plus, X, Trash2, MessageSquare } from 'lucide-react'

interface Participant {
  user_id: string
  profiles: { id: string; name: string } | null
}

interface Conversation {
  id: string
  name: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  conversation_participants: Participant[]
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string
  created_at: string
  sender?: { name: string } | null
}

interface Member {
  id: string
  user_id: string
  role: string
  profiles: { id: string; name: string; email: string } | null
}

interface Props {
  eventId: string
  currentUserId: string
  initialConversations: Conversation[]
  members: Member[]
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

export default function ChatsClient({ eventId, currentUserId, initialConversations, members }: Props) {
  const [conversations, setConversations] = useState(initialConversations)
  const [activeConv, setActiveConv] = useState<Conversation | null>(initialConversations[0] ?? null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [chatName, setChatName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  // Load messages when conversation changes
  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at, sender:profiles!sender_id(name)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data?.map(m => ({ ...m, sender: Array.isArray(m.sender) ? (m.sender[0] ?? null) : m.sender })) ?? [])
  }, [supabase])

  useEffect(() => {
    if (!activeConv) return
    loadMessages(activeConv.id)

    // Realtime subscription — use payload data directly to avoid extra round-trip
    const channel = supabase
      .channel(`chat:${activeConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        const p = payload.new as { id: string; conversation_id: string; sender_id: string | null; content: string; read_at: string | null; created_at: string }
        setMessages(prev => prev.some(m => m.id === p.id) ? prev : [...prev, { ...p, sender: null }])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeConv?.id, loadMessages, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!newMsg.trim() || !activeConv || sending) return
    setSending(true)
    const content = newMsg.trim()
    setNewMsg('')
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: currentUserId, content })
      .select('id, conversation_id, sender_id, content, created_at')
      .single()
    if (inserted) {
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, { ...inserted, sender: null }])
    }
    setSending(false)
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.id)
  }

  async function createConversation() {
    if (selectedMembers.length === 0) return
    setCreating(true)

    const { data: convId, error } = await supabase.rpc('create_conversation', {
      p_event_id: eventId,
      p_name: chatName.trim() || null,
      p_participant_ids: selectedMembers,
    })

    if (!error && convId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, name, created_by, created_at, updated_at, conversation_participants(user_id, profiles(id, name))')
        .eq('id', convId)
        .single()

      if (conv) {
        const normalized = {
          ...conv,
          conversation_participants: (conv.conversation_participants ?? []).map((p: { user_id: string; profiles: { id: string; name: string }[] | { id: string; name: string } | null }) => ({
            ...p,
            profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : p.profiles,
          })),
        }
        setConversations(prev => [normalized, ...prev])
        setActiveConv(normalized)
      }
    }

    setSelectedMembers([])
    setChatName('')
    setShowNewChat(false)
    setCreating(false)
  }

  useEffect(() => { setShowInfo(false) }, [activeConv?.id])

  async function addParticipant(userId: string) {
    if (!activeConv || addingMember) return
    setAddingMember(true)
    await supabase.from('conversation_participants').insert({ conversation_id: activeConv.id, user_id: userId })
    const newParticipant = {
      user_id: userId,
      profiles: members.find(m => m.user_id === userId)?.profiles ?? null,
    }
    const updatedConv = { ...activeConv, conversation_participants: [...activeConv.conversation_participants, newParticipant] }
    setActiveConv(updatedConv)
    setConversations(prev => prev.map(c => c.id === activeConv.id ? updatedConv : c))
    setAddingMember(false)
  }

  async function deleteConversation(convId: string) {
    await supabase.from('conversations').delete().eq('id', convId)
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (activeConv?.id === convId) {
      setActiveConv(conversations.find(c => c.id !== convId) ?? null)
      setMessages([])
    }
    setDeleteConfirm(null)
  }

  function convDisplayName(conv: Conversation): string {
    if (conv.name) return conv.name
    const others = conv.conversation_participants
      .filter(p => p.user_id !== currentUserId)
      .map(p => p.profiles?.name?.split(' ')[0] ?? '?')
    return others.join(', ') || 'Chat'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Page header — same position/style as all other pages */}
      <div style={{ padding: '36px 40px 24px', flexShrink: 0, background: 'var(--bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Chats</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{conversations.length} Gespräch{conversations.length !== 1 ? 'e' : ''}</p>
          </div>
          <button onClick={() => setShowNewChat(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500, flexShrink: 0 }}>
            <Plus size={15} /> Neuer Chat
          </button>
        </div>
      </div>

      {/* Chat interface */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', margin: '0 40px 40px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        {/* Chat list column */}
        <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>
              Noch keine Chats.<br />Erstelle deinen ersten Chat.
            </div>
          )}
          {conversations.map(conv => {
            const isActive = activeConv?.id === conv.id
            const displayName = convDisplayName(conv)
            const initList = conv.conversation_participants.slice(0, 2)
            return (
              <div
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                style={{
                  padding: '11px 16px', cursor: 'pointer',
                  background: isActive ? '#EDEDEF' : 'transparent',
                  borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  display: 'flex', alignItems: 'center', gap: 11,
                  position: 'relative',
                }}
              >
                {/* Avatar */}
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#F0F0F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  {initList.length > 1 ? (
                    <>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderRadius: '50%', background: '#8E8E93', color: 'white', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                        {initials(initList[0].profiles?.name ?? '?')}
                      </div>
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: '#636366', color: 'white', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                        {initials(initList[1].profiles?.name ?? '?')}
                      </div>
                    </>
                  ) : (
                    <MessageSquare size={16} color="#8E8E93" />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmtTime(conv.updated_at)}</span>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirm(conv.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', opacity: 0, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--surface)', overflow: 'hidden' }}>
        {activeConv ? (
          <>
            {/* Header */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  onClick={() => setShowInfo(v => !v)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'block' }}
                >
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', textDecoration: showInfo ? 'underline' : 'none', textUnderlineOffset: 3 }}>{convDisplayName(activeConv)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {activeConv.conversation_participants.length} Teilnehmer · Infos anzeigen
                  </div>
                </button>
              </div>
            </div>

            {/* Body: messages + optional info panel */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, background: '#FAFAFA' }}>
              {messages.map(msg => {
                const isMe = msg.sender_id === currentUserId
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                    {!isMe && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#636366', flexShrink: 0 }}>
                        {initials(msg.sender?.name ?? '?')}
                      </div>
                    )}
                    <div style={{ maxWidth: '68%' }}>
                      {!isMe && msg.sender && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, marginLeft: 4 }}>{msg.sender.name}</div>
                      )}
                      <div style={{
                        padding: '10px 14px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: isMe ? 'var(--accent)' : '#E5E5EA',
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
              <div ref={messagesEndRef} />
            </div>

            {/* Info panel */}
            {showInfo && (() => {
              const participantIds = new Set(activeConv.conversation_participants.map(p => p.user_id))
              const nonParticipants = members.filter(m => !participantIds.has(m.user_id))
              return (
                <div style={{ width: 260, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Teilnehmer</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activeConv.conversation_participants.map(p => (
                        <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#636366', flexShrink: 0 }}>
                            {initials(p.profiles?.name ?? '?')}
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{p.profiles?.name ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {nonParticipants.length > 0 && (
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Hinzufügen</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {nonParticipants.map(m => (
                          <button
                            key={m.id}
                            onClick={() => addParticipant(m.user_id)}
                            disabled={addingMember}
                            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: addingMember ? 0.5 : 1 }}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F0F0F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#8E8E93', flexShrink: 0 }}>
                              {initials(m.profiles?.name ?? '?')}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{m.profiles?.name ?? '—'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.role}</div>
                            </div>
                            <div style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--accent)', lineHeight: 1 }}>+</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            </div>{/* end body */}

            {/* Input */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, background: 'var(--surface)' }}>
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Nachricht schreiben…"
                style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: 22, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#F0F0F2' }}
              />
              <button
                onClick={sendMessage}
                disabled={!newMsg.trim() || sending}
                style={{ width: 40, height: 40, borderRadius: '50%', background: newMsg.trim() ? 'var(--accent)' : '#E5E5EA', border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: newMsg.trim() ? '#fff' : '#8E8E93', flexShrink: 0 }}
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexDirection: 'column', gap: 12 }}>
            <MessageSquare size={40} color="#C7C7CC" />
            <p style={{ fontSize: 14 }}>Wähle einen Chat aus oder erstelle einen neuen</p>
          </div>
        )}
      </div>

      </div> {/* end chat interface wrapper */}

      {/* New Chat Modal */}
      {showNewChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowNewChat(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 420, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>Neuer Chat</h3>
              <button onClick={() => setShowNewChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Gruppenname (optional)</label>
              <input
                value={chatName}
                onChange={e => setChatName(e.target.value)}
                placeholder="z.B. Team Foto"
                style={{ width: '100%', padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Teilnehmer wählen</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {members.filter(m => m.user_id !== currentUserId).map(m => {
                  const selected = selectedMembers.includes(m.user_id)
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMembers(prev => selected ? prev.filter(id => id !== m.user_id) : [...prev, m.user_id])}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        background: selected ? 'var(--accent-light)' : '#F5F5F7',
                        border: `1px solid ${selected ? 'rgba(29,29,31,0.2)' : 'transparent'}`,
                      }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: selected ? 'var(--accent)' : '#C7C7CC', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {initials(m.profiles?.name ?? '?')}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{m.profiles?.name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.role}</div>
                      </div>
                      {selected && <div style={{ marginLeft: 'auto', color: 'var(--accent)' }}><Check size={14} /></div>}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewChat(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button
                onClick={createConversation}
                disabled={selectedMembers.length === 0 || creating}
                style={{ padding: '9px 20px', background: selectedMembers.length > 0 ? 'var(--accent)' : '#C7C7CC', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: selectedMembers.length > 0 && !creating ? 'pointer' : 'default', fontSize: 14, fontWeight: 500 }}
              >
                {creating ? 'Erstellen…' : `Chat erstellen (${selectedMembers.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 360, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 12 }}>Chat löschen?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Alle Nachrichten werden unwiderruflich gelöscht.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button onClick={() => deleteConversation(deleteConfirm)} style={{ padding: '9px 18px', background: '#FF3B30', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Check({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
