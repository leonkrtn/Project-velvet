'use client'
// components/wedding/WeddingRenderer.tsx
// Präsentationsschicht der öffentlichen Hochzeitswebsite. Wird sowohl von den
// öffentlichen Seiten (/wedding/[slug]/*) als auch von der Editor-Live-Vorschau
// verwendet. Erhält ausschließlich serialisierbare Props.
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Heart, Sparkles, MapPin, Plane, Home, Gem, GlassWater, Music, Camera,
  Star, Sun, Coffee, Bike, Clock, type LucideIcon,
} from 'lucide-react'
import type { WeddingContent, WeddingEventData, WeddingImage } from '@/lib/wedding/types'
import type { WeddingTemplate } from '@/lib/wedding/templates'

const ICONS: Record<string, LucideIcon> = {
  Heart, Sparkles, MapPin, Plane, Home, Gem, Ring: Gem,
  GlassWater, Music, Camera, Star, Sun, Coffee, Bike,
}

export type WeddingSection = 'landing' | 'story' | 'rsvp'

export interface RenderProps {
  content: WeddingContent
  event: WeddingEventData
  template: WeddingTemplate
  imageUrls: Record<string, string>
}

function imgUrl(urls: Record<string, string>, img: WeddingImage | null): string | null {
  return img?.r2Key ? (urls[img.r2Key] ?? null) : null
}
function focus(img: WeddingImage | null): string {
  return `${img?.focusX ?? 50}% ${img?.focusY ?? 50}%`
}

function StationIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Cmp = ICONS[name] ?? Heart
  return <Cmp size={size} strokeWidth={1.6} />
}

// ── Navigation ────────────────────────────────────────────────────────────────
// Nur serialisierbare Props (basePath/preview/active) — KEINE Funktionen, da diese
// Komponente von Server-Komponenten gerendert wird (RSC erlaubt keine Funktions-Props).
export function WeddingNav({
  coupleName, basePath, preview = false, active,
}: { coupleName: string; basePath: string; preview?: boolean; active?: WeddingSection }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() ?? ''
  const derived: WeddingSection =
    pathname.endsWith('/geschichte') ? 'story'
      : pathname.endsWith('/rsvp') ? 'rsvp'
        : 'landing'
  const current = active ?? derived
  const href = (key: WeddingSection): string => {
    if (preview) return `?section=${key}`
    if (key === 'landing') return basePath || '/'
    return `${basePath}/${key === 'story' ? 'geschichte' : 'rsvp'}`
  }
  const items: { key: WeddingSection; label: string }[] = [
    { key: 'landing', label: 'Start' },
    { key: 'story', label: 'Unsere Geschichte' },
    { key: 'rsvp', label: 'RSVP' },
  ]
  return (
    <header className="wd-nav">
      <Link href={href('landing')} className="wd-nav-brand" onClick={() => setOpen(false)}>
        {coupleName || 'Unsere Hochzeit'}
      </Link>
      <button
        className="wd-nav-burger"
        aria-label="Menü"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span /><span /><span />
      </button>
      <nav className={`wd-nav-links${open ? ' open' : ''}`}>
        {items.map(it => (
          <Link
            key={it.key}
            href={href(it.key)}
            className={`wd-nav-link${current === it.key ? ' active' : ''}`}
            onClick={() => setOpen(false)}
          >
            {it.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

export function WeddingFooter({ coupleName, date }: { coupleName: string; date: string | null }) {
  return (
    <footer className="wd-footer">
      <Heart size={18} className="wd-footer-heart" strokeWidth={1.4} />
      <div className="wd-footer-names">{coupleName}</div>
      {date && <div className="wd-footer-date">{formatLongDate(date)}</div>}
    </footer>
  )
}

// ── Datum / Countdown ───────────────────────────────────────────────────────────
function formatLongDate(date: string | null): string {
  if (!date) return ''
  const d = new Date(date + (date.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Countdown({ date }: { date: string | null }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!date) return null
  const target = new Date(date + (date.length === 10 ? 'T12:00:00' : '')).getTime()
  if (isNaN(target) || now === null) return null
  const diff = Math.max(0, target - now)
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  const cell = (v: number, l: string) => (
    <div className="wd-cd-cell"><span className="wd-cd-num">{String(v).padStart(2, '0')}</span><span className="wd-cd-label">{l}</span></div>
  )
  return (
    <div className="wd-countdown" aria-label="Countdown bis zur Hochzeit">
      {cell(days, 'Tage')}{cell(hours, 'Std')}{cell(mins, 'Min')}{cell(secs, 'Sek')}
    </div>
  )
}

// ── Landing ─────────────────────────────────────────────────────────────────────
export function LandingView({ content, event, imageUrls }: RenderProps) {
  const hero = content.landing.hero
  const heroUrl = imgUrl(imageUrls, hero.image)
  const loc = content.landing.location
  const locUrl = imgUrl(imageUrls, loc.image)
  const schedule = content.landing.schedule
  const mapsHref = event.venueAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress)}`
    : null

  return (
    <div className="wd-page">
      {/* HERO */}
      <section className="wd-hero">
        {heroUrl
          ? <img src={heroUrl} alt={hero.image?.alt ?? ''} className="wd-hero-img" style={{ objectPosition: focus(hero.image) }} />
          : <div className="wd-hero-img wd-img-placeholder" aria-hidden />}
        <div className="wd-hero-scrim" aria-hidden />
        <div className="wd-hero-inner">
          <div className="wd-hero-eyebrow">{formatLongDate(event.date)}</div>
          <h1 className="wd-hero-title">{hero.headline || event.coupleName}</h1>
          {hero.subline && <p className="wd-hero-subline">{hero.subline}</p>}
          <Countdown date={event.date} />
        </div>
      </section>

      {/* LOCATION */}
      {(loc.description || event.venue || locUrl) && (
        <section className="wd-section wd-location">
          <div className="wd-location-grid">
            <div className="wd-location-text">
              <h2 className="wd-h2">{loc.title}</h2>
              {event.venue && <p className="wd-location-venue">{event.venue}</p>}
              {event.venueAddress && <p className="wd-location-addr">{event.venueAddress}</p>}
              {loc.description && <p className="wd-body">{loc.description}</p>}
              {mapsHref && (
                <a className="wd-btn" href={mapsHref} target="_blank" rel="noreferrer">
                  <MapPin size={16} /> Anfahrt & Karte
                </a>
              )}
            </div>
            <div className="wd-location-media">
              {locUrl
                ? <img src={locUrl} alt={loc.image?.alt ?? loc.title} style={{ objectPosition: focus(loc.image) }} />
                : <div className="wd-img-placeholder wd-location-ph" aria-hidden />}
            </div>
          </div>
        </section>
      )}

      {/* TAGESABLAUF */}
      {schedule.items.length > 0 && (
        <section className="wd-section wd-schedule">
          <h2 className="wd-h2 wd-center">{schedule.title}</h2>
          <div className="wd-schedule-list">
            {schedule.items.map(it => (
              <div key={it.id} className="wd-schedule-item">
                <div className="wd-schedule-time"><Clock size={14} /> {it.time}</div>
                <div className="wd-schedule-dot" aria-hidden />
                <div className="wd-schedule-label">{it.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Story / Roter Faden ─────────────────────────────────────────────────────────
export function StoryView({ content, template, imageUrls }: RenderProps) {
  const { intro, stations } = content.story
  const layout = template.storyLayout
  return (
    <div className="wd-page">
      <section className="wd-section wd-story-intro">
        <h1 className="wd-h1 wd-center">{intro.title}</h1>
        {intro.text && <p className="wd-body wd-center wd-story-introtext">{intro.text}</p>}
      </section>
      <section className={`wd-section wd-story wd-story-${layout}`} data-count={stations.length}>
        <div className="wd-thread" aria-hidden />
        <ol className="wd-stations">
          {stations.map((s, i) => {
            const url = imgUrl(imageUrls, s.image)
            return (
              <li key={s.id} className="wd-station" data-index={i} data-side={i % 2 === 0 ? 'a' : 'b'}>
                <div className="wd-station-marker"><StationIcon name={s.icon} size={18} /></div>
                <div className="wd-station-card">
                  {url && (
                    <div className="wd-station-media">
                      <img src={url} alt={s.image?.alt ?? s.title} style={{ objectPosition: focus(s.image) }} />
                    </div>
                  )}
                  <div className="wd-station-body">
                    {s.date && <div className="wd-station-date">{s.date}</div>}
                    {s.title && <h3 className="wd-station-title">{s.title}</h3>}
                    {s.location && <div className="wd-station-loc"><MapPin size={13} /> {s.location}</div>}
                    {s.text && <p className="wd-station-text">{s.text}</p>}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

// ── RSVP-Kopfbereich (über dem Formular) ────────────────────────────────────────
export function RsvpIntroView({ content, imageUrls }: Pick<RenderProps, 'content' | 'imageUrls'>) {
  const rsvp = content.rsvp
  const url = imgUrl(imageUrls, rsvp.image)
  return (
    <section className="wd-section wd-rsvp-intro">
      {url && (
        <div className="wd-rsvp-hero">
          <img src={url} alt={rsvp.image?.alt ?? ''} style={{ objectPosition: focus(rsvp.image) }} />
          <div className="wd-hero-scrim" aria-hidden />
        </div>
      )}
      <h1 className="wd-h1 wd-center">{rsvp.title}</h1>
      {rsvp.text && <p className="wd-body wd-center" style={{ maxWidth: 560, margin: '0 auto' }}>{rsvp.text}</p>}
    </section>
  )
}

export { formatLongDate, StationIcon }
