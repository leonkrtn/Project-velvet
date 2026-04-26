'use client'
import React, { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useEvent } from '@/lib/event-context'
import { DEFAULT_FEATURE_TOGGLES } from '@/lib/store'
import type { FeatureKey } from '@/lib/store'

const ORBS = [
  {x:3,  s:5, dur:6.0, delay:0,   o:0.55, blur:2},
  {x:10, s:3, dur:5.2, delay:0.7, o:0.35, blur:1},
  {x:18, s:7, dur:7.0, delay:0.3, o:0.4,  blur:3},
  {x:26, s:4, dur:5.5, delay:1.1, o:0.6,  blur:1.5},
  {x:34, s:6, dur:6.5, delay:0.5, o:0.3,  blur:2},
  {x:42, s:3, dur:4.8, delay:0.2, o:0.5,  blur:1},
  {x:50, s:9, dur:6.8, delay:0.9, o:0.3,  blur:4},
  {x:58, s:4, dur:5.3, delay:0.4, o:0.5,  blur:1.5},
  {x:66, s:5, dur:6.2, delay:1.0, o:0.4,  blur:2},
  {x:74, s:3, dur:5.7, delay:0.2, o:0.55, blur:1},
  {x:81, s:6, dur:6.0, delay:0.6, o:0.3,  blur:2.5},
  {x:88, s:4, dur:5.4, delay:1.3, o:0.5,  blur:1},
  {x:94, s:7, dur:7.2, delay:0.5, o:0.35, blur:3},
  {x:15, s:5, dur:5.9, delay:1.5, o:0.45, blur:2},
  {x:62, s:3, dur:6.3, delay:1.2, o:0.4,  blur:1},
  {x:78, s:6, dur:5.1, delay:0.8, o:0.5,  blur:2},
]

const PAGE_TITLES: Record<string, string> = {
  '/brautpaar/seating':      'Sitzplan',
  '/brautpaar/budget':       'Budget',
  '/brautpaar/tasks':        'Aufgaben',
  '/brautpaar/reminders':    'Erinnerungen',
  '/brautpaar/sub-events':   'Sub-Events',
  '/brautpaar/catering':     'Catering & Menü',
  '/brautpaar/deko':         'Dekoration',
  '/brautpaar/gaeste-fotos': 'Gäste-Fotos',
  '/brautpaar/nachrichten':  'Nachrichten',
  '/brautpaar/protokoll':    'Protokoll',
  '/brautpaar/team':         'Team',
  '/brautpaar/aenderungen':  'Änderungen',
  '/brautpaar/vorschlaege':  'Vorschläge',
  '/vendors':                'Dienstleister',
  '/invite':                 'Einladen',
  '/veranstalter':           'Veranstalter',
  '/login':                  'Anmelden',
  '/signup':                 'Registrieren',
}

const FEATURE_ROUTES: Record<FeatureKey, string> = {
  budget:          '/brautpaar/budget',
  vendors:         '/vendors',
  tasks:           '/brautpaar/tasks',
  reminders:       '/brautpaar/reminders',
  seating:         '/brautpaar/seating',
  catering:        '/brautpaar/catering',
  'sub-events':    '/brautpaar/sub-events',
  invite:          '/invite',
  deko:            '/brautpaar/deko',
  'gaeste-fotos':  '/brautpaar/gaeste-fotos',
  messaging:       '/brautpaar/nachrichten',
}

const COLOR_PRESETS = [
  { name: 'Gold',     main: '#C9A84C', lt: '#E2C97E', pale: '#F9F3E3', pale2: '#F5EDD6' },
  { name: 'Rose',     main: '#C4717A', lt: '#D99AA0', pale: '#FAEEF0', pale2: '#F5E4E6' },
  { name: 'Salbei',   main: '#7A9E7E', lt: '#A3BFA6', pale: '#EEF5EF', pale2: '#E4F0E5' },
  { name: 'Lavendel', main: '#9B7FA8', lt: '#BBA8C4', pale: '#F3EFF6', pale2: '#EDE7F2' },
  { name: 'Schiefer', main: '#7B8FA8', lt: '#A3B2C4', pale: '#EEF1F5', pale2: '#E4E9F0' },
]

const FONT_PRESETS = [
  { name: 'Playfair',  family: "'Playfair Display', serif" },
  { name: 'Cormorant', family: "'Cormorant Garamond', serif" },
  { name: 'Lora',      family: "'Lora', serif" },
  { name: 'DM Serif',  family: "'DM Serif Display', serif" },
]

function applyAccentVars(preset: typeof COLOR_PRESETS[0]) {
  const s = document.documentElement.style
  s.setProperty('--gold',       preset.main)
  s.setProperty('--gold-lt',    preset.lt)
  s.setProperty('--gold-pale',  preset.pale)
  s.setProperty('--gold-pale2', preset.pale2)
}

function applyFontVar(preset: typeof FONT_PRESETS[0]) {
  document.documentElement.style.setProperty('--heading-font', preset.family)
}

const MENU_ITEMS = [
  { section: 'Hochzeit', items: [
    { label: 'Hochzeit bearbeiten', href: '/brautpaar/einstellungen', icon: '✎' },
  ]},
  { section: 'Planung', items: [
    { label: 'Dekoration',          href: '/brautpaar/deko',          icon: '❀', featureKey: 'deko' as FeatureKey },
    { label: 'Gäste-Fotos',         href: '/brautpaar/gaeste-fotos',  icon: '◻', featureKey: 'gaeste-fotos' as FeatureKey },
  ]},
  { section: 'Konto', items: [
    { label: 'Anmelden',            href: '/login',         icon: '→' },
    { label: 'Kontakt & Support',   href: '#',              icon: '◎' },
  ]},
  { section: 'Veranstalter', items: [
    { label: 'Verwaltung',          href: '/veranstalter',  icon: '⊞' },
  ]},
  { section: 'Rechtliches', items: [
    { label: 'Allgemeine Geschäftsbedingungen', href: '#',  icon: '§' },
    { label: 'Datenschutzerklärung',            href: '#',  icon: '⚿' },
    { label: 'Impressum',                       href: '#',  icon: '©' },
  ]},
]

export default function AppHeader() {
  const pathname    = usePathname()
  const router      = useRouter()
  const { event, isVeranstalter }   = useEvent()
  const coupleName  = event?.coupleName ?? ''
  const featureToggles = { ...DEFAULT_FEATURE_TOGGLES, ...event?.organizer?.featureToggles }
  const isRouteEnabled = (href: string) => {
    const key = Object.entries(FEATURE_ROUTES).find(([, route]) => route === href)?.[0] as FeatureKey | undefined
    return key ? featureToggles[key] : true
  }
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [showAnim,      setShowAnim]      = useState(false)
  const [animOut,       setAnimOut]       = useState(false)
  const [showDisplay,   setShowDisplay]   = useState(false)
  const [accentIdx,     setAccentIdx]     = useState(0)
  const [fontIdx,       setFontIdx]       = useState(0)

  // Track back target in sessionStorage — resilient to remounts and Strict Mode
  useEffect(() => {
    const stored = sessionStorage.getItem('velvet_current_path') ?? '/brautpaar'
    if (stored !== pathname) {
      sessionStorage.setItem('velvet_back_target', stored)
      sessionStorage.setItem('velvet_current_path', pathname)
    }
  }, [pathname])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  // Load display settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('velvet_display')
      if (saved) {
        const { ai, fi } = JSON.parse(saved)
        if (ai != null && COLOR_PRESETS[ai]) { setAccentIdx(ai); applyAccentVars(COLOR_PRESETS[ai]) }
        if (fi != null && FONT_PRESETS[fi])  { setFontIdx(fi);   applyFontVar(FONT_PRESETS[fi]) }
      }
    } catch {}
  }, [])

  const handleAccent = (i: number) => {
    setAccentIdx(i)
    applyAccentVars(COLOR_PRESETS[i])
    try { localStorage.setItem('velvet_display', JSON.stringify({ ai: i, fi: fontIdx })) } catch {}
  }

  const handleFont = (i: number) => {
    setFontIdx(i)
    applyFontVar(FONT_PRESETS[i])
    try { localStorage.setItem('velvet_display', JSON.stringify({ ai: accentIdx, fi: i })) } catch {}
  }

  const isSubPage = pathname !== '/brautpaar'
  const title     = PAGE_TITLES[pathname] ?? ''

  const handleBack = () => {
    router.push(sessionStorage.getItem('velvet_back_target') ?? '/brautpaar')
  }

  const handleNav = (href: string) => {
    setMenuOpen(false)
    if (href !== '#') router.push(href)
  }

  const handleReset = () => {
    setMenuOpen(false)
    localStorage.removeItem('velvet_event_v3')
    router.push('/brautpaar/einstellungen')
  }

  const handlePlayAnimation = () => {
    setMenuOpen(false)
    setAnimOut(false)
    setShowAnim(true)
    setTimeout(() => setAnimOut(true), 3400)
    setTimeout(() => setShowAnim(false), 4000)
  }

  return (
    <>
      {/* ── Backdrop ── */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 19,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* ── Slide-in drawer ── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 280,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        zIndex: 20,
        transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
        overflowY: 'auto',
      }}>
        {/* Drawer header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: 'var(--gold)' }}>
            Velvet.
          </span>
          <button onClick={() => setMenuOpen(false)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
          }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Couple name */}
        <div style={{ padding: '16px 20px 4px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 4 }}>Hochzeit</p>
          <p style={{ fontFamily: 'var(--heading-font)', fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>{coupleName}</p>
        </div>

        {/* Menu sections */}
        <div style={{ flex: 1, padding: '8px 0 24px' }}>
          {MENU_ITEMS.map(section => {
            if (section.section === 'Veranstalter' && !isVeranstalter) return null
            const visibleItems = section.items.filter(item => {
          if ((item as any).featureKey) return featureToggles[(item as any).featureKey as FeatureKey]
          return isRouteEnabled(item.href)
        })
            if (visibleItems.length === 0) return null
            return (
              <div key={section.section} style={{ marginTop: 16 }}>
                <p style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.12em', color: 'var(--text-dim)',
                  padding: '0 20px', marginBottom: 4,
                }}>{section.section}</p>
                {visibleItems.map(item => (
                  <button
                    key={item.label}
                    onClick={() => handleNav(item.href)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '11px 20px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                      fontSize: 14, color: item.href === '#' ? 'var(--text-dim)' : 'var(--text)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ fontSize: 13, color: 'var(--gold)', width: 18, textAlign: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {item.href === '#' && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>bald</span>
                    )}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {/* ── Anzeigeeinstellungen ── */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 8 }}>
          <button
            onClick={() => setShowDisplay(d => !d)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', padding: '11px 20px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              fontSize: 14, color: 'var(--text)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span style={{ fontSize: 13, color: 'var(--gold)', width: 18, textAlign: 'center', flexShrink: 0 }}>◈</span>
            <span>Anzeigeeinstellungen</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', transition: 'transform 0.2s', display: 'inline-block', transform: showDisplay ? 'rotate(180deg)' : 'none' }}>▾</span>
          </button>

          {/* Expandable panel */}
          <div style={{
            maxHeight: showDisplay ? 400 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <div style={{ padding: '4px 20px 16px' }}>

              {/* Akzentfarbe */}
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 10, marginTop: 4 }}>Akzentfarbe</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {COLOR_PRESETS.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => handleAccent(i)}
                    title={c.name}
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: c.main, padding: 0, cursor: 'pointer',
                      border: `2px solid ${accentIdx === i ? c.main : 'transparent'}`,
                      outline: accentIdx === i ? `2px solid ${c.main}` : '2px solid transparent',
                      outlineOffset: 2,
                      transform: accentIdx === i ? 'scale(1.18)' : 'scale(1)',
                      transition: 'transform 0.15s, outline 0.15s',
                    }}
                  />
                ))}
              </div>

              {/* Schriftart */}
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 8, marginTop: 16 }}>Schriftart Überschrift</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FONT_PRESETS.map((f, i) => (
                  <button
                    key={f.name}
                    onClick={() => handleFont(i)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 8,
                      background: fontIdx === i ? 'var(--gold-pale)' : 'var(--bg)',
                      border: `1px solid ${fontIdx === i ? 'var(--gold)' : 'var(--border)'}`,
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <span style={{ fontFamily: f.family, fontSize: 16, color: 'var(--text)', lineHeight: 1 }}>Julia &amp; Thomas</span>
                    <span style={{ fontSize: 10, color: fontIdx === i ? 'var(--gold)' : 'var(--text-dim)', marginLeft: 8, flexShrink: 0 }}>{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom buttons */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handlePlayAnimation}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', padding: '11px 14px',
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 10, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              fontSize: 13, color: 'var(--text-dim)',
              transition: 'border-color 0.2s, color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--gold)'; e.currentTarget.style.color='var(--gold)'; e.currentTarget.style.background='var(--gold-pale)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-dim)'; e.currentTarget.style.background='none' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>
            </svg>
            <span>Animation abspielen</span>
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>Velvet. · Euer schönster Tag.</p>
        </div>
      </div>

      {/* ── Sticky header bar ── */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        {/* Main row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '14px 18px',
        }}>
          {/* Left: back arrow + Velvet. */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={isSubPage ? handleBack : undefined}
              aria-hidden={!isSubPage}
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: isSubPage ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center',
                width: isSubPage ? 22 : 0,
                opacity: isSubPage ? 1 : 0,
                overflow: 'hidden',
                transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
                stroke="var(--text-dim)" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: 'var(--gold)' }}>
              Velvet.
            </span>
          </div>

          {/* Center: couple name */}
          <span style={{
            fontFamily: 'var(--heading-font)',
            fontSize: 17, fontWeight: 500,
            color: 'var(--text)', textAlign: 'center', whiteSpace: 'nowrap',
          }}>{coupleName}</span>

          {/* Right: burger menu — gold */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menü öffnen"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 4, display: 'flex', flexDirection: 'column',
                gap: 4, alignItems: 'flex-end',
              }}
            >
              {/* Three lines — gold, middle line shorter for style */}
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: 'block',
                  width: 18,
                  height: 1.5,
                  borderRadius: 2,
                  background: 'var(--gold)',
                }} />
              ))}
            </button>
          </div>
        </div>

        {/* Sub-bar: page title */}
        <div style={{
          maxHeight: isSubPage && title ? 30 : 0,
          opacity:   isSubPage && title ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ padding: '6px 16px', textAlign: 'center' }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--text-dim)',
            }}>{title}</span>
          </div>
        </div>
      </div>

      {/* ── Wedding animation overlay ── */}
      {showAnim&&(
        <div
          onAnimationEnd={(e)=>{ if(animOut && e.target===e.currentTarget) setShowAnim(false) }}
          style={{
            position:'fixed',inset:0,zIndex:9999,
            background:'#FFFFFF',
            display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',
            animation:animOut?'vOut 0.8s ease forwards':'vIn 0.6s ease',
            overflow:'hidden',
            pointerEvents:animOut?'none':'auto',
          }}>

          {/* Radial glow */}
          <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(201,168,76,0.08) 0%, transparent 70%)',pointerEvents:'none'}}/>

          {/* Rising orbs */}
          {ORBS.map((o,i)=>(
            <div key={i} style={{
              position:'absolute', left:`${o.x}%`, bottom:'-12px',
              width:`${o.s}px`, height:`${o.s}px`,
              borderRadius:'50%', background:'#C9A84C',
              opacity:0, filter:`blur(${o.blur}px)`,
              animation:`vOrb ${o.dur}s ${o.delay}s ease-in infinite`,
              pointerEvents:'none',
            }}/>
          ))}

          {/* Central content */}
          <div style={{position:'relative',zIndex:2,textAlign:'center'}}>
            {/* SVG Rings */}
            <div style={{display:'flex',justifyContent:'center',marginBottom:24}}>
              <svg width="120" height="60" viewBox="0 0 120 60" fill="none" style={{overflow:'visible'}}>
                <circle cx="44" cy="30" r="24"
                  stroke="#C9A84C" strokeWidth="1.2" fill="none"
                  strokeDasharray="150.8" strokeDashoffset="150.8"
                  style={{animation:'vRing 1.4s 0.4s cubic-bezier(0.4,0,0.2,1) forwards'}}
                />
                <circle cx="76" cy="30" r="24"
                  stroke="#C9A84C" strokeWidth="1.2" fill="none"
                  strokeDasharray="150.8" strokeDashoffset="150.8"
                  style={{animation:'vRing 1.4s 0.75s cubic-bezier(0.4,0,0.2,1) forwards'}}
                />
              </svg>
            </div>
            {/* Velvet. */}
            <div style={{fontFamily:"'DM Serif Display',serif",fontSize:52,color:'#C9A84C',letterSpacing:'-1px',lineHeight:1,animation:'vSlideUp 0.7s 1.2s cubic-bezier(0.22,1,0.36,1) both'}}>
              Velvet.
            </div>
          </div>

          <style>{`
            @keyframes vIn { from{opacity:0} to{opacity:1} }
            @keyframes vOut { from{opacity:1} to{opacity:0} }
            @keyframes vOrb {
              0%   { transform:translateY(0);      opacity:0 }
              15%  { opacity:1 }
              85%  { opacity:0.6 }
              100% { transform:translateY(-110vh); opacity:0 }
            }
            @keyframes vRing {
              from { stroke-dashoffset:150.8 }
              to   { stroke-dashoffset:0 }
            }
            @keyframes vSlideUp {
              from { opacity:0; transform:translateY(16px) }
              to   { opacity:1; transform:translateY(0) }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
