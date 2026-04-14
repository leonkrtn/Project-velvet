'use client'
import React, { useEffect, useRef, useState } from 'react'
import { Send, Plus, X } from 'lucide-react'
import { useEvent } from '@/lib/event-context'
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
  createConversation,
} from '@/lib/db/events'
import type { Conversation, Message } from '@/lib/types/messaging'

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NachrichtenPage() {
  const { event, currentUserId } = useEvent()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!event?.id) return
    fetchConversations(event.id).then(data => {
      setConversations(data)
      setLoading(false)
      if (data.length > 0 && !activeConv) openConversation(data[0])
    })
  }, [event?.id])

  function openConversation(conv: Conversation) {
    setActiveConv(conv)
    setMessages([])
    fetchMessages(conv.id).then(setMessages)

    // Unsubscribe previous
    if (unsubRef.current) unsubRef.current()
    unsubRef.current = subscribeToMessages(conv.id, msg => {
      setMessages(prev => [...prev, msg])
    })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [])

  async function handleSend() {
    if (!draft.trim() || !activeConv || sending) return
    setSending(true)
    await sendMessage(activeConv.id, draft.trim())
    setDraft('')
    setSending(false)
  }

  async function handleCreateConversation() {
    if (!event?.id || !newTitle.trim()) return
    const convId = await createConversation(event.id, newTitle.trim())
    const newConv: Conversation = { id: convId, eventId: event.id, title: newTitle.trim(), participantRoles: [], createdBy: currentUserId ?? '', createdAt: new Date().toISOString() }
    setConversations(prev => [newConv, ...prev])
    openConversation(newConv)
    setShowNew(false)
    setNewTitle('')
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100dvh - 120px)', overflow: 'hidden', maxWidth: 700, margin: '0 auto' }}>
      {/* Sidebar */}
      <div style={{
        width: 220, borderRight: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '16px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', margin: 0 }}>
            Chats
          </p>
          <button
            onClick={() => setShowNew(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', padding: 2 }}
          >
            <Plus size={16} />
          </button>
        </div>

        {loading && <p style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 14px' }}>Lädt…</p>}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => openConversation(conv)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                background: activeConv?.id === conv.id ? 'var(--gold)10' : 'none',
                border: 'none', borderLeft: activeConv?.id === conv.id ? '3px solid var(--gold)' : '3px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {conv.title ?? 'Chat'}
              </p>
            </button>
          ))}
          {!loading && conversations.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 14px' }}>Noch keine Chats.</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeConv ? (
          <>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{activeConv.title ?? 'Chat'}</p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.map((msg, i) => {
                const isMe = msg.senderId === currentUserId
                const prevMsg = messages[i - 1]
                const showDate = !prevMsg || fmtDay(msg.createdAt) !== fmtDay(prevMsg.createdAt)
                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div style={{ textAlign: 'center', margin: '8px 0' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg)', padding: '2px 10px', borderRadius: 20 }}>
                          {fmtDay(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '75%', padding: '9px 13px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isMe ? 'var(--gold)' : 'var(--surface)',
                        border: isMe ? 'none' : '1px solid var(--border)',
                        color: isMe ? '#fff' : 'var(--text)',
                      }}>
                        <p style={{ fontSize: 14, margin: '0 0 4px', lineHeight: 1.4 }}>{msg.content}</p>
                        <p style={{ fontSize: 10, margin: 0, opacity: 0.7, textAlign: 'right' }}>{fmtTime(msg.createdAt)}</p>
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Nachricht…"
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 24,
                  fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                style={{
                  width: 42, height: 42, background: draft.trim() ? 'var(--gold)' : 'var(--border)',
                  border: 'none', borderRadius: '50%', cursor: draft.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', flexShrink: 0,
                }}
              >
                <Send size={16} color="#fff" />
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Chat auswählen oder erstellen.</p>
          </div>
        )}
      </div>

      {/* New conversation modal */}
      {showNew && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000060', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 24, width: '100%', maxWidth: 360, position: 'relative' }}>
            <button onClick={() => setShowNew(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={18} color="var(--text-dim)" />
            </button>
            <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              Neuer Chat
            </p>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateConversation()}
              placeholder="Chat-Name"
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10,
                fontSize: 14, fontFamily: 'inherit', marginBottom: 14, boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleCreateConversation}
              disabled={!newTitle.trim()}
              style={{
                width: '100%', padding: '11px', background: 'var(--gold)', color: '#fff', border: 'none',
                borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Erstellen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
