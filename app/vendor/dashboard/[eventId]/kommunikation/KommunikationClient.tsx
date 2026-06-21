'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFileUpload } from '@/hooks/useFileUpload'
import ShareBox from '@/components/vendor/ShareBox'
import ChatOfferMessage from '@/components/chat/ChatOfferMessage'
import {
  Send, MessageSquare, Paperclip, X, Database, FolderOpen,
  FileText, Download, Layers, Loader2, Search, ArrowLeft,
  Plus, Users, Check,
} from 'lucide-react'
import { SHARE_MODULE_LABELS, type ModuleSnapshot, type ShareModule } from '@/lib/vendor/shares'

interface Participant { user_id: string; profiles: { id: string; name: string } | null }
interface Conversation {
  id: string; name: string | null; updated_at: string
  conversation_participants: Participant[]
}
interface Message {
  id: string; conversation_id: string; sender_id: string | null
  content: string; created_at: string
  message_type: 'text' | 'file' | 'data_share' | 'offer'
  metadata: Record<string, unknown>
  sender?: { name: string } | null
}
interface ShareRow { id: string; module: ShareModule; mode: 'snapshot' | 'live'; status: string; created_at: string }
interface Member { user_id: string; role: string; profiles: { id: string; name: string; email: string } | null }
interface LastMsg { content: string; type: Message['message_type']; createdAt: string }

const CONTACT_ROLES = ['veranstalter', 'brautpaar', 'brautpaar_solo']

function initials(name: string) {
  return (name || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}
function fmtTime(ts: string) {
  const d = new Date(ts); const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Gestern'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}
function normParts(conv: { conversation_participants?: { user_id: string; profiles: unknown }[] }): Participant[] {
  return (conv.conversation_participants ?? []).map(p => ({
    user_id: p.user_id,
    profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : (p.profiles as { id: string; name: string } | null),
  }))
}
function previewText(m: LastMsg | undefined): string {
  if (!m) return 'Noch keine Nachrichten'
  if (m.type === 'file') return '📎 Datei'
  if (m.type === 'data_share') return 'Daten geteilt'
  if (m.type === 'offer') return 'Angebot'
  return m.content
}

export default function KommunikationClient({ eventId, userId }: { eventId: string; userId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const fileUpload = useFileUpload()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [lastMessages, setLastMessages] = useState<Record<string, LastMsg>>({})
  const [shares, setShares] = useState<ShareRow[]>([])
  const [panel, setPanel] = useState<null | 'data' | 'files'>(null)
  const [openShare, setOpenShare] = useState<{ label: string; snapshot: ModuleSnapshot | null; loading: boolean } | null>(null)
  const [search, setSearch] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeConvIdRef = useRef<string | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const membersById = useMemo(() => Object.fromEntries(members.map(m => [m.user_id, m])), [members])

  // ── Members + conversations ────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('event_members').select('user_id, role, profiles!user_id(id, name, email)').eq('event_id', eventId)
      .then(({ data }) => setMembers((data ?? []).map(m => ({ ...m, profiles: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles }))))
  }, [supabase, eventId])

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select('id, name, updated_at, conversation_participants(user_id, profiles(id, name))')
      .eq('event_id', eventId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
    const normalized = (data ?? []).map(c => ({ ...c, conversation_participants: normParts(c) }))
    setConversations(normalized)
    setLoadingConvs(false)
    if (!isMobile) setActiveConv(prev => prev ?? normalized[0] ?? null)
    return normalized
  }, [supabase, eventId, isMobile])

  useEffect(() => { loadConversations() }, [loadConversations])

  // last messages + unread counts
  useEffect(() => {
    if (conversations.length === 0) return
    const ids = conversations.map(c => c.id)
    supabase
      .from('messages')
      .select('conversation_id, content, created_at, message_type')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(ids.length * 8)
      .then(({ data }) => {
        const map: Record<string, LastMsg> = {}
        for (const m of (data ?? [])) {
          if (!map[m.conversation_id]) map[m.conversation_id] = { content: m.content, type: (m.message_type ?? 'text') as Message['message_type'], createdAt: m.created_at }
        }
        setLastMessages(prev => ({ ...map, ...prev }))
      })
    supabase.rpc('get_conversation_unread_counts', { p_event_id: eventId, p_user_id: userId }).then(({ data }) => {
      if (!data) return
      const counts: Record<string, number> = {}
      for (const r of data as { conversation_id: string; unread_count: number }[]) counts[r.conversation_id] = r.unread_count
      setUnread(counts)
    })
  }, [conversations.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Active conversation: messages + shares + realtime ──────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at, message_type, metadata, sender:profiles!sender_id(name)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages((data ?? []).map(m => ({
      ...m, message_type: (m.message_type ?? 'text') as Message['message_type'],
      metadata: (m.metadata ?? {}) as Record<string, unknown>,
      sender: Array.isArray(m.sender) ? (m.sender[0] ?? null) : m.sender,
    })))
  }, [supabase])

  const loadShares = useCallback(async (convId: string) => {
    const res = await fetch(`/api/vendor/shares?conversationId=${convId}`)
    if (res.ok) setShares((await res.json()).shares ?? [])
  }, [])

  useEffect(() => {
    activeConvIdRef.current = activeConv?.id ?? null
    setPanel(null)
    if (!activeConv) { setMessages([]); setShares([]); return }
    loadMessages(activeConv.id)
    loadShares(activeConv.id)
    supabase.from('conversation_read_state').upsert({ conversation_id: activeConv.id, user_id: userId, last_read_at: new Date().toISOString() })
      .then(() => setUnread(prev => ({ ...prev, [activeConv.id]: 0 })))

    const channel = supabase
      .channel(`vendor-komm:${activeConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv.id}` }, (payload) => {
        const p = payload.new as Message
        setMessages(prev => prev.some(m => m.id === p.id) ? prev : [...prev, { ...p, message_type: (p.message_type ?? 'text'), metadata: (p.metadata ?? {}), sender: null }])
        setLastMessages(prev => ({ ...prev, [p.conversation_id]: { content: p.content, type: (p.message_type ?? 'text'), createdAt: p.created_at } }))
        if (p.message_type === 'data_share') loadShares(activeConv.id)
        if (p.sender_id !== userId) supabase.from('conversation_read_state').upsert({ conversation_id: activeConv.id, user_id: userId, last_read_at: new Date().toISOString() })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeConv?.id, loadMessages, loadShares, supabase, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // unread for inactive conversations
  useEffect(() => {
    const channel = supabase
      .channel(`vendor-komm-unread:${eventId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` }, (payload) => {
        const p = payload.new as { id: string; conversation_id: string; sender_id: string | null; content: string; created_at: string; message_type?: Message['message_type'] }
        setLastMessages(prev => ({ ...prev, [p.conversation_id]: { content: p.content, type: (p.message_type ?? 'text'), createdAt: p.created_at } }))
        setConversations(prev => prev
          .map(c => c.id === p.conversation_id ? { ...c, updated_at: p.created_at } : c)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
        if (p.sender_id === userId || p.conversation_id === activeConvIdRef.current) return
        setUnread(prev => ({ ...prev, [p.conversation_id]: (prev[p.conversation_id] ?? 0) + 1 }))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, eventId, userId])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Actions ────────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!newMsg.trim() || !activeConv || sending) return
    setSending(true)
    const content = newMsg.trim(); setNewMsg('')
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: userId, content, event_id: eventId, message_type: 'text' })
      .select('id, conversation_id, sender_id, content, created_at, message_type, metadata').single()
    if (inserted) {
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, { ...inserted, message_type: 'text', metadata: {}, sender: null }])
      setLastMessages(prev => ({ ...prev, [activeConv.id]: { content, type: 'text', createdAt: inserted.created_at } }))
    }
    setSending(false)
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.id)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (e.target) e.target.value = ''
    if (!file || !activeConv) return
    const uploaded = await fileUpload.upload(file, eventId, 'chats', 'chat')
    if (!uploaded) return
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: userId, event_id: eventId, content: file.name, message_type: 'file', metadata: { file_id: uploaded.fileId, name: file.name, mime: file.type, size: file.size } })
      .select('id, conversation_id, sender_id, content, created_at, message_type, metadata').single()
    if (inserted) {
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, { ...inserted, message_type: 'file', metadata: inserted.metadata ?? {}, sender: null }])
      setLastMessages(prev => ({ ...prev, [activeConv.id]: { content: file.name, type: 'file', createdAt: inserted.created_at } }))
    }
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.id)
  }

  async function downloadFile(fileId: string) {
    const res = await fetch(`/api/files/${fileId}/download-url`); if (!res.ok) return
    const { downloadUrl } = await res.json(); window.open(downloadUrl, '_blank')
  }

  async function viewShare(shareId: string, label: string) {
    setOpenShare({ label, snapshot: null, loading: true })
    const res = await fetch(`/api/vendor/shares/${shareId}`)
    if (!res.ok) { setOpenShare({ label, snapshot: null, loading: false }); return }
    const { share } = await res.json()
    setOpenShare({ label, snapshot: share.snapshot ?? null, loading: false })
  }

  function openConversation(conv: Conversation) {
    setActiveConv(conv); setMobileShowChat(true)
  }

  async function startChatWith(contactUserId: string) {
    if (startingChat) return
    // Existing 1:1?
    const existing = conversations.find(c => {
      const ids = c.conversation_participants.map(p => p.user_id)
      return ids.length === 2 && ids.includes(contactUserId) && ids.includes(userId)
    })
    if (existing) { setShowNewChat(false); openConversation(existing); return }
    setStartingChat(true)
    const { data: convId } = await supabase.rpc('create_conversation', { p_event_id: eventId, p_name: null, p_participant_ids: [contactUserId] })
    if (convId) {
      const fresh = await loadConversations()
      const created = fresh.find(c => c.id === convId)
      if (created) openConversation(created)
    }
    setStartingChat(false)
    setShowNewChat(false)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const chatFiles = useMemo(() =>
    messages.filter(m => m.message_type === 'file').map(m => ({ id: m.id, fileId: m.metadata.file_id as string, name: (m.metadata.name as string) ?? m.content, createdAt: m.created_at })).reverse(),
    [messages])
  const activeShares = shares.filter(s => s.status !== 'revoked')

  const resolveName = useCallback((p: Participant) => p.profiles?.name ?? membersById[p.user_id]?.profiles?.name ?? 'Unbekannt', [membersById])
  const convName = useCallback((conv: Conversation): string => {
    if (conv.name) return conv.name
    const others = conv.conversation_participants.filter(p => p.user_id !== userId)
    if (others.length === 0) return 'Chat'
    if (others.length === 1) return resolveName(others[0])
    return others.map(p => resolveName(p).split(' ')[0]).join(', ')
  }, [userId, resolveName])
  const convIsGroup = (conv: Conversation) => !!conv.name || conv.conversation_participants.length > 2

  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => convName(c).toLowerCase().includes(q))
  }, [conversations, search, convName])

  const newChatContacts = useMemo(() =>
    members.filter(m => m.user_id !== userId && CONTACT_ROLES.includes(m.role)),
    [members, userId])

  // ── Render ────────────────────────────────────────────────────────────────
  const listPane = (
    <div className="vk-list" style={{
      width: isMobile ? '100%' : 340, minWidth: isMobile ? 0 : 340,
      borderRight: isMobile ? 'none' : '1px solid var(--border)',
      display: isMobile && mobileShowChat ? 'none' : 'flex', flexDirection: 'column',
      background: 'var(--surface)', minHeight: 0,
    }}>
      <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.3px', margin: 0 }}>Chats</h1>
          <button onClick={() => setShowNewChat(true)} aria-label="Neuer Chat" style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--accent)', color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}><Plus size={18} /></button>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" style={{
            width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--border)', borderRadius: 10,
            fontSize: isMobile ? 16 : 13.5, outline: 'none', fontFamily: 'inherit', background: 'var(--bg)', boxSizing: 'border-box', color: 'var(--text-primary)',
          }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loadingConvs ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-tertiary)' }}><Loader2 size={18} className="vk-spin" /></div>
        ) : filteredConvs.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13.5, lineHeight: 1.6 }}>
            {search ? 'Keine Treffer.' : <>Noch keine Chats.<br />Starte oben rechts einen neuen Chat mit dem Brautpaar.</>}
          </div>
        ) : filteredConvs.map(conv => {
          const active = activeConv?.id === conv.id
          const group = convIsGroup(conv)
          const last = lastMessages[conv.id]
          const uc = unread[conv.id] ?? 0
          return (
            <button key={conv.id} onClick={() => openConversation(conv)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
              background: active && !isMobile ? 'var(--bg)' : 'transparent', border: 'none',
              borderLeft: `3px solid ${active && !isMobile ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
              <Avatar group={group} text={initials(convName(conv))} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: uc > 0 ? 700 : 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{convName(conv)}</span>
                  <span style={{ fontSize: 11, color: uc > 0 ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0, fontWeight: uc > 0 ? 600 : 400 }}>{fmtTime(last?.createdAt ?? conv.updated_at)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: uc > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: uc > 0 ? 500 : 400 }}>{previewText(last)}</span>
                  {uc > 0 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, fontSize: 10.5, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center', lineHeight: '16px', flexShrink: 0 }}>{uc > 99 ? '99+' : uc}</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const chatPane = (
    <div className="vk-chat" style={{
      flex: 1, display: isMobile && !mobileShowChat ? 'none' : 'flex', flexDirection: 'column',
      minWidth: 0, minHeight: 0, background: 'var(--surface)',
    }}>
      {activeConv ? (
        <>
          <div style={{ padding: isMobile ? '10px 12px' : '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {isMobile && (
              <button onClick={() => setMobileShowChat(false)} aria-label="Zurück" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', flexShrink: 0, padding: 2 }}><ArrowLeft size={22} /></button>
            )}
            <Avatar small group={convIsGroup(activeConv)} text={initials(convName(activeConv))} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{convName(activeConv)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{activeConv.conversation_participants.length} Teilnehmer</div>
            </div>
            <PillButton active={panel === 'data'} onClick={() => setPanel(panel === 'data' ? null : 'data')} icon={<Database size={14} />} label="Daten" count={activeShares.length} />
            <PillButton active={panel === 'files'} onClick={() => setPanel(panel === 'files' ? null : 'files')} icon={<FolderOpen size={14} />} label="Dateien" count={chatFiles.length} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 8, background: '#FAFAFA', minHeight: 0 }}>
            {messages.length === 0 && <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Noch keine Nachrichten.</div>}
            {messages.map(msg => {
              const isMe = msg.sender_id === userId
              const senderName = msg.sender?.name ?? membersById[msg.sender_id ?? '']?.profiles?.name
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                  {!isMe && <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#636366', flexShrink: 0 }}>{initials(senderName ?? '?')}</div>}
                  <div style={{ maxWidth: isMobile ? '80%' : '66%' }}>
                    {!isMe && senderName && convIsGroup(activeConv) && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, marginLeft: 4 }}>{senderName}</div>}
                    {msg.message_type === 'offer'
                      ? <ChatOfferMessage requestId={String(msg.metadata.request_id ?? '')} side="vendor" isMe={isMe} total={msg.metadata.total as number} currency={msg.metadata.currency as string} vendorName={msg.metadata.vendor_name as string} />
                      : <MessageBubble msg={msg} isMe={isMe} onDownload={downloadFile} onViewShare={viewShare} />}
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, textAlign: isMe ? 'right' : 'left', marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0 }}>{fmtTime(msg.created_at)}</div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '11px 14px calc(11px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <input ref={fileInputRef} type="file" onChange={handleFile} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={fileUpload.uploading} aria-label="Datei anhängen" style={iconRound}>
              {fileUpload.uploading ? <Loader2 size={16} className="vk-spin" /> : <Paperclip size={16} />}
            </button>
            <input value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder={fileUpload.uploading ? 'Datei wird hochgeladen…' : 'Nachricht schreiben…'} style={{ flex: 1, minWidth: 0, padding: '10px 16px', border: 'none', borderRadius: 22, fontSize: isMobile ? 16 : 14, outline: 'none', fontFamily: 'inherit', background: '#F0F0F2' }} />
            <button onClick={sendMessage} disabled={!newMsg.trim() || sending} aria-label="Senden" style={{ width: 40, height: 40, borderRadius: '50%', background: newMsg.trim() ? 'var(--accent)' : '#E5E5EA', border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: newMsg.trim() ? '#fff' : '#8E8E93', flexShrink: 0 }}><Send size={16} /></button>
          </div>
          {fileUpload.error && <div style={{ padding: '6px 16px', fontSize: 12, color: '#FF3B30' }}>{fileUpload.error}</div>}
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexDirection: 'column', gap: 12 }}>
          <MessageSquare size={40} color="#C7C7CC" />
          <p style={{ fontSize: 14 }}>Wähle einen Chat aus</p>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, background: 'var(--bg)', position: 'relative' }}>
      {listPane}
      {chatPane}

      {/* Side panel */}
      {panel && activeConv && (
        <SidePanel title={panel === 'data' ? 'Geteilte Daten' : 'Dateien'} onClose={() => setPanel(null)}>
          {panel === 'data' ? (
            activeShares.length === 0
              ? <EmptyPanel icon={<Database size={28} />} text="Das Brautpaar hat noch keine Daten geteilt." />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{activeShares.map(s => (
                  <button key={s.id} onClick={() => viewShare(s.id, SHARE_MODULE_LABELS[s.module])} style={panelItem}>
                    <Layers size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{SHARE_MODULE_LABELS[s.module]}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.mode === 'live' ? 'Live' : 'Auszug'}{s.status === 'frozen' ? ' · eingefroren' : ''} · {fmtTime(s.created_at)}</div>
                    </div>
                  </button>))}</div>
          ) : (
            chatFiles.length === 0
              ? <EmptyPanel icon={<FolderOpen size={28} />} text="Alle im Chat versendeten Dateien erscheinen hier." />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{chatFiles.map(f => (
                  <button key={f.id} onClick={() => downloadFile(f.fileId)} style={panelItem}>
                    <FileText size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtTime(f.createdAt)}</div>
                    </div>
                    <Download size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </button>))}</div>
          )}
        </SidePanel>
      )}

      {/* New chat modal */}
      {showNewChat && (
        <div onClick={() => setShowNewChat(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, width: 420, maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, flex: 1 }}>Neuer Chat</h3>
              <button onClick={() => setShowNewChat(false)} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 12, overflowY: 'auto' }}>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 8px 10px' }}>Mit wem möchtest du schreiben?</p>
              {newChatContacts.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Keine Kontakte verfügbar.</div>
              ) : newChatContacts.map(m => (
                <button key={m.user_id} onClick={() => startChatWith(m.user_id)} disabled={startingChat} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                  border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Avatar small text={initials(m.profiles?.name ?? '?')} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{m.profiles?.name ?? '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{m.role === 'veranstalter' ? 'Veranstalter' : 'Brautpaar'}</div>
                  </div>
                  {startingChat ? <Loader2 size={15} className="vk-spin" /> : <Check size={15} style={{ color: 'var(--accent)', opacity: 0 }} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share viewer */}
      {openShare && (
        <div onClick={() => setOpenShare(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, width: 640, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={17} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, flex: 1 }}>{openShare.label}</h3>
              <button onClick={() => setOpenShare(null)} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto' }}>
              {openShare.loading ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 30 }}><Loader2 size={22} className="vk-spin" /></div>
                : openShare.snapshot ? <ShareBox snapshot={openShare.snapshot} />
                : <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Diese Freigabe ist nicht mehr verfügbar.</p>}
            </div>
          </div>
        </div>
      )}

      <style>{`.vk-spin { animation: vkspin 1s linear infinite; } @keyframes vkspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const iconRound: React.CSSProperties = { width: 38, height: 38, borderRadius: '50%', background: '#F0F0F2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#636366', flexShrink: 0 }
const panelItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }

function Avatar({ text, group, small }: { text: string; group?: boolean; small?: boolean }) {
  const size = small ? 38 : 46
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E8E8EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {group ? <Users size={small ? 16 : 18} color="#8E8E93" /> : <span style={{ fontSize: small ? 13 : 15, fontWeight: 700, color: '#636366' }}>{text}</span>}
    </div>
  )
}

function PillButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 20,
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)',
      color: active ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {icon}<span className="vk-pill-label">{label}</span>
      {count > 0 && <span style={{ background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg)', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '0 6px', minWidth: 16, textAlign: 'center' }}>{count}</span>}
      <style>{`@media (max-width: 560px) { .vk-pill-label { display: none; } }`}</style>
    </button>
  )
}

function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} className="vk-scrim" style={{ display: 'none' }} />
      <div className="vk-panel" style={{ width: 320, minWidth: 320, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 60 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, flex: 1, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{title}</h3>
          <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>{children}</div>
      </div>
      <style>{`@media (max-width: 900px) { .vk-scrim { display: block !important; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 59; } .vk-panel { position: fixed !important; top: 0; right: 0; height: 100dvh; width: 86% !important; max-width: 360px; min-width: 0 !important; } }`}</style>
    </>
  )
}

function EmptyPanel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-tertiary)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <p style={{ fontSize: 13, lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}

function MessageBubble({ msg, isMe, onDownload, onViewShare }: { msg: Message; isMe: boolean; onDownload: (fileId: string) => void; onViewShare: (shareId: string, label: string) => void }) {
  const base: React.CSSProperties = { padding: '10px 14px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px', fontSize: 14, lineHeight: 1.5 }
  if (msg.message_type === 'file') {
    const fileId = msg.metadata.file_id as string
    return (
      <button onClick={() => fileId && onDownload(fileId)} style={{ ...base, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isMe ? 'var(--accent)' : '#E5E5EA', color: isMe ? '#fff' : 'var(--text-primary)', border: 'none', fontFamily: 'inherit', textAlign: 'left', maxWidth: 280 }}>
        <FileText size={18} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{(msg.metadata.name as string) ?? msg.content}</span>
        <Download size={15} style={{ flexShrink: 0, opacity: 0.85 }} />
      </button>
    )
  }
  if (msg.message_type === 'data_share') {
    const shareId = msg.metadata.share_id as string
    const mod = msg.metadata.module as ShareModule
    const mode = msg.metadata.mode as string
    return (
      <button onClick={() => shareId && onViewShare(shareId, SHARE_MODULE_LABELS[mod] ?? 'Daten')} style={{ ...base, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left', maxWidth: 300 }}>
        <Database size={18} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{SHARE_MODULE_LABELS[mod] ?? 'Daten'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{mode === 'live' ? 'Live geteilt · tippen zum Öffnen' : 'Auszug · tippen zum Öffnen'}</div>
        </div>
      </button>
    )
  }
  return <div style={{ ...base, background: isMe ? 'var(--accent)' : '#E5E5EA', color: isMe ? '#fff' : 'var(--text-primary)' }}>{msg.content}</div>
}
