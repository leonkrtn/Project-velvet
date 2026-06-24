'use client'
// components/wedding/WeddingRenderer.tsx
// Präsentationsschicht der öffentlichen Hochzeitswebsite. Wird sowohl von den
// öffentlichen Seiten (/wedding/[slug]/*) als auch von der Editor-Live-Vorschau
// verwendet. Erhält ausschließlich serialisierbare Props (keine Funktionen!).
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Heart, Sparkles, MapPin, Plane, Home, Gem, GlassWater, Music, Camera,
  Star, Sun, Coffee, Bike, Clock, ChevronDown, type LucideIcon,
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
  return <Cmp size={size} strokeWidth={1.5} />
}

/** Namen mit kunstvollem Ampersand rendern ("Anna & Max"). */
function Headline({ text }: { text: string }) {
  const parts = text.split(/\s*&\s*|\s+und\s+/i)
  if (parts.length === 2 && parts[0] && parts[1]) {
    return (
      <>
        <span className="wd-name">{parts[0]}</span>
        <span className="wd-amp">&amp;</span>
        <span className="wd-name">{parts[1]}</span>
      </>
    )
  }
  return <>{text}</>
}

function initialsOf(name: string): string {
  const parts = name.split(/\s*&\s*|\s+und\s+/i).map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] ?? ''} & ${parts[1][0] ?? ''}`.toUpperCase()
  return (name.trim()[0] ?? '').toUpperCase()
}

/** Dezenter Ornament-Trenner (Linie · Diamant · Linie). */
function Ornament() {
  return (
    <span className="wd-ornament" aria-hidden>
      <span className="wd-ornament-line" />
      <span className="wd-ornament-mark" />
      <span className="wd-ornament-line" />
    </span>
  )
}

function SectionHead({ eyebrow, title, align = 'center' }: { eyebrow?: string; title: string; align?: 'center' | 'left' }) {
  return (
    <div className={`wd-shead wd-shead-${align}`} data-reveal>
      {eyebrow && <span className="wd-eyebrow">{eyebrow}</span>}
      <h2 className="wd-h2">{title}</h2>
      <Ornament />
    </div>
  )
}

// Scroll-Reveal (rein additiv & ausfallsicher: Inhalt bleibt NIE dauerhaft versteckt).
function useReveal() {
  useEffect(() => {
    const root = document.querySelector('.wd-root') as HTMLElement | null
    if (!root) return
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!els.length) return
    const reveal = (el: Element) => el.classList.add('is-visible')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(reveal); return }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target) } })
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' })

    // Nur Elemente UNTERHALB des Sichtbereichs werden kurz versteckt + animiert.
    // Alles, was beim Laden schon sichtbar ist, bleibt sofort sichtbar
    // (kein globales Verstecken -> kein Reflow, der das anfängliche Scrollen blockiert).
    requestAnimationFrame(() => {
      const vh = window.innerHeight || 800
      els.forEach(el => {
        const top = el.getBoundingClientRect().top
        if (top >= vh * 0.9) { el.classList.add('wd-reveal-init'); io.observe(el) }
      })
    })

    // Sicherheitsnetz: nach 1,8s garantiert alles zeigen.
    const safety = setTimeout(() => els.forEach(reveal), 1800)
    return () => { io.disconnect(); clearTimeout(safety) }
  }, [])
}

// ── Navigation ────────────────────────────────────────────────────────────────
export function WeddingNav({
  coupleName, basePath, preview = false, active,
}: { coupleName: string; basePath: string; preview?: boolean; active?: WeddingSection }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname() ?? ''
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
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
    <header className={`wd-nav${scrolled ? ' scrolled' : ''}`}>
      <Link href={href('landing')} className="wd-nav-brand" onClick={() => setOpen(false)}>
        <span className="wd-nav-monogram">{initialsOf(coupleName)}</span>
        <span className="wd-nav-brand-name">{coupleName || 'Unsere Hochzeit'}</span>
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
    <footer className="wd-footer" data-reveal>
      <div className="wd-footer-monogram">{initialsOf(coupleName)}</div>
      <div className="wd-footer-names">{coupleName}</div>
      {date && <div className="wd-footer-date">{formatLongDate(date)}</div>}
      <Ornament />
      <p className="wd-footer-note">Wir freuen uns darauf, diesen Tag mit euch zu feiern.</p>
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
  const cells = [
    [days, 'Tage'], [hours, 'Stunden'], [mins, 'Minuten'], [secs, 'Sekunden'],
  ] as const
  return (
    <div className="wd-countdown" aria-label="Countdown bis zur Hochzeit">
      {cells.map(([v, l], i) => (
        <React.Fragment key={l}>
          {i > 0 && <span className="wd-cd-sep" aria-hidden />}
          <div className="wd-cd-cell">
            <span className="wd-cd-num">{String(v).padStart(2, '0')}</span>
            <span className="wd-cd-label">{l}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Landing ─────────────────────────────────────────────────────────────────────
export function LandingView({ content, event, imageUrls }: RenderProps) {
  useReveal()
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
          ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroUrl} alt={hero.image?.alt ?? ''} className="wd-hero-img" style={{ objectPosition: focus(hero.image) }} />
          )
          : <div className="wd-hero-img wd-img-placeholder" aria-hidden />}
        <div className="wd-hero-scrim" aria-hidden />
        <div className="wd-hero-inner">
          <span className="wd-hero-eyebrow">Wir heiraten</span>
          <h1 className="wd-hero-title"><Headline text={hero.headline || event.coupleName} /></h1>
          <span className="wd-hero-rule" aria-hidden />
          {event.date && (
            <div className="wd-hero-meta">
              {formatLongDate(event.date)}{event.venue ? ` · ${event.venue}` : ''}
            </div>
          )}
          {hero.subline && <p className="wd-hero-subline">{hero.subline}</p>}
          <Countdown date={event.date} />
        </div>
        <span className="wd-scrollcue" aria-hidden><ChevronDown size={22} /></span>
      </section>

      {/* LOCATION */}
      {(loc.description || event.venue || locUrl) && (
        <section className="wd-section wd-location">
          <div className="wd-location-grid">
            <div className="wd-location-media" data-reveal>
              {locUrl
                ? <div className="wd-framed">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={locUrl} alt={loc.image?.alt ?? loc.title} style={{ objectPosition: focus(loc.image) }} /></div>
                : <div className="wd-framed"><div className="wd-img-placeholder wd-location-ph" aria-hidden /></div>}
            </div>
            <div className="wd-location-text" data-reveal>
              <span className="wd-eyebrow">Feiert mit uns</span>
              <h2 className="wd-h2">{loc.title}</h2>
              <Ornament />
              {event.venue && <p className="wd-location-venue">{event.venue}</p>}
              {event.venueAddress && <p className="wd-location-addr">{event.venueAddress}</p>}
              {loc.description && <p className="wd-body">{loc.description}</p>}
              {mapsHref && (
                <a className="wd-btn" href={mapsHref} target="_blank" rel="noreferrer">
                  <MapPin size={15} /> Anfahrt &amp; Karte
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAGESABLAUF */}
      {schedule.items.length > 0 && (
        <section className="wd-section wd-schedule">
          <SectionHead eyebrow="Der große Tag" title={schedule.title} />
          <div className="wd-timeline" data-reveal>
            {schedule.items.map(it => (
              <div key={it.id} className="wd-tl-item">
                <div className="wd-tl-time">{it.time}</div>
                <div className="wd-tl-axis"><span className="wd-tl-dot" aria-hidden /></div>
                <div className="wd-tl-main">
                  <div className="wd-tl-label">{it.label}</div>
                  {it.description && <div className="wd-tl-desc">{it.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Story / Roter Faden ─────────────────────────────────────────────────────────
export interface StorySettings { align: string; line: string; marker: string }

export function StoryView({ content, imageUrls, story }: Omit<RenderProps, 'template' | 'event'> & { story: StorySettings }) {
  useReveal()
  const { intro, stations } = content.story
  return (
    <div className="wd-page">
      <section className="wd-section wd-story-intro">
        <div className="wd-shead wd-shead-center" data-reveal>
          <span className="wd-eyebrow">Wie alles begann</span>
          <h1 className="wd-h1">{intro.title}</h1>
          <Ornament />
        </div>
        {intro.text && <p className="wd-body wd-center wd-story-introtext" data-reveal>{intro.text}</p>}
      </section>
      <section className="wd-section wd-story" data-align={story.align} data-line={story.line} data-marker={story.marker} data-count={stations.length}>
        <div className="wd-thread" aria-hidden />
        <ol className="wd-stations">
          {stations.map((s, i) => {
            const url = imgUrl(imageUrls, s.image)
            const marker = story.marker === 'number'
              ? <span className="wd-marker-num">{i + 1}</span>
              : story.marker === 'dot' ? null
                : <StationIcon name={s.icon} size={17} />
            return (
              <li key={s.id} className="wd-station" data-index={i} data-side={i % 2 === 0 ? 'a' : 'b'} data-reveal>
                <div className="wd-station-marker">{marker}</div>
                <div className="wd-station-card">
                  {url && (
                    <div className="wd-station-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={s.image?.alt ?? s.title} style={{ objectPosition: focus(s.image) }} />
                    </div>
                  )}
                  <div className="wd-station-body">
                    {s.date && <div className="wd-station-date">{s.date}</div>}
                    {s.title && <h3 className="wd-station-title">{s.title}</h3>}
                    {s.location && <div className="wd-station-loc"><MapPin size={12} /> {s.location}</div>}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={rsvp.image?.alt ?? ''} style={{ objectPosition: focus(rsvp.image) }} />
          <div className="wd-hero-scrim" aria-hidden />
        </div>
      )}
      <div className="wd-shead wd-shead-center">
        <span className="wd-eyebrow">Sagt uns Bescheid</span>
        <h1 className="wd-h1">{rsvp.title}</h1>
        <Ornament />
      </div>
      {rsvp.text && <p className="wd-body wd-center" style={{ maxWidth: 560, margin: '0 auto' }}>{rsvp.text}</p>}
    </section>
  )
}

export { formatLongDate, StationIcon }
