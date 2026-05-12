'use client'
import React, { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, X, CornerDownRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DekoComment, DekoCommentReply } from '@/lib/deko/types'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  eventId: string
  targetType: 'item' | 'canvas' | 'area'
  targetId: string
  userId: string
  userName: string
  canvasZoom?: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DekoCommentOverlay({ eventId, targetType, targetId, userId, userName, canvasZoom = 1 }: Props) {
  const supabase = createClient()
  const [comments, setComments] = useState<(DekoComment & { replies: DekoCommentReply[] })[]>([])
  const [hovering, setHovering] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Load comments on hover
  useEffect(() => {
    if (!hovering && !open) return
    const supabase = createClient()
    supabase.from('deko_comments')
      .select('*, author:author_id(display_name)')
      .eq('target_id', targetId)
      .eq('target_type', targetType)
      .order('created_at')
      .then(async ({ data: comms }) => {
        if (!comms) return
        const enriched = await Promise.all(comms.map(async c => {
          const { data: replies } = await supabase.from('deko_comment_replies')
            .select('*, author:author_id(display_name)')
            .eq('comment_id', c.id)
            .order('created_at')
          return {
            ...c,
            author_name: (c.author as { display_name?: string } | null)?.display_name ?? 'Unbekannt',
            replies: (replies ?? []).map(r => ({
              ...r,
              author_name: (r.author as { display_name?: string } | null)?.display_name ?? 'Unbekannt',
            })) as DekoCommentReply[],
          }
        }))
        setComments(enriched)
      })
  }, [hovering, open, targetId, targetType])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`comments-${targetId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deko_comments', filter: `target_id=eq.${targetId}` }, () => {
        // re-fetch
        setHovering(h => { if (h || open) return h; return h })
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [targetId, open, supabase])

  async function postComment() {
    if (!draft.trim()) return
    setLoading(true)
    const { data } = await supabase.from('deko_comments').insert({
      event_id: eventId, target_type: targetType, target_id: targetId,
      content: draft.trim(), author_id: userId,
    }).select().single()
    if (data) {
      setComments(prev => [...prev, { ...data as DekoComment, author_name: userName, replies: [] }])
      setDraft('')
    }
    setLoading(false)
  }

  async function postReply(commentId: string) {
    if (!replyDraft.trim()) return
    const { data } = await supabase.from('deko_comment_replies').insert({
      comment_id: commentId, content: replyDraft.trim(), author_id: userId,
    }).select().single()
    if (data) {
      setComments(prev => prev.map(c => c.id === commentId ? {
        ...c, replies: [...c.replies, { ...data as DekoCommentReply, author_name: userName }],
      } : c))
      setReplyTo(null)
      setReplyDraft('')
    }
  }

  async function deleteComment(id: string) {
    await supabase.from('deko_comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  const count = comments.length
  const scaleInverse = 1 / (canvasZoom || 1)

  // Decide side: always position panel to the right inside canvas bounds
  // (parent item controls this via wrapper positioning)

  return (
    <div
      style={{ position: 'absolute', top: 4, right: 4, zIndex: 20, transform: `scale(${scaleInverse})`, transformOrigin: 'top right' }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { if (!open) setHovering(false) }}
      onClick={e => e.stopPropagation()}
    >
      {/* Badge */}
      {(count > 0 || hovering) && !open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px',
            background: count > 0 ? '#fff' : 'rgba(255,255,255,0.9)',
            border: '1px solid var(--border)', borderRadius: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,.1)',
            cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--text)',
          }}>
          <MessageCircle size={11} color={count > 0 ? '#C9B99A' : 'var(--text-tertiary)'} />
          {count > 0 ? count : <span style={{ color: 'var(--text-tertiary)' }}>Kommentar</span>}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute', right: 0, top: 0,
            width: 280, maxHeight: 360,
            background: '#fff', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>Kommentare</span>
            <button onClick={() => { setOpen(false); setHovering(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={13} /></button>
          </div>

          {/* comments list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {comments.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 12px', textAlign: 'center' }}>Noch kein Kommentar.</p>
            )}
            {comments.map(c => (
              <div key={c.id} style={{ padding: '6px 12px', borderBottom: '1px solid #f0ece8' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#C9B99A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {c.author_name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 1 }}>{c.author_name}</p>
                    <p style={{ fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word' }}>{c.content}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                        style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                        Antworten
                      </button>
                      {c.author_id === userId && (
                        <button onClick={() => deleteComment(c.id)}
                          style={{ fontSize: 10, color: '#E06C75', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Löschen</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {c.replies.map(r => (
                  <div key={r.id} style={{ display: 'flex', gap: 6, paddingLeft: 28, marginTop: 4 }}>
                    <CornerDownRight size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>{r.author_name}</p>
                      <p style={{ fontSize: 12, lineHeight: 1.4, wordBreak: 'break-word' }}>{r.content}</p>
                    </div>
                  </div>
                ))}

                {/* Reply input */}
                {replyTo === c.id && (
                  <div style={{ display: 'flex', gap: 4, paddingLeft: 28, marginTop: 6 }}>
                    <input autoFocus value={replyDraft} onChange={e => setReplyDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && postReply(c.id)}
                      placeholder="Antwort…" style={{ flex: 1, fontSize: 12, padding: '4px 7px', border: '1px solid var(--border)', borderRadius: 6, outline: 'none', fontFamily: 'inherit' }} />
                    <button onClick={() => postReply(c.id)}
                      style={{ padding: '4px 8px', background: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                      <Send size={11} color="#fff" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* New comment input */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 10px', display: 'flex', gap: 6 }}>
            <input value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && postComment()}
              placeholder="Kommentar schreiben…"
              style={{ flex: 1, fontSize: 12, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={postComment} disabled={loading || !draft.trim()}
              style={{ padding: '6px 10px', background: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: !draft.trim() ? 0.5 : 1 }}>
              <Send size={12} color="#fff" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
