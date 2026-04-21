'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, MessageSquare } from 'lucide-react'

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

export default function ChatTab({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [supabase])

  useEffect(() => {
    supabase
      .from('conversations')
      .select('id, name, created_by, created_at, updated_at, conversation_participants(user_id, profiles(id, name))')
      .eq('event_id', eventId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        const normalized = (data ?? []).map(conv => ({
          ...conv,
          conversation_participants: (conv.conversation_participants ?? []).map((p: { user_id: string; profiles: { id: string; name: string }[] | { id: string; name: string } | null }) => ({
            ...p,
            profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : p.profiles,
          })),
        }))
        setConversations(normalized)
        if (normalized.length) setActiveConv(normalized[0])
      })
  }, [eventId, supabase])

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

    const channel = supabase
      .channel(`vendor-chat:${activeConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
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
    if (!newMsg.trim() || !activeConv || sending || !userId) return
    setSending(true)
    const content = newMsg.trim()
    setNewMsg('')
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: userId, content, event_id: eventId })
      .select('id, conversation_id, sender_id, content, created_at')
      .single()
    if (inserted) {
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, { ...inserted, sender: null }])
    }
    setSending(false)
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.id)
  }

  function convDisplayName(conv: Conversation): string {
    if (conv.name) return conv.name
    const others = conv.conversation_participants
      .filter(p => p.user_id !== userId)
      .map(p => p.profiles?.name?.split(' ')[0] ?? '?')
    return others.join(', ') || 'Chat'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ padding: '36px 40px 24px', flexShrink: 0, background: 'var(--bg)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>Kommunikation</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{conversations.length} Gespräch{conversations.length !== 1 ? 'e' : ''}</p>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', margin: '0 40px 40px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        {/* Sidebar */}
        <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>
                Noch keine Chats verfügbar.
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
                  }}
                >
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
                </div>
              )
            })}
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--surface)' }}>
          {activeConv ? (
            <>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{convDisplayName(activeConv)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{activeConv.conversation_participants.length} Teilnehmer</div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, background: '#FAFAFA' }}>
                {messages.map(msg => {
                  const isMe = msg.sender_id === userId
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
              <p style={{ fontSize: 14 }}>Wähle einen Chat aus</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
