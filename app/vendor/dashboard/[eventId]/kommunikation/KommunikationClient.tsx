'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFileUpload } from '@/hooks/useFileUpload'
import ShareBox from '@/components/vendor/ShareBox'
import {
  Send, MessageSquare, Paperclip, X, Database, FolderOpen,
  FileText, Download, Layers, ChevronDown, Loader2,
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
  message_type: 'text' | 'file' | 'data_share'
  metadata: Record<string, unknown>
  sender?: { name: string } | null
}
interface ShareRow {
  id: string; module: ShareModule; mode: 'snapshot' | 'live'; status: string; created_at: string
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}
function fmtTime(ts: string) {
  const d = new Date(ts); const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}
function normParticipants(conv: { conversation_participants?: { user_id: string; profiles: unknown }[] }): Participant[] {
  return (conv.conversation_participants ?? []).map(p => ({
    user_id: p.user_id,
    profiles: Array.isArray(p.profiles) ? (p.profiles[0] ?? null) : (p.profiles as { id: string; name: string } | null),
  }))
}

export default function KommunikationClient({ eventId, userId }: { eventId: string; userId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const fileUpload = useFileUpload()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [shares, setShares] = useState<ShareRow[]>([])
  const [panel, setPanel] = useState<null | 'data' | 'files'>(null)
  const [openShare, setOpenShare] = useState<{ label: string; snapshot: ModuleSnapshot | null; loading: boolean } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load conversations ─────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('conversations')
      .select('id, name, updated_at, conversation_participants(user_id, profiles(id, name))')
      .eq('event_id', eventId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        const normalized = (data ?? []).map(c => ({ ...c, conversation_participants: normParticipants(c) }))
        setConversations(normalized)
        if (normalized.length) setActiveConv(prev => prev ?? normalized[0])
      })
  }, [supabase, eventId])

  // ── Load messages + shares for active conversation ──────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at, message_type, metadata, sender:profiles!sender_id(name)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages((data ?? []).map(m => ({
      ...m,
      message_type: (m.message_type ?? 'text') as Message['message_type'],
      metadata: (m.metadata ?? {}) as Record<string, unknown>,
      sender: Array.isArray(m.sender) ? (m.sender[0] ?? null) : m.sender,
    })))
  }, [supabase])

  const loadShares = useCallback(async (convId: string) => {
    const res = await fetch(`/api/vendor/shares?conversationId=${convId}`)
    if (res.ok) {
      const { shares } = await res.json()
      setShares(shares ?? [])
    }
  }, [])

  useEffect(() => {
    if (!activeConv) return
    loadMessages(activeConv.id)
    loadShares(activeConv.id)
    supabase.from('conversation_read_state')
      .upsert({ conversation_id: activeConv.id, user_id: userId, last_read_at: new Date().toISOString() })

    const channel = supabase
      .channel(`vendor-komm:${activeConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        const p = payload.new as Message
        setMessages(prev => prev.some(m => m.id === p.id) ? prev : [...prev, {
          ...p, message_type: (p.message_type ?? 'text'), metadata: (p.metadata ?? {}), sender: null,
        }])
        if (p.message_type === 'data_share') loadShares(activeConv.id)
        if (p.sender_id !== userId) {
          supabase.from('conversation_read_state').upsert({
            conversation_id: activeConv.id, user_id: userId, last_read_at: new Date().toISOString(),
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeConv?.id, loadMessages, loadShares, supabase, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Send text ───────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!newMsg.trim() || !activeConv || sending) return
    setSending(true)
    const content = newMsg.trim()
    setNewMsg('')
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: userId, content, event_id: eventId, message_type: 'text' })
      .select('id, conversation_id, sender_id, content, created_at, message_type, metadata')
      .single()
    if (inserted) {
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, {
        ...inserted, message_type: 'text', metadata: {}, sender: null,
      }])
    }
    setSending(false)
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.id)
  }

  // ── Send file ─────────────────────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file || !activeConv) return
    const uploaded = await fileUpload.upload(file, eventId, 'chats', 'chat')
    if (!uploaded) return
    const { data: inserted } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConv.id, sender_id: userId, event_id: eventId,
        content: file.name, message_type: 'file',
        metadata: { file_id: uploaded.fileId, name: file.name, mime: file.type, size: file.size },
      })
      .select('id, conversation_id, sender_id, content, created_at, message_type, metadata')
      .single()
    if (inserted) {
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, {
        ...inserted, message_type: 'file', metadata: inserted.metadata ?? {}, sender: null,
      }])
    }
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.id)
  }

  async function downloadFile(fileId: string) {
    const res = await fetch(`/api/files/${fileId}/download-url`)
    if (!res.ok) return
    const { downloadUrl } = await res.json()
    window.open(downloadUrl, '_blank')
  }

  async function viewShare(shareId: string, label: string) {
    setOpenShare({ label, snapshot: null, loading: true })
    const res = await fetch(`/api/vendor/shares/${shareId}`)
    if (!res.ok) { setOpenShare({ label, snapshot: null, loading: false }); return }
    const { share } = await res.json()
    setOpenShare({ label, snapshot: share.snapshot ?? null, loading: false })
  }

  // Files collected from chat messages
  const chatFiles = useMemo(() =>
    messages.filter(m => m.message_type === 'file').map(m => ({
      id: m.id, fileId: m.metadata.file_id as string,
      name: (m.metadata.name as string) ?? m.content,
      createdAt: m.created_at,
    })).reverse(),
    [messages])

  const activeShares = shares.filter(s => s.status !== 'revoked')

  function convName(conv: Conversation): string {
    if (conv.name) return conv.name
    const others = conv.conversation_participants.filter(p => p.user_id !== userId).map(p => p.profiles?.name?.split(' ')[0] ?? '?')
    return others.join(', ') || 'Chat'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0, background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeConv ? convName(activeConv) : 'Kommunikation'}
          </h1>
          {conversations.length > 1 && (
            <select
              value={activeConv?.id ?? ''}
              onChange={e => setActiveConv(conversations.find(c => c.id === e.target.value) ?? null)}
              style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', background: 'var(--surface)' }}
            >
              {conversations.map(c => <option key={c.id} value={c.id}>{convName(c)}</option>)}
            </select>
          )}
        </div>
        <PillButton active={panel === 'data'} onClick={() => setPanel(panel === 'data' ? null : 'data')} icon={<Database size={14} />} label="Geteilte Daten" count={activeShares.length} />
        <PillButton active={panel === 'files'} onClick={() => setPanel(panel === 'files' ? null : 'files')} icon={<FolderOpen size={14} />} label="Dateien" count={chatFiles.length} />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Chat column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {activeConv ? (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFAFA' }}>
                {messages.length === 0 && (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                    Noch keine Nachrichten. Schreibt euch hier mit dem Brautpaar.
                  </div>
                )}
                {messages.map(msg => {
                  const isMe = msg.sender_id === userId
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                      {!isMe && (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#636366', flexShrink: 0 }}>
                          {initials(msg.sender?.name ?? '?')}
                        </div>
                      )}
                      <div style={{ maxWidth: '78%' }}>
                        {!isMe && msg.sender && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, marginLeft: 4 }}>{msg.sender.name}</div>
                        )}
                        <MessageBubble msg={msg} isMe={isMe} onDownload={downloadFile} onViewShare={viewShare} />
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, textAlign: isMe ? 'right' : 'left', marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0 }}>
                          {fmtTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface)', flexShrink: 0 }}>
                <input ref={fileInputRef} type="file" onChange={handleFile} style={{ display: 'none' }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileUpload.uploading}
                  aria-label="Datei anhängen"
                  style={{ width: 38, height: 38, borderRadius: '50%', background: '#F0F0F2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#636366', flexShrink: 0 }}
                >
                  {fileUpload.uploading ? <Loader2 size={16} className="spin" /> : <Paperclip size={16} />}
                </button>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={fileUpload.uploading ? 'Datei wird hochgeladen…' : 'Nachricht schreiben…'}
                  style={{ flex: 1, minWidth: 0, padding: '10px 16px', border: 'none', borderRadius: 22, fontSize: 15, outline: 'none', fontFamily: 'inherit', background: '#F0F0F2' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMsg.trim() || sending}
                  aria-label="Senden"
                  style={{ width: 40, height: 40, borderRadius: '50%', background: newMsg.trim() ? 'var(--accent)' : '#E5E5EA', border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: newMsg.trim() ? '#fff' : '#8E8E93', flexShrink: 0 }}
                >
                  <Send size={16} />
                </button>
              </div>
              {fileUpload.error && (
                <div style={{ padding: '6px 16px', fontSize: 12, color: '#FF3B30', background: 'var(--surface)' }}>{fileUpload.error}</div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexDirection: 'column', gap: 12 }}>
              <MessageSquare size={40} color="#C7C7CC" />
              <p style={{ fontSize: 14 }}>Noch kein Chat vorhanden</p>
            </div>
          )}
        </div>

        {/* Side panel (overlay on mobile) */}
        {panel && (
          <SidePanel
            title={panel === 'data' ? 'Geteilte Daten' : 'Dateien'}
            onClose={() => setPanel(null)}
          >
            {panel === 'data' ? (
              activeShares.length === 0 ? (
                <EmptyPanel icon={<Database size={28} />} text="Das Brautpaar hat noch keine Daten geteilt. Geteilte Bereiche (Ablaufplan, Sitzplan …) erscheinen hier." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeShares.map(s => (
                    <button key={s.id} onClick={() => viewShare(s.id, SHARE_MODULE_LABELS[s.module])}
                      style={panelItemStyle}>
                      <Layers size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{SHARE_MODULE_LABELS[s.module]}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {s.mode === 'live' ? 'Live' : 'Auszug'}{s.status === 'frozen' ? ' · eingefroren' : ''} · {fmtTime(s.created_at)}
                        </div>
                      </div>
                      <ChevronDown size={14} style={{ transform: 'rotate(-90deg)', color: 'var(--text-tertiary)' }} />
                    </button>
                  ))}
                </div>
              )
            ) : (
              chatFiles.length === 0 ? (
                <EmptyPanel icon={<FolderOpen size={28} />} text="Alle im Chat versendeten Dateien erscheinen hier." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chatFiles.map(f => (
                    <button key={f.id} onClick={() => downloadFile(f.fileId)} style={panelItemStyle}>
                      <FileText size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtTime(f.createdAt)}</div>
                      </div>
                      <Download size={14} style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                  ))}
                </div>
              )
            )}
          </SidePanel>
        )}
      </div>

      {/* Share viewer modal */}
      {openShare && (
        <div onClick={() => setOpenShare(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, width: 640, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={17} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, flex: 1 }}>{openShare.label}</h3>
              <button onClick={() => setOpenShare(null)} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto' }}>
              {openShare.loading
                ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 30 }}><Loader2 size={22} className="spin" /></div>
                : openShare.snapshot
                  ? <ShareBox snapshot={openShare.snapshot} />
                  : <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Diese Freigabe ist nicht mehr verfügbar.</p>}
            </div>
          </div>
        </div>
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const panelItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
  cursor: 'pointer', fontFamily: 'inherit', width: '100%',
}

function PillButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 20,
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      background: active ? 'var(--accent)' : 'var(--surface)',
      color: active ? '#fff' : 'var(--text-secondary)',
      cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {icon}
      <span className="pill-label">{label}</span>
      {count > 0 && (
        <span style={{ background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg)', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '0 6px', minWidth: 16, textAlign: 'center' }}>{count}</span>
      )}
      <style>{`@media (max-width: 520px) { .pill-label { display: none; } }`}</style>
    </button>
  )
}

function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} className="vendor-panel-scrim" style={{ display: 'none' }} />
      <div className="vendor-side-panel" style={{
        width: 320, minWidth: 320, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 50,
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, flex: 1, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{title}</h3>
          <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>{children}</div>
      </div>
      <style>{`
        @media (max-width: 767px) {
          .vendor-panel-scrim { display: block !important; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 49; }
          .vendor-side-panel { position: fixed !important; top: 0; right: 0; height: 100dvh; width: 88% !important; min-width: 0 !important; }
        }
      `}</style>
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

function MessageBubble({ msg, isMe, onDownload, onViewShare }: {
  msg: Message; isMe: boolean
  onDownload: (fileId: string) => void
  onViewShare: (shareId: string, label: string) => void
}) {
  const baseBubble: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
    fontSize: 14, lineHeight: 1.5,
  }

  if (msg.message_type === 'file') {
    const fileId = msg.metadata.file_id as string
    return (
      <button onClick={() => fileId && onDownload(fileId)} style={{
        ...baseBubble, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        background: isMe ? 'var(--accent)' : '#E5E5EA', color: isMe ? '#fff' : 'var(--text-primary)',
        border: 'none', fontFamily: 'inherit', textAlign: 'left', maxWidth: 280,
      }}>
        <FileText size={18} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {(msg.metadata.name as string) ?? msg.content}
        </span>
        <Download size={15} style={{ flexShrink: 0, opacity: 0.85 }} />
      </button>
    )
  }

  if (msg.message_type === 'data_share') {
    const shareId = msg.metadata.share_id as string
    const mod = msg.metadata.module as ShareModule
    const mode = msg.metadata.mode as string
    return (
      <button onClick={() => shareId && onViewShare(shareId, SHARE_MODULE_LABELS[mod] ?? 'Daten')} style={{
        ...baseBubble, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--text-primary)',
        fontFamily: 'inherit', textAlign: 'left', maxWidth: 300,
      }}>
        <Database size={18} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{SHARE_MODULE_LABELS[mod] ?? 'Daten'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{mode === 'live' ? 'Live geteilt · tippen zum Öffnen' : 'Auszug · tippen zum Öffnen'}</div>
        </div>
      </button>
    )
  }

  return (
    <div style={{ ...baseBubble, background: isMe ? 'var(--accent)' : '#E5E5EA', color: isMe ? '#fff' : 'var(--text-primary)' }}>
      {msg.content}
    </div>
  )
}
