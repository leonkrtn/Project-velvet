'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFileUpload } from '@/hooks/useFileUpload'
import ShareBox from '@/components/vendor/ShareBox'
import { Send, Paperclip, FileText, Download, Database, Loader2, X } from 'lucide-react'
import { SHARE_MODULE_LABELS, type ModuleSnapshot, type ShareModule } from '@/lib/vendor/shares'

interface Message {
  id: string; conversation_id: string; sender_id: string | null
  content: string; created_at: string
  message_type: 'text' | 'file' | 'data_share'
  metadata: Record<string, unknown>
  sender?: { name: string } | null
}

function initials(name: string) { return (name || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) }
function fmtTime(ts: string) {
  const d = new Date(ts); const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

// Self-contained chat for a single conversation. Fills its parent (height: 100%).
export default function ConversationChat({ eventId, conversationId, currentUserId }: {
  eventId: string; conversationId: string; currentUserId: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const fileUpload = useFileUpload()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openShare, setOpenShare] = useState<{ label: string; snapshot: ModuleSnapshot | null; loading: boolean } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at, message_type, metadata, sender:profiles!sender_id(name)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages((data ?? []).map(m => ({
      ...m, message_type: (m.message_type ?? 'text') as Message['message_type'],
      metadata: (m.metadata ?? {}) as Record<string, unknown>,
      sender: Array.isArray(m.sender) ? (m.sender[0] ?? null) : m.sender,
    })))
    setLoading(false)
  }, [supabase, conversationId])

  useEffect(() => {
    setLoading(true); load()
    supabase.from('conversation_read_state').upsert({ conversation_id: conversationId, user_id: currentUserId, last_read_at: new Date().toISOString() })
    const channel = supabase
      .channel(`conv-chat:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const p = payload.new as Message
        setMessages(prev => prev.some(m => m.id === p.id) ? prev : [...prev, { ...p, message_type: (p.message_type ?? 'text'), metadata: (p.metadata ?? {}), sender: null }])
        if (p.sender_id !== currentUserId) supabase.from('conversation_read_state').upsert({ conversation_id: conversationId, user_id: currentUserId, last_read_at: new Date().toISOString() })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, load, supabase, currentUserId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!newMsg.trim() || sending) return
    setSending(true)
    const content = newMsg.trim(); setNewMsg('')
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: currentUserId, content, event_id: eventId, message_type: 'text' })
      .select('id, conversation_id, sender_id, content, created_at, message_type, metadata').single()
    if (inserted) setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, { ...inserted, message_type: 'text', metadata: {}, sender: null }])
    setSending(false)
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (e.target) e.target.value = ''
    if (!file) return
    const up = await fileUpload.upload(file, eventId, 'chats', 'chat')
    if (!up) return
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: currentUserId, event_id: eventId, content: file.name, message_type: 'file', metadata: { file_id: up.fileId, name: file.name, mime: file.type, size: file.size } })
      .select('id, conversation_id, sender_id, content, created_at, message_type, metadata').single()
    if (inserted) setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, { ...inserted, message_type: 'file', metadata: inserted.metadata ?? {}, sender: null }])
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--surface, #fff)' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#FAFAFA', minHeight: 0 }}>
        {loading ? <div style={{ margin: 'auto', color: 'var(--text-tertiary, #999)' }}><Loader2 size={18} className="cc-spin" /></div>
          : messages.length === 0 ? <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary, #999)', fontSize: 13 }}>Noch keine Nachrichten. Schreibt dem Dienstleister.</div>
          : messages.map(msg => {
            const isMe = msg.sender_id === currentUserId
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                {!isMe && <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#636366', flexShrink: 0 }}>{initials(msg.sender?.name ?? '?')}</div>}
                <div style={{ maxWidth: '78%' }}>
                  <Bubble msg={msg} isMe={isMe} onDownload={downloadFile} onViewShare={viewShare} />
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary, #999)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>{fmtTime(msg.created_at)}</div>
                </div>
              </div>
            )
          })}
        <div ref={endRef} />
      </div>

      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border, #eee)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <input ref={fileRef} type="file" onChange={handleFile} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} disabled={fileUpload.uploading} aria-label="Datei anhängen" style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0F0F2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#636366', flexShrink: 0 }}>
          {fileUpload.uploading ? <Loader2 size={15} className="cc-spin" /> : <Paperclip size={15} />}
        </button>
        <input value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} placeholder={fileUpload.uploading ? 'Datei wird hochgeladen…' : 'Nachricht schreiben…'} style={{ flex: 1, minWidth: 0, padding: '9px 14px', border: 'none', borderRadius: 20, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#F0F0F2' }} />
        <button onClick={send} disabled={!newMsg.trim() || sending} aria-label="Senden" style={{ width: 38, height: 38, borderRadius: '50%', background: newMsg.trim() ? 'var(--bp-gold, #B89968)' : '#E5E5EA', border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: newMsg.trim() ? '#fff' : '#8E8E93', flexShrink: 0 }}><Send size={15} /></button>
      </div>

      {openShare && (
        <div onClick={() => setOpenShare(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface, #fff)', borderRadius: 16, width: 600, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #eee)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={17} style={{ color: 'var(--bp-gold, #B89968)' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, flex: 1 }}>{openShare.label}</h3>
              <button onClick={() => setOpenShare(null)} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto' }}>
              {openShare.loading ? <div style={{ textAlign: 'center', padding: 30 }}><Loader2 size={20} className="cc-spin" /></div>
                : openShare.snapshot ? <ShareBox snapshot={openShare.snapshot} />
                : <p style={{ fontSize: 13, color: '#888' }}>Diese Freigabe ist nicht mehr verfügbar.</p>}
            </div>
          </div>
        </div>
      )}
      <style>{`.cc-spin { animation: ccspin 1s linear infinite; } @keyframes ccspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Bubble({ msg, isMe, onDownload, onViewShare }: { msg: Message; isMe: boolean; onDownload: (id: string) => void; onViewShare: (id: string, label: string) => void }) {
  const accent = 'var(--bp-gold, #B89968)'
  const base: React.CSSProperties = { padding: '9px 13px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px', fontSize: 14, lineHeight: 1.5 }
  if (msg.message_type === 'file') {
    const fid = msg.metadata.file_id as string
    return (
      <button onClick={() => fid && onDownload(fid)} style={{ ...base, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isMe ? accent : '#E5E5EA', color: isMe ? '#fff' : '#1d1d1f', border: 'none', fontFamily: 'inherit', textAlign: 'left', maxWidth: 260 }}>
        <FileText size={17} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{(msg.metadata.name as string) ?? msg.content}</span>
        <Download size={14} style={{ flexShrink: 0, opacity: 0.85 }} />
      </button>
    )
  }
  if (msg.message_type === 'data_share') {
    const sid = msg.metadata.share_id as string
    const mod = msg.metadata.module as ShareModule
    const mode = msg.metadata.mode as string
    return (
      <button onClick={() => sid && onViewShare(sid, SHARE_MODULE_LABELS[mod] ?? 'Daten')} style={{ ...base, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--surface, #fff)', border: `1px solid ${accent}`, color: '#1d1d1f', fontFamily: 'inherit', textAlign: 'left', maxWidth: 280 }}>
        <Database size={17} style={{ flexShrink: 0, color: accent }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{SHARE_MODULE_LABELS[mod] ?? 'Daten'}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{mode === 'live' ? 'Live · tippen' : 'Auszug · tippen'}</div>
        </div>
      </button>
    )
  }
  return <div style={{ ...base, background: isMe ? accent : '#E5E5EA', color: isMe ? '#fff' : '#1d1d1f' }}>{msg.content}</div>
}
