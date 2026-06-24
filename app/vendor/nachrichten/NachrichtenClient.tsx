'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Loader2, ArrowRight, CalendarDays } from 'lucide-react'

interface LastMessage {
  content: string
  created_at: string
  is_own: boolean
  message_type: string
}

interface Conv {
  id: string
  event_id: string
  title: string | null
  event_title: string | null
  event_date: string | null
  event_code: string | null
  last_message: LastMessage | null
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Gestern'
  if (days < 7) return d.toLocaleDateString('de-DE', { weekday: 'short' })
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

function previewText(msg: LastMessage): string {
  if (msg.message_type === 'file') return '📎 Datei'
  if (msg.message_type === 'data_share') return '📊 Geteilte Daten'
  return msg.content ?? ''
}

export default function NachrichtenClient() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/vendor/nachrichten')
    const d = await res.json().catch(() => ({}))
    setConvs(d.conversations ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MessageSquare size={20} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.4px', margin: 0 }}>Nachrichten</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 2 }}>Alle Gespräche aus deinen Events.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 14, padding: '30px 0' }}>
            <Loader2 size={16} className="nm-spin" /> Lädt…
          </div>
        ) : convs.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.4 }}><MessageSquare size={30} /></div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Noch keine Nachrichten</p>
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
              Sobald ein Veranstalter oder Brautpaar eine Unterhaltung startet, erscheint sie hier.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {convs.map(conv => (
              <div key={conv.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                {/* Event header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <Link href={`/vendor/dashboard/${conv.event_id}/kommunikation`} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{conv.event_title ?? 'Event'}</span>
                      {conv.event_code && (
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', background: 'rgba(0,0,0,0.05)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                          #{conv.event_code}
                        </span>
                      )}
                    </div>
                    {conv.event_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                        <CalendarDays size={11} />
                        {new Date(conv.event_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    )}
                  </Link>
                  <Link href={`/vendor/dashboard/${conv.event_id}/kommunikation`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>
                    Öffnen <ArrowRight size={14} />
                  </Link>
                </div>

                {/* Last message preview */}
                <div style={{ padding: '12px 16px' }}>
                  {conv.last_message ? (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                          {conv.last_message.is_own && <span style={{ color: 'var(--text-dim)', marginRight: 4 }}>Du:</span>}
                          {previewText(conv.last_message)}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0, marginTop: 1 }}>
                        {timeLabel(conv.last_message.created_at)}
                      </span>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>Noch keine Nachrichten.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`.nm-spin{animation:nmspin 1s linear infinite}@keyframes nmspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
