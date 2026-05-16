'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, MessageSquare, X, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react'

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
  const [showInfo, setShowInfo] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [members, setMembers] = useState<{ user_id: string; role: string; profiles: { id: string; name: string; email: string } | null }[]>([])
  const [unread, setUnread] = useState<Record<string, number>>({})

  // Archive state
  const [archivedConvs, setArchivedConvs] = useState<Conversation[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [archivedLoaded, setArchivedLoaded] = useState(false)
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null)

  const activeConvIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (!uid) return
      supabase
        .rpc('get_conversation_unread_counts', { p_event_id: eventId, p_user_id: uid })
        .then(({ data: rows }) => {
          if (!rows) return
          const counts: Record<string, number> = {}
          for (const r of rows as { conversation_id: string; unread_count: number }[]) {
            counts[r.conversation_id] = r.unread_count
          }
          setUnread(counts)
        })
    })
    supabase.from('event_members').select('user_id, role, profiles!user_id(id, name, email)').eq('event_id', eventId)
      .then(({ data }) => setMembers((data ?? []).map(m => ({ ...m, profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles }))))
  }, [supabase, eventId])

  useEffect(() => {
    supabase
      .from('conversations')
      .select('id, name, created_by, created_at, updated_at, conversation_participants(user_id, profiles(id, name))')
      .eq('event_id', eventId)
      .eq('is_archived', false)
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
    activeConvIdRef.current = activeConv?.id ?? null
    if (!activeConv) return
    loadMessages(activeConv.id)

    // Mark conversation as read
    if (userId) {
      supabase
        .from('conversation_read_state')
        .upsert({ conversation_id: activeConv.id, user_id: userId, last_read_at: new Date().toISOString() })
        .then(() => setUnread(prev => ({ ...prev, [activeConv.id]: 0 })))
    }

    const channel = supabase
      .channel(`vendor-chat:${activeConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        const p = payload.new as { id: string; conversation_id: string; sender_id: string | null; content: string; read_at: string | null; created_at: string }
        setMessages(prev => prev.some(m => m.id === p.id) ? prev : [...prev, { ...p, sender: null }])
        if (p.sender_id !== userId && userId) {
          supabase.from('conversation_read_state').upsert({
            conversation_id: p.conversation_id, user_id: userId, last_read_at: new Date().toISOString(),
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeConv?.id, loadMessages, supabase, userId])

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

  useEffect(() => { setShowInfo(false) }, [activeConv?.id])

  // Realtime: increment unread for messages in non-active conversations
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`vendor-unread:${eventId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` }, (payload) => {
        const p = payload.new as { conversation_id: string; sender_id: string | null }
        if (p.sender_id === userId) return
        if (p.conversation_id === activeConvIdRef.current) return
        setUnread(prev => ({ ...prev, [p.conversation_id]: (prev[p.conversation_id] ?? 0) + 1 }))
        setConversations(prev => prev.map(c =>
          c.id === p.conversation_id ? { ...c, updated_at: new Date().toISOString() } : c
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, eventId, userId])

  async function addParticipant(uid: string) {
    if (!activeConv || addingMember) return
    setAddingMember(true)
    await supabase.from('conversation_participants').insert({ conversation_id: activeConv.id, user_id: uid })
    const newParticipant = { user_id: uid, profiles: members.find(m => m.user_id === uid)?.profiles ?? null }
    const updatedConv = { ...activeConv, conversation_participants: [...activeConv.conversation_participants, newParticipant] }
    setActiveConv(updatedConv)
    setConversations(prev => prev.map(c => c.id === activeConv.id ? updatedConv : c))
    setAddingMember(false)
  }

  async function removeParticipant(uid: string) {
    if (!activeConv) return
    const { error } = await supabase.from('conversation_participants').delete().eq('conversation_id', activeConv.id).eq('user_id', uid)
    if (error) return
    const updatedConv = { ...activeConv, conversation_participants: activeConv.conversation_participants.filter(p => p.user_id !== uid) }
    setActiveConv(updatedConv)
    setConversations(prev => prev.map(c => c.id === activeConv.id ? updatedConv : c))
  }

  // ── Archive / unarchive ─────────────────────────────────────────────────
  async function archiveConversation(convId: string) {
    await supabase.from('conversations').update({ is_archived: true }).eq('id', convId)
    const conv = conversations.find(c => c.id === convId)
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (conv) setArchivedConvs(prev => [conv, ...prev])
    if (activeConv?.id === convId) {
      setActiveConv(conversations.find(c => c.id !== convId) ?? null)
      setMessages([])
    }
  }

  async function unarchiveConversation(convId: string) {
    await supabase.from('conversations').update({ is_archived: false }).eq('id', convId)
    const conv = archivedConvs.find(c => c.id === convId)
    setArchivedConvs(prev => prev.filter(c => c.id !== convId))
    if (conv) setConversations(prev => [conv, ...prev])
  }

  async function loadArchivedConversations() {
    if (archivedLoaded || loadingArchived) return
    setLoadingArchived(true)
    const { data } = await supabase
      .from('conversations')
      .select('id, name, created_by, created_at, updated_at, conversation_participants(user_id, profiles(id, name))')
      .eq('event_id', eventId)
      .eq('is_archived', true)
      .order('updated_at', { ascending: false })
    const normalized = (data ?? []).map(conv => ({
      ...conv,
      conversation_participants: (conv.conversation_participants ?? []).map((p: { user_id: string; profiles: { id: string; name: string }[] | { id: string; name: string } | null }) => ({
        ...p,
        profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : p.profiles,
      })),
    }))
    setArchivedConvs(prev => {
      const existingIds = new Set(prev.map(c => c.id))
      return [...prev, ...normalized.filter(c => !existingIds.has(c.id))]
    })
    setArchivedLoaded(true)
    setLoadingArchived(false)
  }

  function toggleArchived() {
    const next = !showArchived
    setShowArchived(next)
    if (next) loadArchivedConversations()
  }

  function convDisplayName(conv: Conversation): string {
    if (conv.name) return conv.name
    const others = conv.conversation_participants
      .filter(p => p.user_id !== userId)
      .map(p => p.profiles?.name?.split(' ')[0] ?? '?')
    return others.join(', ') || 'Chat'
  }

  function ConvItem({ conv, archived = false }: { conv: Conversation; archived?: boolean }) {
    const isActive = activeConv?.id === conv.id
    const isHovered = hoveredConvId === conv.id
    const displayName = convDisplayName(conv)
    const initList = conv.conversation_participants.slice(0, 2)
    return (
      <div
        onClick={() => setActiveConv(conv)}
        onMouseEnter={() => setHoveredConvId(conv.id)}
        onMouseLeave={() => setHoveredConvId(null)}
        style={{
          padding: '11px 16px', cursor: 'pointer',
          background: isActive ? '#EDEDEF' : isHovered ? '#F5F5F7' : 'transparent',
          borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
          display: 'flex', alignItems: 'center', gap: 11,
        }}
      >
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: archived ? '#F5F5F5' : '#F0F0F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
          {initList.length > 1 ? (
            <>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderRadius: '50%', background: archived ? '#AEAEB2' : '#8E8E93', color: 'white', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                {initials(initList[0].profiles?.name ?? '?')}
              </div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: archived ? '#8E8E93' : '#636366', color: 'white', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>
                {initials(initList[1].profiles?.name ?? '?')}
              </div>
            </>
          ) : (
            <MessageSquare size={16} color={archived ? '#AEAEB2' : '#8E8E93'} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: !archived && (unread[conv.id] ?? 0) > 0 ? 700 : 600, fontSize: 13.5, color: archived ? 'var(--text-secondary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              {!archived && (unread[conv.id] ?? 0) > 0 && (
                <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center', lineHeight: '16px' }}>
                  {unread[conv.id]}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtTime(conv.updated_at)}</span>
            </div>
          </div>
        </div>
        <div style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s' }} onClick={e => e.stopPropagation()}>
          {archived ? (
            <button
              onClick={() => unarchiveConversation(conv.id)}
              title="Aus Archiv wiederherstellen"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              <ArchiveRestore size={13} />
            </button>
          ) : (
            <button
              onClick={() => archiveConversation(conv.id)}
              title="Archivieren"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              <Archive size={13} />
            </button>
          )}
        </div>
      </div>
    )
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
            {conversations.length === 0 && archivedConvs.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>
                Noch keine Chats verfügbar.
              </div>
            )}
            {conversations.map(conv => (
              <ConvItem key={conv.id} conv={conv} />
            ))}

            {/* Archive toggle */}
            <button
              onClick={toggleArchived}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 16px', background: 'none', border: 'none',
                borderTop: conversations.length > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              {showArchived ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Archive size={12} />
              Archivierte Chats
              {archivedConvs.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#E5E5EA', borderRadius: 8, fontSize: 10, fontWeight: 600, padding: '1px 6px', color: '#636366' }}>
                  {archivedConvs.length}
                </span>
              )}
            </button>

            {showArchived && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {loadingArchived && (
                  <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>Wird geladen…</div>
                )}
                {!loadingArchived && archivedConvs.length === 0 && (
                  <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic' }}>Kein Archiv vorhanden.</div>
                )}
                {archivedConvs.map(conv => (
                  <ConvItem key={conv.id} conv={conv} archived />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--surface)' }}>
          {activeConv ? (
            <>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button onClick={() => setShowInfo(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'block' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', textDecoration: showInfo ? 'underline' : 'none', textUnderlineOffset: 3 }}>{convDisplayName(activeConv)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{activeConv.conversation_participants.length} Teilnehmer · Infos anzeigen</div>
                  </button>
                </div>
              </div>

              {/* Body: messages + optional info panel */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

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
                            <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{p.profiles?.name ?? '—'}</span>
                            {p.user_id !== userId && (
                              <button onClick={() => removeParticipant(p.user_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-tertiary)', display: 'flex', borderRadius: 4, flexShrink: 0 }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#FF3B30')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {nonParticipants.length > 0 && (
                      <div style={{ padding: '16px 18px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Hinzufügen</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {nonParticipants.map(m => (
                            <button key={m.user_id} onClick={() => addParticipant(m.user_id)} disabled={addingMember}
                              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: addingMember ? 0.5 : 1 }}>
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
