'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './landing.css'

export default function LandingPage() {
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)
  const heroBgRef = useRef<HTMLDivElement>(null)
  const typewriterRef = useRef<HTMLElement>(null)
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getRedirectUrl = useCallback(async (): Promise<string> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return '/login'

    // Check organizer
    let isOrganizer = session.user.app_metadata?.is_approved_organizer === true
    if (!isOrganizer) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved_organizer')
        .eq('id', session.user.id)
        .single()
      isOrganizer = profile?.is_approved_organizer === true
    }
    if (isOrganizer) return '/veranstalter/events'

    // Check event membership + role
    const { data: memberships } = await supabase
      .from('event_members')
      .select('event_id, role')
      .eq('user_id', session.user.id)
      .limit(1)

    if (!memberships?.length) return '/signup'

    const { event_id, role } = memberships[0]
    switch (role) {
      case 'veranstalter':  return '/veranstalter/events'
      case 'brautpaar':     return '/brautpaar'
      case 'dienstleister': return `/vendor/dashboard/${event_id}/uebersicht`
      default:              return '/brautpaar'
    }
  }, [])

  const handleCtaClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    const url = await getRedirectUrl()
    router.push(url)
  }, [getRedirectUrl, router])

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

    // Counter animation
    function animateCounter(el: HTMLElement, target: number, duration: number) {
      let start: number | null = null
      const step = (ts: number) => {
        if (!start) start = ts
        const progress = Math.min((ts - start) / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        el.textContent = String(Math.round(ease * target))
        if (progress < 1) requestAnimationFrame(step)
        else el.textContent = String(target)
      }
      requestAnimationFrame(step)
    }
    const counters = document.querySelectorAll<HTMLElement>('[data-counter]')
    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          animateCounter(el, parseInt(el.dataset.counter!, 10), 1200)
          counterObs.unobserve(el)
        }
      })
    }, { threshold: 0.5 })
    counters.forEach(el => counterObs.observe(el))

    // Typewriter
    const typeTarget = typewriterRef.current
    const typeWords = ['Einfach unvergesslich.', 'Gemeinsam organisiert.', 'Stilvoll geplant.']
    let wordIdx = 0, charIdx = 0, deleting = false
    function typeStep() {
      if (!typeTarget) return
      const word = typeWords[wordIdx]
      if (!deleting) {
        charIdx++
        typeTarget.textContent = word.slice(0, charIdx)
        if (charIdx === word.length) { deleting = true; typeTimerRef.current = setTimeout(typeStep, 2200); return }
        typeTimerRef.current = setTimeout(typeStep, 68)
      } else {
        charIdx--
        typeTarget.textContent = word.slice(0, charIdx)
        if (charIdx === 0) {
          deleting = false
          wordIdx = (wordIdx + 1) % typeWords.length
          typeTimerRef.current = setTimeout(typeStep, 380); return
        }
        typeTimerRef.current = setTimeout(typeStep, 36)
      }
    }
    typeTimerRef.current = setTimeout(typeStep, 1200)

    // Active nav section highlight
    const sectionIds = ['lp-features', 'lp-steps', 'lp-faq']
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

    // Feature card tilt
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        if (!card.classList.contains('card-visible')) return
        const rect = card.getBoundingClientRect()
        const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
        const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
        card.style.transform = `translateY(-4px) rotateX(${-dy * 3}deg) rotateY(${dx * 3}deg)`
        card.style.transition = 'background 0.3s, box-shadow 0.3s'
      })
      card.addEventListener('mouseleave', () => {
        card.style.transform = ''
        card.style.transition = 'background 0.3s, transform 0.5s ease, box-shadow 0.3s'
      })
    })

    return () => {
      window.removeEventListener('scroll', onScroll)
      revealObs.disconnect(); clipObs.disconnect(); cardObs.disconnect()
      counterObs.disconnect(); sectionObs.disconnect()
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current)
    }
  }, [])

  function toggleFaq(item: HTMLElement) {
    const isOpen = item.classList.contains('open')
    document.querySelectorAll('.lp-faq-item.open').forEach(i => i.classList.remove('open'))
    if (!isOpen) item.classList.add('open')
  }

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
          <li><a href="#lp-steps">So funktioniert&apos;s</a></li>
          <li><a href="#lp-faq">FAQ</a></li>
        </ul>
        <a href="#" onClick={handleCtaClick} className="lp-nav-cta">Jetzt anmelden</a>
      </nav>

      {/* HERO */}
      <section className="lp-hero" id="lp-hero">
        <div className="lp-hero-photo">
          <div ref={heroBgRef} className="lp-hero-photo-inner" />
        </div>
        <div className="lp-hero-bg" />
        <div className="lp-hero-content">
          <div>
            <p className="lp-hero-eyebrow">Willkommen bei Velvet</p>
            <h1 className="lp-hero-headline">
              <span style={{ whiteSpace: 'nowrap' }}>Euer großer Tag.</span><br />
              <span className="typewriter-line"><em ref={typewriterRef} /></span>
            </h1>
            <p className="lp-hero-sub">
              Alles, was ihr für eure Hochzeit braucht — an einem Ort. Gästeliste, Sitzplan, Budget, Aufgaben und mehr. Für euch. Nur für euch.
            </p>
            <div className="lp-hero-actions">
              <a href="#" onClick={handleCtaClick} className="lp-btn-primary">Zum Brautpaar-Dashboard</a>
              <a href="#lp-features" className="lp-btn-ghost">Mehr erfahren</a>
            </div>
          </div>
          <div className="lp-hero-aside">
            <div className="lp-hero-aside-stat">
              <div className="lp-hero-aside-num" data-counter="6">6</div>
              <div className="lp-hero-aside-label">smarte Tools für<br />euren großen Tag</div>
            </div>
          </div>
        </div>
        <div className="lp-scroll-hint">
          <div className="lp-scroll-line" />
          <span>Entdecken</span>
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
            <p className="lp-feature-desc">Jeder Gast erhält einen persönlichen Einladungslink. Über ein elegantes 4-Schritte-Formular geben eure Gäste an: Zu- oder Absage, Begleitpersonen mit Namen &amp; Altersgruppe, Menüwahl (Fleisch, Fisch, Vegetarisch, Vegan), Allergien aus 8 vordefinierten Tags plus Freitext, Ankunftsdatum &amp; -uhrzeit, Transportmittel und ob Alkohol erwünscht ist. Ihr seht live: wer zugesagt, abgesagt oder noch ausstehend ist — plus automatische Menü- und Allergieauswertung.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">Zusagen &amp; Absagen in Echtzeit</span>
              <span className="lp-feature-bullet">Begleitpersonen mit Namen &amp; Alter</span>
              <span className="lp-feature-bullet">Allergien &amp; Menüwahl automatisch</span>
              <span className="lp-feature-bullet">Anreisedatum &amp; Transportmittel</span>
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
            <p className="lp-feature-desc">Seht für jeden Tisch den Namen, die Kapazität und wie viele Plätze noch frei sind — in Echtzeit aktualisiert. Sobald Gäste ihre RSVP abgeben, fließen ihre Infos direkt in die Tischübersicht ein. Ihr behaltet stets den Überblick, welche Gäste noch keinen Platz haben, und könnt die Sitzordnung jederzeit anpassen.</p>
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
            <p className="lp-feature-desc">Eure Aufgaben sind nach Planungsphasen geordnet: von „12+ Monate vorher" bis zum „Hochzeitstag". Das Dashboard zeigt euch als Fortschrittsbalken, wie viel ihr in der aktuellen Phase bereits erledigt habt. Hakt gemeinsam ab — jede abgeschlossene Aufgabe bringt euch eurem großen Tag näher.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">6 strukturierte Planungsphasen</span>
              <span className="lp-feature-bullet">Fortschrittsbalken pro Phase</span>
              <span className="lp-feature-bullet">Gemeinsam abhaken in Echtzeit</span>
            </div>
          </div>
          <div className="lp-feature-card">
            <span className="lp-feature-num">04</span>
            <svg className="lp-feature-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="6" y="10" width="36" height="28" rx="2"/>
              <path d="M6 18h36"/>
              <circle cx="16" cy="14" r="2"/><circle cx="24" cy="14" r="2"/><circle cx="32" cy="14" r="2"/>
              <path d="M13 26h8M13 32h14"/>
            </svg>
            <h3 className="lp-feature-title">Dienstleister-Verwaltung</h3>
            <p className="lp-feature-desc">Alle eure Dienstleister — Fotograf, Florist, Caterer, DJ, Dekoration — an einem Ort mit Status (bestätigt / in Verhandlung / abgesagt), Kontaktdaten und Notizen. Das Dashboard zeigt euch live, wie viele bereits bestätigt sind. Keine doppelten E-Mails, keine vergessenen Rückrufe mehr.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">Status für jeden Dienstleister</span>
              <span className="lp-feature-bullet">Kontaktdaten &amp; Notizen zentral</span>
              <span className="lp-feature-bullet">Live-Übersicht bestätigter Gewerke</span>
            </div>
          </div>
          <div className="lp-feature-card">
            <span className="lp-feature-num">05</span>
            <svg className="lp-feature-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="24" cy="24" r="18"/><path d="M24 12v12l8 4"/>
            </svg>
            <h3 className="lp-feature-title">Zeitstrahl &amp; Regieplan</h3>
            <p className="lp-feature-desc">Euer gesamter Hochzeitstag auf einen Blick — minutengenau geplant. Jeder Eintrag hat eine Uhrzeit, Dauer, Kategorie (Zeremonie, Empfang, Feier, Logistik) und einen Ort. So wissen alle Beteiligten immer, was als nächstes passiert — vom Sektempfang bis zum letzten Tanz.</p>
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
            <p className="lp-feature-desc">Ein integrierter Chat direkt mit eurem Veranstaltungsteam — in Echtzeit, mit Lese-Bestätigung und Verlauf. Ihr könnt mehrere Gespräche führen, z.B. mit der Location, dem Caterer oder dem Koordinator. Alle Nachrichten sind dauerhaft gespeichert und jederzeit nachlesbar. Kein WhatsApp-Chaos, keine verlorenen E-Mails.</p>
            <div className="lp-feature-bullets">
              <span className="lp-feature-bullet">Echtzeit-Chat mit Lese-Bestätigung</span>
              <span className="lp-feature-bullet">Mehrere parallele Gespräche</span>
              <span className="lp-feature-bullet">Dauerhafter Nachrichtenverlauf</span>
            </div>
          </div>
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

      {/* STEPS */}
      <section className="lp-steps" id="lp-steps">
        <p className="lp-section-eyebrow lp-reveal">So einfach geht&apos;s</p>
        <h2 className="lp-section-title">
          <span className="lp-reveal-clip"><span className="lp-reveal-clip-inner">In <em>drei Schritten</em> zum Dashboard</span></span>
        </h2>
        <p className="lp-section-sub lp-reveal lp-reveal-d2">Euer Veranstalter hat bereits alles für euch vorbereitet. Ihr müsst nur noch einsteigen.</p>
        <div className="lp-steps-grid">
          <div className="lp-step lp-reveal">
            <div className="lp-step-num">01</div>
            <h3 className="lp-step-title">Einladung erhalten</h3>
            <p className="lp-step-desc">Ihr habt von eurem Veranstalter einen persönlichen Einladungslink bekommen. Dieser Link führt euch direkt zu eurem eigenen Velvet-Konto — individuell für euren Hochzeitstag eingerichtet.</p>
          </div>
          <div className="lp-step lp-reveal lp-reveal-d2">
            <div className="lp-step-num">02</div>
            <h3 className="lp-step-title">Konto einrichten</h3>
            <p className="lp-step-desc">Wählt einen sicheren Zugang und gebt euren Namen ein. Das dauert weniger als zwei Minuten. Kein lästiges Formular — nur das Nötigste, damit wir euch persönlich ansprechen können.</p>
          </div>
          <div className="lp-step lp-reveal lp-reveal-d4">
            <div className="lp-step-num">03</div>
            <h3 className="lp-step-title">Loslegen &amp; genießen</h3>
            <p className="lp-step-desc">Euer Dashboard ist sofort bereit. Ladet Gäste ein, plant den Sitzplan, kommuniziert mit eurem Veranstaltungsmanager — alles an einem Ort. Entspannt und stilvoll.</p>
            <button onClick={handleCtaClick} className="lp-step-cta">
              Jetzt starten
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="lp-testimonials">
        <div className="lp-testimonials-inner">
          <div className="lp-testimonials-header">
            <p className="lp-section-eyebrow lp-reveal">Stimmen von Brautpaaren</p>
            <h2 className="lp-section-title">
              <span className="lp-reveal-clip"><span className="lp-reveal-clip-inner">Was andere <em>Paare sagen</em></span></span>
            </h2>
          </div>
          <div className="lp-testimonials-track">
            <div className="lp-testimonial lp-reveal">
              <p className="lp-testimonial-text">&ldquo;Velvet hat unsere Hochzeitsplanung komplett verändert. Statt zehn verschiedener Apps hatten wir alles auf einen Blick. Unser Sitzplan war in einer Stunde fertig — das hätte sonst Tage gedauert.&rdquo;</p>
              <div className="lp-testimonial-author">
                <div className="lp-testimonial-avatar">L&amp;M</div>
                <div>
                  <div className="lp-testimonial-name">Laura &amp; Markus</div>
                  <div className="lp-testimonial-date">Hochzeit im Juni 2025</div>
                  <div className="lp-testimonial-stars"><span className="lp-star">★</span><span className="lp-star">★</span><span className="lp-star">★</span><span className="lp-star">★</span><span className="lp-star">★</span></div>
                </div>
              </div>
            </div>
            <div className="lp-testimonial lp-reveal lp-reveal-d2">
              <p className="lp-testimonial-text">&ldquo;Die Kommunikation mit unserem Veranstalter war so einfach wie nie. Alles ist nachlesbar, nichts geht verloren. Wir wussten immer, was als nächstes passiert — das hat uns so viel Stress erspart.&rdquo;</p>
              <div className="lp-testimonial-author">
                <div className="lp-testimonial-avatar">S&amp;J</div>
                <div>
                  <div className="lp-testimonial-name">Sophie &amp; Jonas</div>
                  <div className="lp-testimonial-date">Hochzeit im September 2025</div>
                  <div className="lp-testimonial-stars"><span className="lp-star">★</span><span className="lp-star">★</span><span className="lp-star">★</span><span className="lp-star">★</span><span className="lp-star">★</span></div>
                </div>
              </div>
            </div>
            <div className="lp-testimonial lp-reveal lp-reveal-d4">
              <p className="lp-testimonial-text">&ldquo;Das Design von Velvet ist so wunderschön, dass ich das Dashboard einfach nur so aufgemacht habe, um es anzuschauen. Und dann war der Zeitplan plötzlich fertig, ohne dass es sich wie Arbeit angefühlt hat.&rdquo;</p>
              <div className="lp-testimonial-author">
                <div className="lp-testimonial-avatar">A&amp;T</div>
                <div>
                  <div className="lp-testimonial-name">Anna &amp; Thomas</div>
                  <div className="lp-testimonial-date">Hochzeit im März 2026</div>
                  <div className="lp-testimonial-stars"><span className="lp-star">★</span><span className="lp-star">★</span><span className="lp-star">★</span><span className="lp-star">★</span><span className="lp-star">★</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
            { q: 'Wie bekomme ich Zugang zu meinem Dashboard?', a: 'Euer Veranstalter hat euch einen persönlichen Einladungslink per E-Mail geschickt. Klickt einfach darauf und richtet euren Zugang in wenigen Minuten ein. Kein separates Passwort nötig — der Link ist bereits für euch personalisiert.' },
            { q: 'Können wir beide gemeinsam auf das Dashboard zugreifen?', a: 'Ja! Das Dashboard ist für beide Partner gleichzeitig zugänglich. Ihr könnt von verschiedenen Geräten aus gleichzeitig arbeiten. Änderungen werden in Echtzeit synchronisiert — so seid ihr immer auf dem gleichen Stand.' },
            { q: 'Sind unsere Daten sicher?', a: 'Eure Daten sind ausschließlich für euch und euren Veranstalter sichtbar. Velvet verwendet eine sichere, verschlüsselte Verbindung. Eure Gästeliste, Sitzpläne und persönlichen Informationen werden vertraulich behandelt und nicht an Dritte weitergegeben.' },
            { q: 'Auf welchen Geräten funktioniert Velvet?', a: 'Velvet funktioniert auf allen Geräten — Smartphone, Tablet und Desktop. Kein App-Download nötig: Das Dashboard öffnet sich direkt im Browser, genau so schön wie ihr es hier seht. Optimiert für iOS, Android, Windows und Mac.' },
            { q: 'Was passiert, wenn wir Hilfe brauchen?', a: 'Über die Kommunikationsfunktion in eurem Dashboard könnt ihr jederzeit direkt mit eurem Veranstalter in Kontakt treten. Alle Nachrichten werden gespeichert und sind für beide Seiten nachlesbar. Schnell, einfach, stressfrei.' },
          ] as const).map(({ q, a }, i) => (
            <div key={i} className={`lp-faq-item lp-reveal${i > 0 ? ` lp-reveal-d${i}` : ''}`}>
              <button className="lp-faq-q" onClick={e => toggleFaq((e.currentTarget as HTMLElement).parentElement as HTMLElement)}>
                {q}
                <svg className="lp-faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
              <div className="lp-faq-a"><div className="lp-faq-a-inner">{a}</div></div>
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
          <h2 className="lp-cta-title">Bereit für <em>euren großen Tag?</em></h2>
          <p className="lp-cta-sub">Euer Dashboard wartet bereits auf euch. Euer Veranstalter hat alles vorbereitet — ihr müsst nur noch einsteigen.</p>
          <div className="lp-cta-actions">
            <a href="#" onClick={handleCtaClick} className="lp-btn-gold">Zum Anmeldeportal →</a>
            <a href="#lp-faq" className="lp-btn-outline-light">Noch Fragen?</a>
          </div>
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
              <li><a href="#lp-steps">So funktioniert&apos;s</a></li>
              <li><a href="#lp-faq">FAQ</a></li>
              <li><a href="#lp-register">Anmelden</a></li>
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
          <span className="lp-footer-copy">© 2026 Velvet. Alle Rechte vorbehalten.</span>
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
