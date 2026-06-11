'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import './landing.css'

const SIGNUP_URL = '/signup/brautpaar'

function Check() {
  return (
    <svg className="lp-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 4.5" />
    </svg>
  )
}

function Sparkle() {
  return (
    <svg className="lp-sparkle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c.4 3.6 1.4 4.6 5 5-3.6.4-4.6 1.4-5 5-.4-3.6-1.4-4.6-5-5 3.6-.4 4.6-1.4 5-5z" />
      <path d="M19 13c.2 1.8.7 2.3 2.5 2.5-1.8.2-2.3.7-2.5 2.5-.2-1.8-.7-2.3-2.5-2.5 1.8-.2 2.3-.7 2.5-2.5z" opacity="0.7" />
    </svg>
  )
}

function CheckCircle() {
  return (
    <span className="lp-check-circle" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3.5 8.4l3 3L12.5 5" />
      </svg>
    </span>
  )
}

export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null)
  const heroBgRef = useRef<HTMLDivElement>(null)
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null)

  // Background session check on mount — no latency on click.
  useEffect(() => {
    let cancelled = false
    async function check() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      let isOrganizer = session.user.app_metadata?.is_approved_organizer === true
      if (!isOrganizer) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_approved_organizer')
          .eq('id', session.user.id)
          .single()
        isOrganizer = profile?.is_approved_organizer === true
      }
      if (cancelled) return
      if (isOrganizer) { setDashboardUrl('/veranstalter/events'); return }

      const { data: memberships } = await supabase
        .from('event_members')
        .select('event_id, role')
        .eq('user_id', session.user.id)
      if (cancelled) return
      if (!memberships?.length) { setDashboardUrl('/signup'); return }

      const roles = memberships.map(m => m.role)
      if (roles.includes('brautpaar_solo') || roles.includes('brautpaar')) { setDashboardUrl('/brautpaar'); return }
      const vendor = memberships.find(m => m.role === 'dienstleister')
      if (vendor) { setDashboardUrl(`/vendor/dashboard/${vendor.event_id}/uebersicht`); return }
      if (roles.includes('veranstalter')) { setDashboardUrl('/veranstalter/pending'); return }
      setDashboardUrl('/brautpaar')
    }
    check()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    // Scroll progress
    const progressBar = document.getElementById('lp-scroll-progress')
    function updateProgress() {
      if (!progressBar) return
      const total = document.documentElement.scrollHeight - window.innerHeight
      progressBar.style.width = (total > 0 ? (window.scrollY / total) * 100 : 0) + '%'
    }

    // Nav scroll class
    function handleNavScroll() {
      if (navRef.current) navRef.current.classList.toggle('scrolled', window.scrollY > 60)
    }

    // Parallax hero
    let lastScrollY = window.scrollY
    let rafHeroPending = false
    function updateParallax() {
      if (heroBgRef.current) heroBgRef.current.style.transform = `translateY(${-lastScrollY * 0.15}px)`
      rafHeroPending = false
    }

    // Photo band parallax
    const photoCells = document.querySelectorAll<HTMLElement>('.lp-photo-cell-inner')
    let rafPhotoPending = false
    function updatePhotoParallax() {
      photoCells.forEach((cell, i) => {
        const parent = cell.closest('.lp-photo-cell') as HTMLElement
        if (!parent) return
        const rect = parent.getBoundingClientRect()
        const center = rect.top + rect.height / 2 - window.innerHeight / 2
        const speeds = [0.06, 0.03, 0.06]
        cell.style.transform = `translateY(${center * speeds[i]}px) scale(1.08)`
      })
      rafPhotoPending = false
    }

    function onScroll() {
      updateProgress()
      handleNavScroll()
      lastScrollY = window.scrollY
      if (!rafHeroPending) { rafHeroPending = true; requestAnimationFrame(updateParallax) }
      if (!rafPhotoPending) { rafPhotoPending = true; requestAnimationFrame(updatePhotoParallax) }
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // Scroll reveal
    const reveals = document.querySelectorAll('.lp-reveal')
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    reveals.forEach(el => revealObs.observe(el))

    // Clip reveal
    const clips = document.querySelectorAll('.lp-reveal-clip')
    const clipObs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.2 })
    clips.forEach(el => clipObs.observe(el))

    // Staggered card entrance
    const cards = document.querySelectorAll<HTMLElement>('.lp-feature-card')
    const cardObs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        ;[0,1,2,3,4,5].forEach((i, seq) => {
          setTimeout(() => { if (cards[i]) cards[i].classList.add('card-visible') }, seq * 100)
        })
        cardObs.disconnect()
      }
    }, { threshold: 0.1 })
    if (cards[0]) cardObs.observe(cards[0])

    // Active nav section highlight
    const sectionIds = ['lp-features', 'lp-pricing', 'lp-steps', 'lp-faq']
    const navAnchors: Record<string, Element> = {}
    sectionIds.forEach(id => {
      const a = document.querySelector(`.lp-nav .nav-links a[href="#${id}"]`)
      if (a) navAnchors[id] = a
    })
    const sectionEls = sectionIds.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const sectionObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = (entry.target as HTMLElement).id
        if (navAnchors[id]) navAnchors[id].classList.toggle('active', entry.isIntersecting)
      })
    }, { threshold: 0.3 })
    sectionEls.forEach(el => sectionObs.observe(el))

    return () => {
      window.removeEventListener('scroll', onScroll)
      revealObs.disconnect(); clipObs.disconnect(); cardObs.disconnect()
      sectionObs.disconnect()
    }
  }, [])

  function toggleFaq(item: HTMLElement) {
    const isOpen = item.classList.contains('open')
    document.querySelectorAll('.lp-faq-item.open').forEach(i => {
      i.classList.remove('open')
      i.querySelector('.lp-faq-q')?.setAttribute('aria-expanded', 'false')
    })
    if (!isOpen) {
      item.classList.add('open')
      item.querySelector('.lp-faq-q')?.setAttribute('aria-expanded', 'true')
    }
  }

  const navCtaHref = dashboardUrl ?? SIGNUP_URL
  const navCtaLabel = dashboardUrl ? 'Zum Dashboard' : '3 Tage kostenlos testen'

  return (
    <div className="landing-root">
      {/* SCROLL PROGRESS */}
      <div id="lp-scroll-progress" />

      {/* NAV */}
      <nav ref={navRef} className="lp-nav">
        <a href="#" className="nav-logo">
          <img src="/landing/logo.png" alt="Velvet" />
        </a>
        <ul className="nav-links">
          <li><a href="#lp-features">Funktionen</a></li>
          <li><a href="#lp-pricing">Preise</a></li>
          <li><a href="#lp-steps">So funktioniert&apos;s</a></li>
          <li><a href="#lp-faq">FAQ</a></li>
        </ul>
        <div className="lp-nav-right">
          <a href="/login" className="lp-nav-login">Anmelden</a>
          <a href={navCtaHref} className="lp-nav-cta">{navCtaLabel}</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero" id="lp-hero">
        <div className="lp-hero-photo">
          <div ref={heroBgRef} className="lp-hero-photo-inner" />
        </div>
        <div className="lp-hero-bg" />
        <div className="lp-hero-content">
          <div className="lp-hero-text">
            <p className="lp-hero-eyebrow">Hochzeitsplanung, neu gedacht</p>
            <h1 className="lp-hero-headline">
              Plant eure Hochzeit an einem Ort. <em>Gemeinsam.</em>
            </h1>
            <p className="lp-hero-sub">
              Gästeliste mit RSVP-Links, Sitzplan, Budget, Aufgaben und Zeitplan — in einem eleganten Dashboard für euch beide. Schluss mit Excel-Tabellen und WhatsApp-Chaos.
            </p>
            <div className="lp-hero-actions">
              <a href={SIGNUP_URL} className="lp-btn-primary">3 Tage kostenlos testen</a>
              <a href="#lp-steps" className="lp-btn-ghost">So funktioniert&apos;s</a>
            </div>
            <ul className="lp-hero-trust">
              <li><Check /> Voller Funktionsumfang im Test</li>
              <li><Check /> Keine Zahlungsdaten nötig</li>
              <li><Check /> Monatlich kündbar</li>
            </ul>
          </div>
        </div>
        <div className="lp-scroll-hint">
          <div className="lp-scroll-line" />
          <span>Entdecken</span>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="lp-problem" id="lp-problem">
        <div className="lp-problem-grid">
          <div className="lp-problem-side lp-problem-side-plain lp-reveal">
            <p className="lp-problem-label">Ohne Velvet</p>
            <p className="lp-problem-text">
              Die Gästeliste in Excel, Zusagen per WhatsApp, das Budget im Kopf, der Sitzplan auf Papier — und keiner weiß, welcher Stand aktuell ist.
            </p>
            <ul className="lp-problem-tags">
              <li>Excel-Tabellen</li>
              <li>WhatsApp-Chaos</li>
              <li>Zettelwirtschaft</li>
              <li>Veraltete Stände</li>
            </ul>
          </div>
          <div className="lp-problem-divider" aria-hidden="true" />
          <div className="lp-problem-side lp-problem-side-gold lp-reveal lp-reveal-d2">
            <p className="lp-problem-label">
              <Sparkle />
              Mit Velvet
            </p>
            <p className="lp-problem-text">
              Eure Gäste antworten über einen persönlichen Link — und Gästeliste, Menüwahl, Allergien und Sitzplan aktualisieren sich von selbst. Ihr beide seht immer denselben Stand. Live.
            </p>
            <ul className="lp-problem-tags lp-problem-tags-gold">
              <li>Ein Dashboard</li>
              <li>RSVP automatisch</li>
              <li>Live-Synchronisation</li>
              <li>Immer aktuell</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-features" id="lp-features">
        <div className="lp-features-header">
          <div>
            <p className="lp-section-eyebrow lp-reveal">Euer Dashboard</p>
            <h2 className="lp-section-title">
              <span className="lp-reveal-clip"><span className="lp-reveal-clip-inner">Alles, was ihr <em>wirklich braucht</em></span></span>
            </h2>
          </div>
          <div>
            <p className="lp-section-sub lp-reveal lp-reveal-d2">
              Das Velvet-Brautpaar-Dashboard vereint alle wichtigen Planungstools in einer eleganten Oberfläche — damit ihr euch auf das Wesentliche konzentrieren könnt: einander.
            </p>
          </div>
        </div>
        <div className="lp-features-grid">
          <div className="lp-feature-card">
            <span className="lp-feature-num">01</span>
            <svg className="lp-feature-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="18" cy="16" r="7"/><circle cx="34" cy="16" r="5"/>
              <path d="M2 38c0-8 7-13 16-13s16 5 16 13"/><path d="M34 26c5 0 10 3 10 10"/>
            </svg>
            <h3 className="lp-feature-title">Gästeliste &amp; RSVP</h3>
            <p className="lp-feature-desc">Jeder Gast bekommt einen persönlichen Link — Zusagen, Menüwahl und Allergien tragen sich von selbst ein.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">Zusagen &amp; Absagen in Echtzeit</span>
              <span className="lp-feature-bullet">Begleitpersonen mit Namen &amp; Alter</span>
              <span className="lp-feature-bullet">Allergien &amp; Menüwahl automatisch</span>
            </div>
          </div>
          <div className="lp-feature-card">
            <span className="lp-feature-num">02</span>
            <svg className="lp-feature-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="14" y="20" width="20" height="10" rx="1"/>
              <line x1="17" y1="30" x2="17" y2="38"/><line x1="31" y1="30" x2="31" y2="38"/>
              <rect x="19" y="11" width="10" height="6" rx="1"/>
              <line x1="21" y1="17" x2="21" y2="20"/><line x1="27" y1="17" x2="27" y2="20"/>
              <rect x="19" y="35" width="10" height="6" rx="1"/>
              <line x1="21" y1="35" x2="21" y2="30"/><line x1="27" y1="35" x2="27" y2="30"/>
              <rect x="5" y="21" width="6" height="10" rx="1"/>
              <line x1="11" y1="23" x2="14" y2="23"/><line x1="11" y1="27" x2="14" y2="27"/>
              <rect x="37" y="21" width="6" height="10" rx="1"/>
              <line x1="37" y1="23" x2="34" y2="23"/><line x1="37" y1="27" x2="34" y2="27"/>
            </svg>
            <h3 className="lp-feature-title">Sitzplan &amp; Tischplanung</h3>
            <p className="lp-feature-desc">Tische, Kapazitäten und Belegung in Echtzeit — ihr seht sofort, wer noch keinen Platz hat.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">Tischnamen &amp; Kapazitäten</span>
              <span className="lp-feature-bullet">Live-Belegung nach RSVP</span>
              <span className="lp-feature-bullet">Gäste ohne Platz auf einen Blick</span>
            </div>
          </div>
          <div className="lp-feature-card">
            <span className="lp-feature-num">03</span>
            <svg className="lp-feature-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="6" y="8" width="36" height="36" rx="2"/>
              <path d="M32 4v8M16 4v8"/><line x1="6" y1="20" x2="42" y2="20"/>
              <path d="M14 28h4v4h-4zM22 28h4v4h-4zM30 28h4v4h-4z"/>
            </svg>
            <h3 className="lp-feature-title">Aufgaben &amp; To-Do-Liste</h3>
            <p className="lp-feature-desc">Alle Aufgaben nach Planungsphasen geordnet — von 12+ Monate vorher bis zum Hochzeitstag, gemeinsam abhakbar.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">6 strukturierte Planungsphasen</span>
              <span className="lp-feature-bullet">Fortschrittsbalken pro Phase</span>
              <span className="lp-feature-bullet">Gemeinsam abhaken in Echtzeit</span>
            </div>
          </div>
          <div className="lp-feature-card">
            <span className="lp-feature-num">04</span>
            <svg className="lp-feature-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="6" y="13" width="36" height="24" rx="3"/>
              <path d="M6 21h36"/>
              <path d="M33 13v-3a2 2 0 00-2.4-1.96L9 12"/>
              <circle cx="34" cy="29" r="2.5"/>
            </svg>
            <h3 className="lp-feature-title">Budget im Griff</h3>
            <p className="lp-feature-desc">Geplante und tatsächliche Kosten je Kategorie — ihr seht jederzeit, wo ihr steht.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">Soll/Ist je Kategorie</span>
              <span className="lp-feature-bullet">Gesamtbudget-Übersicht</span>
              <span className="lp-feature-bullet">Keine bösen Überraschungen</span>
            </div>
          </div>
          <div className="lp-feature-card">
            <span className="lp-feature-num">05</span>
            <svg className="lp-feature-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="24" cy="24" r="18"/><path d="M24 12v12l8 4"/>
            </svg>
            <h3 className="lp-feature-title">Zeitstrahl &amp; Regieplan</h3>
            <p className="lp-feature-desc">Euer Hochzeitstag minutengenau geplant — vom Sektempfang bis zum letzten Tanz.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">Minutengenaue Tagesplanung</span>
              <span className="lp-feature-bullet">Kategorien: Zeremonie bis Feier</span>
              <span className="lp-feature-bullet">Ortsangaben für jeden Programmpunkt</span>
            </div>
          </div>
          <div className="lp-feature-card">
            <span className="lp-feature-num">06</span>
            <svg className="lp-feature-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M40 8H8a2 2 0 00-2 2v20a2 2 0 002 2h8l8 8 8-8h8a2 2 0 002-2V10a2 2 0 00-2-2z"/>
              <line x1="16" y1="18" x2="32" y2="18"/><line x1="16" y1="24" x2="26" y2="24"/>
            </svg>
            <h3 className="lp-feature-title">Direktnachrichten</h3>
            <p className="lp-feature-desc">Ein Chat mit allen Beteiligten — nachlesbar, in Echtzeit, ohne WhatsApp-Chaos.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">Echtzeit-Chat mit Verlauf</span>
              <span className="lp-feature-bullet">Mehrere parallele Gespräche</span>
              <span className="lp-feature-bullet">Dauerhafter Nachrichtenverlauf</span>
            </div>
          </div>
        </div>
        <div className="lp-features-cta lp-reveal">
          <a href={SIGNUP_URL} className="lp-text-cta">Alle Funktionen 3 Tage kostenlos ausprobieren &rarr;</a>
        </div>
      </section>

      {/* PHOTO BAND */}
      <div className="lp-photo-band">
        <div className="lp-photo-cell">
          <div className="lp-photo-cell-inner" style={{ background: "url('/landing/photo-vorbereitung.jpg') center center / cover no-repeat" }} />
          <div className="lp-photo-cell-overlay"><span className="lp-photo-cell-caption">Vorbereitung</span></div>
        </div>
        <div className="lp-photo-cell">
          <div className="lp-photo-cell-inner" style={{ background: "url('/landing/photo-zeremonie.jpg') center center / cover no-repeat" }} />
          <div className="lp-photo-cell-overlay"><span className="lp-photo-cell-caption">Zeremonie</span></div>
        </div>
        <div className="lp-photo-cell">
          <div className="lp-photo-cell-inner" style={{ background: "url('/landing/photo-feier.jpg') center center / cover no-repeat" }} />
          <div className="lp-photo-cell-overlay"><span className="lp-photo-cell-caption">Feier</span></div>
        </div>
      </div>

      {/* PRICING */}
      <section className="lp-pricing" id="lp-pricing">
        <div className="lp-pricing-header">
          <p className="lp-section-eyebrow lp-reveal">Ein Preis, kein Kleingedrucktes</p>
          <h2 className="lp-section-title">
            <span className="lp-reveal-clip"><span className="lp-reveal-clip-inner">Erst testen. <em>Dann planen.</em></span></span>
          </h2>
          <p className="lp-section-sub lp-reveal lp-reveal-d2">3 Tage voller Zugriff auf alles — danach entscheidet ihr.</p>
        </div>
        <div className="lp-pricing-grid">
          <div className="lp-price-card lp-reveal">
            <div className="lp-price-head">
              <p className="lp-price-name">Velvet</p>
              <p className="lp-price-tagline">Ihr plant zu zweit</p>
            </div>
            <p className="lp-price-amount"><span className="lp-price-num">25 €</span><span className="lp-price-period">/ Monat</span></p>
            <ul className="lp-price-list">
              <li><CheckCircle /> Gästeliste &amp; RSVP-Links</li>
              <li><CheckCircle /> Sitzplan &amp; Tischplanung</li>
              <li><CheckCircle /> Budget, Aufgaben, Zeitplan</li>
              <li><CheckCircle /> Beide Partner, alle Geräte</li>
            </ul>
            <a href={SIGNUP_URL} className="lp-price-btn lp-price-btn-outline">3 Tage kostenlos testen</a>
          </div>
          <div className="lp-price-card lp-price-card-pro lp-reveal lp-reveal-d2">
            <span className="lp-price-badge"><Sparkle /> Mit Profi-Team</span>
            <div className="lp-price-head">
              <p className="lp-price-name">Velvet Pro</p>
              <p className="lp-price-tagline">Ihr plant mit Profis</p>
            </div>
            <p className="lp-price-amount"><span className="lp-price-num">55 €</span><span className="lp-price-period">/ Monat</span></p>
            <ul className="lp-price-list">
              <li className="lp-price-plus">Alles aus Velvet, plus:</li>
              <li><CheckCircle /> Euer Hochzeitsplaner arbeitet im selben Dashboard mit</li>
              <li><CheckCircle /> Dienstleister einladen — Caterer, DJ, Florist sehen genau das, was sie brauchen</li>
              <li><CheckCircle /> Chat mit eurem ganzen Team</li>
            </ul>
            <a href={SIGNUP_URL} className="lp-price-btn lp-price-btn-fill">3 Tage kostenlos testen</a>
          </div>
        </div>
        <div className="lp-pricing-foot lp-reveal">
          <p className="lp-pricing-note">
            <strong>Erst klein anfangen, später hochschalten?</strong> Klar. Startet mit Velvet für 25 € — und holt euren Veranstalter oder eure Dienstleister jederzeit per Upgrade dazu. Monatlich kündbar, kein Jahresvertrag.
          </p>
          <span className="lp-pricing-rule" aria-hidden="true" />
          <p className="lp-pricing-compare">Zum Vergleich: weniger als ein Brautstrauß — für die Organisation eures gesamten Tages.</p>
        </div>
      </section>

      {/* TRIAL TIMELINE */}
      <section className="lp-trial">
        <div className="lp-trial-grid">
          <div className="lp-trial-line" aria-hidden="true" />
          <div className="lp-trial-step lp-reveal">
            <span className="lp-trial-node"><span className="lp-trial-dot">1</span></span>
            <div className="lp-trial-body">
              <p className="lp-trial-when">Tag 1–3</p>
              <p className="lp-trial-text">Voller Zugriff auf alles. Gäste anlegen, Sitzplan bauen, Partner einladen.</p>
            </div>
          </div>
          <div className="lp-trial-step lp-reveal lp-reveal-d2">
            <span className="lp-trial-node"><span className="lp-trial-dot">2</span></span>
            <div className="lp-trial-body">
              <p className="lp-trial-when">Tag 3</p>
              <p className="lp-trial-text">Ihr entscheidet: weiterplanen ab 25 €/Monat oder einfach nichts tun.</p>
            </div>
          </div>
          <div className="lp-trial-step lp-reveal lp-reveal-d4">
            <span className="lp-trial-node"><span className="lp-trial-dot">3</span></span>
            <div className="lp-trial-body">
              <p className="lp-trial-when">Jederzeit</p>
              <p className="lp-trial-text">Upgraden, kündigen, pausieren. Eure Daten bleiben gespeichert.</p>
            </div>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="lp-steps" id="lp-steps">
        <p className="lp-section-eyebrow lp-reveal">So einfach geht&apos;s</p>
        <h2 className="lp-section-title">
          <span className="lp-reveal-clip"><span className="lp-reveal-clip-inner">In <em>zwei Schritten</em> zum Dashboard</span></span>
        </h2>
        <div className="lp-steps-grid lp-steps-grid-2">
          <div className="lp-step lp-reveal">
            <div className="lp-step-num">01</div>
            <h3 className="lp-step-title">Registrieren</h3>
            <p className="lp-step-desc">E-Mail, Name, fertig. Euer Dashboard wird automatisch eingerichtet.</p>
          </div>
          <div className="lp-step lp-reveal lp-reveal-d2">
            <div className="lp-step-num">02</div>
            <h3 className="lp-step-title">Loslegen</h3>
            <p className="lp-step-desc">Gäste einladen, Budget anlegen, Sitzplan bauen. Euer Partner plant vom eigenen Gerät aus mit.</p>
            <a href={SIGNUP_URL} className="lp-step-cta">
              3 Tage kostenlos testen
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </a>
          </div>
        </div>
        <p className="lp-steps-note lp-reveal">Ihr habt einen Einladungslink von eurem Veranstalter? Dann seid ihr mit einem Klick drin.</p>
      </section>

      {/* FAQ */}
      <section className="lp-faq" id="lp-faq">
        <div className="lp-faq-inner">
          <div className="lp-faq-header">
            <p className="lp-section-eyebrow lp-reveal">Häufige Fragen</p>
            <h2 className="lp-section-title">
              <span className="lp-reveal-clip"><span className="lp-reveal-clip-inner">Alles, was ihr <em>wissen wollt</em></span></span>
            </h2>
          </div>
          {([
            { q: 'Was kostet Velvet?', a: 'Die ersten 3 Tage sind kostenlos — mit vollem Funktionsumfang und ohne Zahlungsdaten. Danach kostet Velvet 25 € im Monat. Wenn euer Hochzeitsplaner und eure Dienstleister mitarbeiten sollen, gibt es Velvet Pro für 55 € im Monat. Beides ist monatlich kündbar.' },
            { q: 'Was passiert nach den 3 Testtagen?', a: 'Ihr entscheidet aktiv, ob ihr weitermacht — es wird nichts automatisch abgebucht, weil wir im Test keine Zahlungsdaten verlangen. Eure Daten bleiben gespeichert, sodass ihr nahtlos weiterplanen könnt.' },
            { q: 'Können wir später von Velvet auf Pro wechseln?', a: 'Jederzeit, mit einem Klick. Viele Paare starten allein für 25 € und holen den Veranstalter oder die Dienstleister später per Upgrade dazu.' },
            { q: 'Können wir beide gemeinsam planen?', a: 'Ja! Das Dashboard ist für beide Partner gleichzeitig zugänglich. Ihr könnt von verschiedenen Geräten aus gleichzeitig arbeiten. Änderungen werden in Echtzeit synchronisiert — so seid ihr immer auf dem gleichen Stand.' },
            { q: 'Sind unsere Daten sicher?', a: 'Eure Daten sind ausschließlich für euch und die Personen sichtbar, die ihr zu eurer Planung einladet. Velvet verwendet eine sichere, verschlüsselte Verbindung. Eure Gästeliste, Sitzpläne und persönlichen Informationen werden vertraulich behandelt und nicht an Dritte weitergegeben.' },
          ] as const).map(({ q, a }, i) => (
            <div key={i} className={`lp-faq-item lp-reveal${i > 0 ? ` lp-reveal-d${i}` : ''}`}>
              <button
                className="lp-faq-q"
                aria-expanded="false"
                aria-controls={`lp-faq-a-${i}`}
                onClick={e => toggleFaq((e.currentTarget as HTMLElement).parentElement as HTMLElement)}
              >
                {q}
                <svg className="lp-faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
              <div id={`lp-faq-a-${i}`} className="lp-faq-a"><div className="lp-faq-a-inner">{a}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BAND */}
      <div className="lp-cta-band" id="lp-register">
        <div className="lp-cta-photo">
          <div className="lp-cta-photo-inner" />
          <div className="lp-cta-photo-overlay" />
        </div>
        <div className="lp-cta-content">
          <p className="lp-cta-eyebrow">Euer Einstieg</p>
          <h2 className="lp-cta-title">Eure Hochzeit. Euer Dashboard. <em>Ab heute.</em></h2>
          <div className="lp-cta-actions">
            <a href={SIGNUP_URL} className="lp-btn-gold">3 Tage kostenlos testen</a>
          </div>
          <p className="lp-cta-foot">3 Tage kostenlos · danach ab 25 €/Monat · monatlich kündbar</p>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div>
            <div className="lp-footer-logo"><img src="/landing/logo.png" alt="Velvet" /></div>
            <p className="lp-footer-tagline">Euer großer Tag.<br />Einfach unvergesslich geplant.</p>
          </div>
          <div>
            <p className="lp-footer-col-title">Navigation</p>
            <ul className="lp-footer-links">
              <li><a href="#lp-features">Funktionen</a></li>
              <li><a href="#lp-pricing">Preise</a></li>
              <li><a href="#lp-steps">So funktioniert&apos;s</a></li>
              <li><a href="#lp-faq">FAQ</a></li>
              <li><a href="/signup/brautpaar">3 Tage kostenlos testen</a></li>
              <li><a href="/login">Anmelden</a></li>
            </ul>
          </div>
          <div>
            <p className="lp-footer-col-title">Rechtliches</p>
            <ul className="lp-footer-links">
              <li><a href="#">Impressum</a></li>
              <li><a href="#">Datenschutz</a></li>
              <li><a href="#">AGB</a></li>
              <li><a href="#">Cookie-Einstellungen</a></li>
            </ul>
          </div>
          <div>
            <p className="lp-footer-col-title">Kontakt</p>
            <ul className="lp-footer-links">
              <li><a href="#">Euer Veranstalter</a></li>
              <li><a href="#">Hilfe &amp; Support</a></li>
            </ul>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span className="lp-footer-copy">© 2026 Velvet. Alle Rechte vorbehalten. <a href="/signup/veranstalter" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Veranstalter</a></span>
          <div className="lp-footer-legal">
            <a href="#">Impressum</a>
            <a href="#">Datenschutz</a>
            <a href="#">Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
