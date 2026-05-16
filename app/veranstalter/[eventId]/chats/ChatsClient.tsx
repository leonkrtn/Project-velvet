'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Send, Plus, X, Trash2, MessageSquare, Archive, ArchiveRestore,
  ChevronDown, ChevronRight, Search, Users, User, ArrowLeft,
} from 'lucide-react'

type UnreadMap = Record<string, number>

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
  is_staff_chat?: boolean
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
  category: string | null
  profiles: { id: string; name: string; email: string } | null
}

interface LastMsg {
  content: string
  senderName?: string
  createdAt: string
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

function truncate(text: string, len = 42) {
  return text.length > len ? text.slice(0, len) + '…' : text
}

export default function ChatsClient({ eventId, currentUserId, initialConversations, members }: Props) {
  const [conversations, setConversations] = useState(initialConversations)
  const [activeConv, setActiveConv] = useState<Conversation | null>(initialConversations[0] ?? null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [chatCreationType, setChatCreationType] = useState<'single' | 'group' | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [chatName, setChatName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [unread, setUnread] = useState<UnreadMap>({})
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null)
  const [hoveredTypeCard, setHoveredTypeCard] = useState<'single' | 'group' | null>(null)
  const [lastMessages, setLastMessages] = useState<Record<string, LastMsg>>({})

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTab, setSearchTab] = useState<'chats' | 'messages'>('chats')
  const [messageResults, setMessageResults] = useState<Message[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Archive
  const [archivedConvs, setArchivedConvs] = useState<Conversation[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [archivedLoaded, setArchivedLoaded] = useState(false)
  const [loadingArchived, setLoadingArchived] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const activeConvIdRef = useRef<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Member lookup by user_id for name resolution fallback (fixes "?" bug)
  const membersById = useMemo(() =>
    Object.fromEntries(members.map(m => [m.user_id, m])),
    [members]
  )

  function resolveParticipantName(p: Participant): string {
    return p.profiles?.name ?? membersById[p.user_id]?.profiles?.name ?? 'Unbekannt'
  }

  function convDisplayName(conv: Conversation): string {
    if (conv.name) return conv.name
    const others = conv.conversation_participants
      .filter(p => p.user_id !== currentUserId)
      .map(p => resolveParticipantName(p).split(' ')[0])
    return others.join(', ') || 'Chat'
  }

  function convIsGroup(conv: Conversation): boolean {
    return !!conv.name || conv.conversation_participants.length > 2
  }

  // Members available for chat creation: Dienstleister + Brautpaar only
  const chatableMembers = useMemo(() =>
    members.filter(m =>
      m.user_id !== currentUserId &&
      (m.role === 'dienstleister' || m.role === 'brautpaar')
    ),
    [members, currentUserId]
  )

  // Filtered conversations for search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim() || searchTab !== 'chats') return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(c => convDisplayName(c).toLowerCase().includes(q))
  }, [conversations, searchQuery, searchTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch last messages for all conversations on mount
  useEffect(() => {
    if (conversations.length === 0) return
    const ids = conversations.map(c => c.id)
    supabase
      .from('messages')
      .select('id, conversation_id, content, created_at, sender_id, sender:profiles!sender_id(name)')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(ids.length * 6)
      .then(({ data }) => {
        const map: Record<string, LastMsg> = {}
        for (const msg of (data ?? [])) {
          if (!map[msg.conversation_id]) {
            const sender = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender
            map[msg.conversation_id] = {
              content: msg.content,
              senderName: sender?.name ?? membersById[msg.sender_id ?? '']?.profiles?.name,
              createdAt: msg.created_at,
            }
          }
        }
        setLastMessages(map)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Message content search (debounced)
  useEffect(() => {
    if (searchTab !== 'messages' || !searchQuery.trim()) {
      setMessageResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      const convIds = conversations.map(c => c.id)
      const { data } = await supabase
        .from('messages')
        .select('id, conversation_id, content, created_at, sender_id, sender:profiles!sender_id(name)')
        .in('conversation_id', convIds)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(50)
      setMessageResults(
        (data ?? []).map(m => ({
          ...m,
          sender: Array.isArray(m.sender) ? (m.sender[0] ?? null) : m.sender,
        }))
      )
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchTab, supabase, conversations])

  // Fetch initial unread counts
  useEffect(() => {
    supabase
      .rpc('get_conversation_unread_counts', { p_event_id: eventId, p_user_id: currentUserId })
      .then(({ data }) => {
        if (!data) return
        const counts: UnreadMap = {}
        for (const row of data as { conversation_id: string; unread_count: number }[]) {
          counts[row.conversation_id] = row.unread_count
        }
        setUnread(counts)
      })
  }, [supabase, eventId, currentUserId])

  // Realtime: new conversations
  useEffect(() => {
    const channel = supabase
      .channel(`conversations:${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `event_id=eq.${eventId}`,
      }, async (payload) => {
        const newConvId = (payload.new as { id: string }).id
        const { data: conv } = await supabase
          .from('conversations')
          .select('id, name, created_by, created_at, updated_at, is_staff_chat, conversation_participants(user_id, profiles(id, name))')
          .eq('id', newConvId)
          .single()
        if (!conv) return
        const normalized = {
          ...conv,
          conversation_participants: (conv.conversation_participants ?? []).map((p: { user_id: string; profiles: { id: string; name: string }[] | { id: string; name: string } | null }) => ({
            ...p,
            profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : p.profiles,
          })),
        }
        setConversations(prev => prev.some(c => c.id === normalized.id) ? prev : [normalized, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, eventId])

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

    supabase
      .from('conversation_read_state')
      .upsert({ conversation_id: activeConv.id, user_id: currentUserId, last_read_at: new Date().toISOString() })
      .then(() => setUnread(prev => ({ ...prev, [activeConv.id]: 0 })))

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
        setLastMessages(prev => ({ ...prev, [p.conversation_id]: { content: p.content, createdAt: p.created_at } }))
        if (p.sender_id !== currentUserId) {
          supabase.from('conversation_read_state').upsert({
            conversation_id: p.conversation_id, user_id: currentUserId, last_read_at: new Date().toISOString(),
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeConv?.id, loadMessages, supabase, currentUserId])

  // Realtime: unread counter for inactive conversations
  useEffect(() => {
    const channel = supabase
      .channel(`unread:${eventId}:${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        const p = payload.new as { id: string; conversation_id: string; sender_id: string | null; content: string; created_at: string }
        if (p.sender_id === currentUserId) return
        if (p.conversation_id === activeConvIdRef.current) return
        setUnread(prev => ({ ...prev, [p.conversation_id]: (prev[p.conversation_id] ?? 0) + 1 }))
        setLastMessages(prev => ({ ...prev, [p.conversation_id]: { content: p.content, createdAt: p.created_at } }))
        setConversations(prev => prev.map(c =>
          c.id === p.conversation_id ? { ...c, updated_at: new Date().toISOString() } : c
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, eventId, currentUserId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!newMsg.trim() || !activeConv || sending) return
    setSending(true)
    const content = newMsg.trim()
    setNewMsg('')
    const now = new Date().toISOString()
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: currentUserId, content, event_id: eventId })
      .select('id, conversation_id, sender_id, content, created_at')
      .single()
    if (inserted) {
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, { ...inserted, sender: null }])
      setLastMessages(prev => ({ ...prev, [activeConv.id]: { content, createdAt: now } }))
    }
    setSending(false)
    await supabase.from('conversations').update({ updated_at: now }).eq('id', activeConv.id)
  }

  async function createConversation() {
    if (selectedMembers.length === 0) return
    if (chatCreationType === 'group' && !chatName.trim()) return
    setCreating(true)

    const { data: convId, error } = await supabase.rpc('create_conversation', {
      p_event_id: eventId,
      p_name: chatCreationType === 'group' ? chatName.trim() : null,
      p_participant_ids: selectedMembers,
    })

    if (!error && convId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, name, created_by, created_at, updated_at, is_staff_chat, conversation_participants(user_id, profiles(id, name))')
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
    setChatCreationType(null)
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

  async function removeParticipant(userId: string) {
    if (!activeConv) return
    const { error } = await supabase.from('conversation_participants').delete().eq('conversation_id', activeConv.id).eq('user_id', userId)
    if (error) return
    const updatedConv = { ...activeConv, conversation_participants: activeConv.conversation_participants.filter(p => p.user_id !== userId) }
    setActiveConv(updatedConv)
    setConversations(prev => prev.map(c => c.id === activeConv.id ? updatedConv : c))
  }

  async function deleteConversation(convId: string) {
    await supabase.from('conversations').delete().eq('id', convId)
    setConversations(prev => prev.filter(c => c.id !== convId))
    setArchivedConvs(prev => prev.filter(c => c.id !== convId))
    if (activeConv?.id === convId) {
      setActiveConv(conversations.find(c => c.id !== convId) ?? null)
      setMessages([])
    }
    setDeleteConfirm(null)
  }

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
      .select('id, name, created_by, created_at, updated_at, is_staff_chat, conversation_participants(user_id, profiles(id, name))')
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

  function closeNewChat() {
    setShowNewChat(false)
    setChatCreationType(null)
    setSelectedMembers([])
    setChatName('')
  }

  // ── ConvListItem ─────────────────────────────────────────────────────────
  function ConvListItem({ conv, archived = false }: { conv: Conversation; archived?: boolean }) {
    const isActive = activeConv?.id === conv.id
    const isHovered = hoveredConvId === conv.id
    const displayName = convDisplayName(conv)
    const isGroup = convIsGroup(conv)
    const unreadCount = unread[conv.id] ?? 0
    const last = lastMessages[conv.id]
    const otherParticipants = conv.conversation_participants.filter(p => p.user_id !== currentUserId)

    return (
      <div
        onClick={() => setActiveConv(conv)}
        onMouseEnter={() => setHoveredConvId(conv.id)}
        onMouseLeave={() => setHoveredConvId(null)}
        style={{
          padding: '10px 14px', cursor: 'pointer',
          background: isActive ? 'var(--surface-active, #EDEDEF)' : isHovered ? '#F5F5F7' : 'transparent',
          borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
          display: 'flex', alignItems: 'center', gap: 11,
          transition: 'background 0.1s',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 46, height: 46, borderRadius: '50%', flexShrink: 0, position: 'relative',
          background: archived ? '#EBEBED' : '#E8E8EC',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isGroup ? (
            <>
              {otherParticipants.slice(0, 2).map((p, i) => (
                <div key={p.user_id} style={{
                  position: 'absolute',
                  ...(i === 0 ? { top: 2, left: 2, width: 26, height: 26 } : { bottom: 2, right: 2, width: 26, height: 26 }),
                  borderRadius: '50%',
                  background: archived ? '#AEAEB2' : (i === 0 ? '#8E8E93' : '#636366'),
                  color: 'white', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--surface, #fff)',
                }}>
                  {initials(resolveParticipantName(p))}
                </div>
              ))}
              {otherParticipants.length === 0 && <Users size={18} color={archived ? '#C7C7CC' : '#8E8E93'} />}
            </>
          ) : (
            otherParticipants[0] ? (
              <span style={{ fontSize: 15, fontWeight: 700, color: archived ? '#AEAEB2' : '#636366' }}>
                {initials(resolveParticipantName(otherParticipants[0]))}
              </span>
            ) : <MessageSquare size={18} color={archived ? '#C7C7CC' : '#8E8E93'} />
          )}
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
            <span style={{
              fontSize: 13.5, fontWeight: unreadCount > 0 && !archived ? 700 : 600,
              color: archived ? 'var(--text-secondary)' : 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {displayName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 6 }}>
              {fmtTime(last?.createdAt ?? conv.updated_at)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: 12, color: unreadCount > 0 && !archived ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              fontWeight: unreadCount > 0 && !archived ? 500 : 400,
            }}>
              {last
                ? (last.senderName && isGroup ? `${last.senderName.split(' ')[0]}: ${truncate(last.content, 30)}` : truncate(last.content))
                : 'Noch keine Nachrichten'}
            </span>
            {!archived && unreadCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: '#fff', borderRadius: 10,
                fontSize: 10, fontWeight: 700, padding: '1px 6px',
                minWidth: 18, textAlign: 'center', lineHeight: '16px', flexShrink: 0,
              }}>
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons on hover */}
        <div
          style={{ display: 'flex', gap: 1, flexShrink: 0, opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s' }}
          onClick={e => e.stopPropagation()}
        >
          {archived ? (
            <ActionBtn icon={<ArchiveRestore size={13} />} title="Wiederherstellen" onClick={() => unarchiveConversation(conv.id)} hoverColor="var(--accent)" />
          ) : (
            <>
              <ActionBtn icon={<Archive size={13} />} title="Archivieren" onClick={() => archiveConversation(conv.id)} />
              <ActionBtn icon={<Trash2 size={13} />} title="Löschen" onClick={() => setDeleteConfirm(conv.id)} hoverColor="#FF3B30" />
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const isSearching = searchQuery.trim().length > 0

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 300, minWidth: 300, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: 'var(--surface)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 16px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>Chats</h2>
            <button
              onClick={() => { setShowNewChat(true); setChatCreationType(null) }}
              title="Neuer Chat"
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Suchen…"
              style={{
                width: '100%', padding: '8px 10px 8px 30px',
                border: '1px solid var(--border)', borderRadius: 10,
                fontSize: 13, outline: 'none', fontFamily: 'inherit',
                background: '#F5F5F7', boxSizing: 'border-box', color: 'var(--text-primary)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-tertiary)', display: 'flex' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Search tabs */}
          {isSearching && (
            <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
              {(['chats', 'messages'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSearchTab(tab)}
                  style={{
                    flex: 1, padding: '5px 0', fontSize: 12, fontWeight: 500,
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                    background: searchTab === tab ? 'var(--accent)' : '#EBEBED',
                    color: searchTab === tab ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {tab === 'chats' ? 'Chats' : 'Nachrichten'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Message search results */}
          {isSearching && searchTab === 'messages' && (
            <>
              {searchLoading && (
                <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>Suche…</div>
              )}
              {!searchLoading && messageResults.length === 0 && searchQuery.trim() && (
                <div style={{ padding: '24px 16px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>Keine Nachrichten gefunden</div>
              )}
              {messageResults.map(msg => {
                const conv = conversations.find(c => c.id === msg.conversation_id)
                return (
                  <div
                    key={msg.id}
                    onClick={() => {
                      const c = conversations.find(x => x.id === msg.conversation_id)
                      if (c) { setActiveConv(c); setSearchQuery('') }
                    }}
                    style={{
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F7')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                      {conv ? convDisplayName(conv) : '—'} · {fmtTime(msg.created_at)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Chat list */}
          {(!isSearching || searchTab === 'chats') && (
            <>
              {filteredConversations.length === 0 && !isSearching && (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                  Noch keine Chats.<br />Erstelle deinen ersten Chat.
                </div>
              )}
              {filteredConversations.length === 0 && isSearching && (
                <div style={{ padding: '24px 16px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>Keine Chats gefunden</div>
              )}
              {filteredConversations.map(conv => (
                <ConvListItem key={conv.id} conv={conv} />
              ))}

              {!isSearching && (
                <>
                  <button
                    onClick={toggleArchived}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                      padding: '10px 14px', background: 'none', border: 'none',
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
                        <ConvListItem key={conv.id} conv={conv} archived />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {activeConv ? (
          <>
            {/* Chat header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)',
              flexShrink: 0,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: '#E8E8EC',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {convIsGroup(activeConv)
                  ? <Users size={16} color="#8E8E93" />
                  : <span style={{ fontSize: 13, fontWeight: 700, color: '#636366' }}>
                      {initials(resolveParticipantName(activeConv.conversation_participants.find(p => p.user_id !== currentUserId) ?? activeConv.conversation_participants[0]))}
                    </span>
                }
              </div>
              <button
                onClick={() => setShowInfo(v => !v)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 0 }}
              >
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {convDisplayName(activeConv)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {activeConv.conversation_participants.length} Teilnehmer{showInfo ? ' · Infos ausblenden' : ' · Infos anzeigen'}
                </div>
              </button>
            </div>

            {/* Body: messages + optional info panel */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6, background: '#FAFAFA' }}>
                {messages.map(msg => {
                  const isMe = msg.sender_id === currentUserId
                  const senderName = msg.sender?.name ?? membersById[msg.sender_id ?? '']?.profiles?.name
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                      {!isMe && (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', background: '#E5E5EA',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: '#636366', flexShrink: 0,
                        }}>
                          {initials(senderName ?? 'U')}
                        </div>
                      )}
                      <div style={{ maxWidth: '68%' }}>
                        {!isMe && senderName && convIsGroup(activeConv) && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, marginLeft: 4 }}>{senderName}</div>
                        )}
                        <div style={{
                          padding: '9px 13px',
                          borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                          background: isMe ? 'var(--accent)' : '#E5E5EA',
                          color: isMe ? '#fff' : 'var(--text-primary)',
                          fontSize: 14, lineHeight: 1.5,
                        }}>
                          {msg.content}
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3,
                          textAlign: isMe ? 'right' : 'left',
                          marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0,
                          display: 'flex', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 3,
                        }}>
                          {fmtTime(msg.created_at)}
                          {isMe && <CheckMark />}
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
                  <div style={{
                    width: 250, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
                    overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column',
                  }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Teilnehmer</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {activeConv.conversation_participants.map(p => (
                          <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#636366', flexShrink: 0 }}>
                              {initials(resolveParticipantName(p))}
                            </div>
                            <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{resolveParticipantName(p)}</span>
                            {p.user_id !== currentUserId && (
                              <button onClick={() => removeParticipant(p.user_id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--text-tertiary)', display: 'flex', borderRadius: 4 }}
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
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Hinzufügen</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {nonParticipants.map(m => (
                            <button key={m.id} onClick={() => addParticipant(m.user_id)} disabled={addingMember}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: addingMember ? 0.5 : 1 }}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#F0F0F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#8E8E93', flexShrink: 0 }}>
                                {initials(m.profiles?.name ?? '?')}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{m.profiles?.name ?? '—'}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{m.category ?? m.role}</div>
                              </div>
                              <span style={{ marginLeft: 'auto', fontSize: 16, color: 'var(--accent)' }}>+</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Message input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, background: 'var(--surface)', flexShrink: 0 }}>
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

      {/* ── New Chat Modal ── */}
      {showNewChat && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={closeNewChat}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', width: 440, maxWidth: '100%', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              {chatCreationType && (
                <button onClick={() => { setChatCreationType(null); setSelectedMembers([]); setChatName('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)', display: 'flex' }}>
                  <ArrowLeft size={18} />
                </button>
              )}
              <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', margin: 0, flex: 1 }}>
                {chatCreationType === null ? 'Neuer Chat' : chatCreationType === 'single' ? 'Einzelchat starten' : 'Gruppe erstellen'}
              </h3>
              <button onClick={closeNewChat} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Step 1: Choose type */}
            {chatCreationType === null && (
              <div style={{ padding: 20, display: 'flex', gap: 12 }}>
                {(['single', 'group'] as const).map(type => {
                  const hovered = hoveredTypeCard === type
                  return (
                    <button
                      key={type}
                      onClick={() => setChatCreationType(type)}
                      onMouseEnter={() => setHoveredTypeCard(type)}
                      onMouseLeave={() => setHoveredTypeCard(null)}
                      style={{
                        flex: 1, padding: '20px 16px', borderRadius: 12,
                        border: `1.5px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
                        background: hovered ? 'var(--accent)' : 'var(--surface)',
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: hovered ? 'rgba(255,255,255,0.2)' : '#F0F0F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {type === 'single'
                          ? <User size={22} color={hovered ? '#fff' : '#636366'} />
                          : <Users size={22} color={hovered ? '#fff' : '#636366'} />
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: hovered ? '#fff' : 'var(--text-primary)', marginBottom: 2 }}>
                          {type === 'single' ? 'Einzelchat' : 'Gruppe'}
                        </div>
                        <div style={{ fontSize: 12, color: hovered ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                          {type === 'single' ? 'Direktnachricht an eine Person' : 'Mehrere Personen gleichzeitig'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 2a: Single chat — pick one person */}
            {chatCreationType === 'single' && (
              <div style={{ padding: '16px 20px 20px' }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>Person auswählen:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                  {chatableMembers.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Keine Kontakte verfügbar</div>
                  )}
                  {chatableMembers.map(m => {
                    const isSelected = selectedMembers.includes(m.user_id)
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMembers(isSelected ? [] : [m.user_id])}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px',
                          borderRadius: 10, cursor: 'pointer',
                          background: isSelected ? 'var(--accent-light, #F0F0F2)' : '#F5F5F7',
                          border: `1.5px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                        }}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: isSelected ? 'var(--accent)' : '#D1D1D6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {initials(m.profiles?.name ?? '?')}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{m.profiles?.name ?? '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.category ?? m.role}</div>
                        </div>
                        {isSelected && <CheckIcon size={16} />}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
                  <button onClick={closeNewChat} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
                  <button
                    onClick={createConversation}
                    disabled={selectedMembers.length === 0 || creating}
                    style={{ padding: '9px 20px', background: selectedMembers.length > 0 ? 'var(--accent)' : '#C7C7CC', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: selectedMembers.length > 0 && !creating ? 'pointer' : 'default', fontSize: 14, fontWeight: 500 }}
                  >
                    {creating ? 'Wird erstellt…' : 'Chat starten'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2b: Group chat — name + multi-select */}
            {chatCreationType === 'group' && (
              <div style={{ padding: '16px 20px 20px' }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Gruppenname *</label>
                  <input
                    value={chatName}
                    onChange={e => setChatName(e.target.value)}
                    placeholder="z.B. Team Foto"
                    style={{ width: '100%', padding: '10px 13px', border: `1px solid ${chatName.trim() ? 'var(--border)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    Teilnehmer ({selectedMembers.length} ausgewählt)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                    {chatableMembers.length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Keine Kontakte verfügbar</div>
                    )}
                    {chatableMembers.map(m => {
                      const isSelected = selectedMembers.includes(m.user_id)
                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMembers(prev => isSelected ? prev.filter(id => id !== m.user_id) : [...prev, m.user_id])}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                            borderRadius: 8, cursor: 'pointer',
                            background: isSelected ? 'var(--accent-light, #F0F0F2)' : '#F5F5F7',
                            border: `1.5px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                          }}
                        >
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: isSelected ? 'var(--accent)' : '#D1D1D6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                            {initials(m.profiles?.name ?? '?')}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{m.profiles?.name ?? '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.category ?? m.role}</div>
                          </div>
                          {isSelected && <CheckIcon size={14} />}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
                  <button onClick={closeNewChat} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
                  <button
                    onClick={createConversation}
                    disabled={selectedMembers.length === 0 || !chatName.trim() || creating}
                    style={{
                      padding: '9px 20px',
                      background: selectedMembers.length > 0 && chatName.trim() ? 'var(--accent)' : '#C7C7CC',
                      color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
                      cursor: selectedMembers.length > 0 && chatName.trim() && !creating ? 'pointer' : 'default',
                      fontSize: 14, fontWeight: 500,
                    }}
                  >
                    {creating ? 'Wird erstellt…' : `Gruppe erstellen (${selectedMembers.length})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, width: 360, maxWidth: '100%', boxShadow: 'var(--shadow-md)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 10 }}>Chat löschen?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Alle Nachrichten werden unwiderruflich gelöscht.</p>
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

// ── Shared small components ─────────────────────────────────────────────────

function ActionBtn({ icon, title, onClick, hoverColor = 'var(--text)' }: {
  icon: React.ReactNode
  title: string
  onClick: () => void
  hoverColor?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', borderRadius: 4 }}
      onMouseEnter={e => (e.currentTarget.style.color = hoverColor)}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
    >
      {icon}
    </button>
  )
}

function CheckMark() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
      <polyline points="1 5 4 8 9 2" />
      <polyline points="5 8 13 2" />
    </svg>
  )
}

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--accent)', flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
