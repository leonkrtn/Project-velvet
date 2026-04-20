'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send } from 'lucide-react'

interface Conversation { id: string; name: string | null }
interface Message { id: string; content: string; sender_id: string; created_at: string; profiles?: { name: string } | null }

export default function ChatTab({ eventId }: { eventId: string }) {
  const supabase = createClient()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv]       = useState<string | null>(null)
  const [messages, setMessages]           = useState<Message[]>([])
  const [text, setText]                   = useState('')
  const [sending, setSending]             = useState(false)
  const [userId, setUserId]               = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
    supabase.from('conversations').select('id, name').eq('event_id', eventId).order('created_at')
      .then(({ data }) => {
        if (data?.length) { setConversations(data); setActiveConv(data[0].id) }
      })
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeConv) return
    supabase.from('messages')
      .select('id, content, sender_id, created_at, profiles(name)')
      .eq('conversation_id', activeConv)
      .order('created_at')
      .then(({ data }) => setMessages((data ?? []) as unknown as Message[]))

    const sub = supabase.channel(`chat-${activeConv}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv}` },
        payload => setMessages(prev => [...prev, payload.new as Message]))
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [activeConv]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!text.trim() || !activeConv || sending) return
    setSending(true)
    await supabase.from('messages').insert({ conversation_id: activeConv, sender_id: userId, content: text.trim() })
    setText('')
    setSending(false)
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 24 }}>Kommunikation</h1>

      {conversations.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '32px 24px', textAlign: 'center', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14 }}>
          Noch keine Chats verfügbar.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
          {/* Konversations-Liste */}
          {conversations.length > 1 && (
            <div style={{ width: 200, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
              {conversations.map(c => (
                <button key={c.id} onClick={() => setActiveConv(c.id)} style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: activeConv === c.id ? 600 : 400, background: activeConv === c.id ? 'var(--accent-light)' : 'transparent', color: activeConv === c.id ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {c.name ?? 'Chat'}
                </button>
              ))}
            </div>
          )}

          {/* Chat-Fenster */}
          <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
              {messages.map(msg => {
                const own = msg.sender_id === userId
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                    <div style={{ maxWidth: '70%' }}>
                      {!own && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>
                          {(msg.profiles as any)?.name ?? 'Veranstalter'}
                        </div>
                      )}
                      <div style={{ padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, background: own ? 'var(--accent)' : '#F0F0F2', color: own ? '#fff' : 'var(--text-primary)' }}>
                        {msg.content}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, textAlign: own ? 'right' : 'left' }}>
                        {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Nachricht…"
                style={{ flex: 1, padding: '9px 13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
              />
              <button onClick={send} disabled={!text.trim() || sending} style={{ padding: '9px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: !text.trim() ? 0.5 : 1 }}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
