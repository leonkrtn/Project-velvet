'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  read_at: string | null
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Load messages when conversation changes
  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, read_at, created_at, profiles:sender_id(name)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data?.map(m => ({ ...m, sender: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles })) ?? [])
  }, [supabase])

  useEffect(() => {
    if (!activeConv) return
    loadMessages(activeConv.id)

    // Realtime subscription
    const channel = supabase
      .channel(`chat:${activeConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConv.id}`,
      }, async (payload) => {
        // Fetch with sender name
        const { data } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, read_at, created_at, profiles:sender_id(name)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setMessages(prev => [...prev, { ...data, sender: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles }])
        }
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
    await supabase.from('messages').insert({
      conversation_id: activeConv.id,
      sender_id: currentUserId,
      content: newMsg.trim(),
    })
    setNewMsg('')
    setSending(false)
    // Update conversation updated_at
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.id)
  }

  async function createConversation() {
    if (selectedMembers.length === 0) return
    setCreating(true)

    const { data: conv } = await supabase.from('conversations').insert({
      event_id: eventId,
      name: chatName.trim() || null,
      created_by: currentUserId,
    }).select().single()

    if (conv) {
      const participants = [currentUserId, ...selectedMembers].map(uid => ({
        conversation_id: conv.id,
        user_id: uid,
      }))
      await supabase.from('conversation_participants').insert(participants)

      const newConv = {
        ...conv,
        conversation_participants: participants.map(p => ({
          user_id: p.user_id,
          profiles: members.find(m => m.user_id === p.user_id)?.profiles ?? null,
        })),
      }
      setConversations(prev => [newConv, ...prev])
      setActiveConv(newConv)
    }

    setSelectedMembers([])
    setChatName('')
    setShowNewChat(false)
    setCreating(false)
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
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 0, background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 300, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--heading-font)', fontSize: 18, fontWeight: 600 }}>Chats</h2>
          <button onClick={() => setShowNewChat(true)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--gold)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Plus size={14} />
          </button>
        </div>

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
                  padding: '12px 16px', cursor: 'pointer',
                  background: isActive ? 'var(--gold-pale)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {/* Avatar stack */}
                <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                  {initList.length > 1 ? (
                    <>
                      <div style={{ position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--gold-pale)', color: 'var(--gold)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                        {initials(initList[1].profiles?.name ?? '?')}
                      </div>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderRadius: '50%', background: '#E8E8E8', color: '#666', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                        {initials(initList[0].profiles?.name ?? '?')}
                      </div>
                    </>
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-pale)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={16} />
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmtTime(conv.updated_at)}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirm(conv.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-dim)', opacity: 0, transition: 'opacity 0.15s' }}
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {activeConv ? (
          <>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{convDisplayName(activeConv)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {activeConv.conversation_participants.length} Teilnehmer
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map(msg => {
                const isMe = msg.sender_id === currentUserId
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                    {!isMe && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', flexShrink: 0 }}>
                        {initials(msg.sender?.name ?? '?')}
                      </div>
                    )}
                    <div style={{ maxWidth: '68%' }}>
                      {!isMe && msg.sender && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3, marginLeft: 4 }}>{msg.sender.name}</div>
                      )}
                      <div style={{
                        padding: '10px 14px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: isMe ? 'var(--gold)' : 'var(--surface2)',
                        color: isMe ? '#fff' : 'var(--text)',
                        fontSize: 14, lineHeight: 1.5,
                      }}>
                        {msg.content}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, textAlign: isMe ? 'right' : 'left', marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0 }}>
                        {fmtTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Nachricht schreiben…"
                style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 20, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'var(--surface2)' }}
              />
              <button
                onClick={sendMessage}
                disabled={!newMsg.trim() || sending}
                style={{ width: 40, height: 40, borderRadius: '50%', background: newMsg.trim() ? 'var(--gold)' : 'var(--surface2)', border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: newMsg.trim() ? '#fff' : 'var(--text-dim)', flexShrink: 0 }}
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', flexDirection: 'column', gap: 12 }}>
            <MessageSquare size={40} color="var(--border2)" />
            <p style={{ fontSize: 14 }}>Wähle einen Chat aus oder erstelle einen neuen</p>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowNewChat(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: 28, width: 420, maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 20, fontWeight: 600 }}>Neuer Chat</h3>
              <button onClick={() => setShowNewChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 6 }}>Gruppenname (optional)</label>
              <input
                value={chatName}
                onChange={e => setChatName(e.target.value)}
                placeholder="z.B. Team Foto"
                style={{ width: '100%', padding: '10px 13px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 10 }}>Teilnehmer wählen</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {members.filter(m => m.user_id !== currentUserId).map(m => {
                  const selected = selectedMembers.includes(m.user_id)
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMembers(prev => selected ? prev.filter(id => id !== m.user_id) : [...prev, m.user_id])}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                        borderRadius: 'var(--r-sm)', cursor: 'pointer',
                        background: selected ? 'var(--gold-pale)' : 'var(--surface2)',
                        border: `1px solid ${selected ? 'var(--gold-lt)' : 'transparent'}`,
                      }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: selected ? 'var(--gold)' : 'var(--border)', color: selected ? '#fff' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {initials(m.profiles?.name ?? '?')}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{m.profiles?.name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.role}</div>
                      </div>
                      {selected && <div style={{ marginLeft: 'auto', color: 'var(--gold)' }}><Check size={14} /></div>}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewChat(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button
                onClick={createConversation}
                disabled={selectedMembers.length === 0 || creating}
                style={{ padding: '9px 20px', background: selectedMembers.length > 0 ? 'var(--gold)' : 'var(--border)', color: selectedMembers.length > 0 ? '#fff' : 'var(--text-dim)', border: 'none', borderRadius: 'var(--r-sm)', cursor: selectedMembers.length > 0 && !creating ? 'pointer' : 'default', fontSize: 14, fontWeight: 500 }}
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
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: 28, width: 360, maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Chat löschen?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 24 }}>
              Alle Nachrichten werden unwiderruflich gelöscht.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
              <button onClick={() => deleteConversation(deleteConfirm)} style={{ padding: '9px 18px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Löschen</button>
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
