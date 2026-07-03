'use client'

// Vendor-Medien auf der Anbieter-Detailseite (Migration 0133):
// bis zu 3 YouTube-Videos in einem swipebaren Player + eine Hörprobe
// mit eigenem, elegantem Audio-Player (presigned R2-URL).

import React, { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, Pause, Music2 } from 'lucide-react'
import { youtubeVideoId, youtubeEmbedUrl } from '@/lib/marketplace/types'

// ── Swipebarer YouTube-Player ────────────────────────────────────
export function VideoCarousel({ urls }: { urls: string[] }) {
  const ids = urls.map(youtubeVideoId).filter((id): id is string => !!id)
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  function goTo(i: number) {
    const track = trackRef.current
    if (!track) return
    const clamped = Math.max(0, Math.min(ids.length - 1, i))
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' })
  }

  function onScroll() {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    setIndex(Math.round(track.scrollLeft / track.clientWidth))
  }

  if (ids.length === 0) return null

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          borderRadius: 18, border: '1px solid var(--bp-rule)', background: '#000',
          scrollbarWidth: 'none',
        }}
      >
        {ids.map((id, i) => (
          <div key={id} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', aspectRatio: '16/9' }}>
            <iframe
              title={`Video ${i + 1}`}
              src={youtubeEmbedUrl(id)}
              style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {ids.length > 1 && (
        <>
          {index > 0 && (
            <button onClick={() => goTo(index - 1)} aria-label="Vorheriges Video" style={{ ...navBtn, left: 10 }}>
              <ChevronLeft size={18} />
            </button>
          )}
          {index < ids.length - 1 && (
            <button onClick={() => goTo(index + 1)} aria-label="Nächstes Video" style={{ ...navBtn, right: 10 }}>
              <ChevronRight size={18} />
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
            {ids.map((id, i) => (
              <button
                key={id}
                onClick={() => goTo(i)}
                aria-label={`Video ${i + 1} anzeigen`}
                style={{
                  width: i === index ? 22 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0,
                  cursor: 'pointer', transition: 'all 0.25s',
                  background: i === index ? 'var(--bp-gold)' : 'var(--bp-rule)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  position: 'absolute', top: 'calc(50% - 18px)', transform: 'translateY(-50%)',
  width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.92)', color: 'var(--bp-ink)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 2px 10px rgba(0,0,0,0.25)', zIndex: 2,
}

// ── Hörprobe: eleganter Audio-Player ─────────────────────────────
function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function AudioSamplePlayer({ url, title, vendorName }: { url: string; title: string | null; vendorName: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setCurrent(a.currentTime)
    const onMeta = () => setDuration(a.duration)
    const onEnd = () => { setPlaying(false); setCurrent(0) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('ended', onEnd)
    }
  }, [])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play().then(() => setPlaying(true)).catch(() => {}) }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current
    const bar = barRef.current
    if (!a || !bar || !duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * duration
    setCurrent(a.currentTime)
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div
      className="bp-card"
      style={{
        padding: 18, display: 'flex', alignItems: 'center', gap: 16,
        background: 'linear-gradient(135deg, var(--bp-gold-pale), var(--bp-ivory-2))',
      }}
    >
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Abspielen'}
        style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
          background: 'var(--bp-gold-deep)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}
      >
        {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 3 }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Music2 size={13} style={{ color: 'var(--bp-gold-deep)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--bp-gold-deep)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Hörprobe
          </span>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--bp-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title || vendorName || 'Hörprobe'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--bp-ink-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(current)}</span>
          <div
            ref={barRef}
            onClick={seek}
            role="slider"
            aria-label="Wiedergabeposition"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(current)}
            style={{ flex: 1, height: 14, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <div style={{ position: 'relative', width: '100%', height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.12)' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${progress}%`, borderRadius: 999, background: 'var(--bp-gold-deep)', transition: 'width 0.15s linear' }} />
            </div>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--bp-ink-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  )
}
