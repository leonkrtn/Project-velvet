'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useCallback } from 'react'
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

// ─── Demo Tab: Übersicht ───────────────────────────────────────────────────────

type TaskItem = { id: number; label: string; done: boolean }

function DemoUebersicht() {
  const [countdown, setCountdown] = useState(150)
  const [budgetVisible, setBudgetVisible] = useState(false)
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: 1, label: 'Floristin buchen', done: false },
    { id: 2, label: 'Menükarte finalisieren', done: false },
    { id: 3, label: 'Sitzplan drucken', done: false },
  ])
  const [doneCount, setDoneCount] = useState(23)
  const sectionRef = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const budgetBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        obs.disconnect()
        // Animate countdown from 150 → 142
        let val = 150
        countdownRef.current = setInterval(() => {
          val--
          setCountdown(val)
          if (val <= 142) { clearInterval(countdownRef.current!); countdownRef.current = null }
        }, 60)
        // Animate budget bar
        setTimeout(() => setBudgetVisible(true), 200)
      }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => { obs.disconnect(); if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [])

  function toggleTask(id: number) {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t
      const nowDone = !t.done
      setDoneCount(c => nowDone ? c + 1 : c - 1)
      return { ...t, done: nowDone }
    }))
  }

  return (
    <div ref={sectionRef} className="lp-demo-view">
      {/* Header */}
      <div className="lp-demo-view-header">
        <p className="lp-demo-event-name">Lisa &amp; Jonas</p>
        <p className="lp-demo-event-date">14. Juni 2027</p>
      </div>

      {/* Stat cards row */}
      <div className="lp-demo-stats">
        {/* Countdown */}
        <div className="lp-demo-stat-card lp-demo-stat-gold">
          <p className="lp-demo-stat-label">Countdown</p>
          <p className="lp-demo-stat-big">{countdown}</p>
          <p className="lp-demo-stat-sub">Tage noch</p>
        </div>
        {/* Gäste */}
        <div className="lp-demo-stat-card">
          <p className="lp-demo-stat-label">Gäste</p>
          <p className="lp-demo-stat-big">86</p>
          <p className="lp-demo-stat-sub">64 zugesagt</p>
        </div>
        {/* Budget */}
        <div className="lp-demo-stat-card lp-demo-stat-wide">
          <p className="lp-demo-stat-label">Budget</p>
          <p className="lp-demo-stat-big" style={{ fontSize: '28px' }}>12.400 €</p>
          <p className="lp-demo-stat-sub">von 18.000 € verplant</p>
          <div className="lp-demo-bar-track">
            <div
              ref={budgetBarRef}
              className="lp-demo-bar-fill"
              style={{ width: budgetVisible ? '68%' : '0%', transition: 'width 1.1s cubic-bezier(0.16,1,0.3,1) 0.1s' }}
            />
          </div>
        </div>
        {/* Aufgaben */}
        <div className="lp-demo-stat-card">
          <p className="lp-demo-stat-label">Aufgaben</p>
          <p className="lp-demo-stat-big">{doneCount}<span style={{ fontSize: '16px', color: 'var(--ink-soft)' }}>/31</span></p>
          <div className="lp-demo-bar-track" style={{ marginTop: '8px' }}>
            <div
              className="lp-demo-bar-fill"
              style={{ width: budgetVisible ? `${(doneCount / 31) * 100}%` : '0%', transition: 'width 1.1s cubic-bezier(0.16,1,0.3,1) 0.3s' }}
            />
          </div>
        </div>
      </div>

      {/* Next tasks */}
      <div className="lp-demo-card">
        <p className="lp-demo-card-title">Nächste Aufgaben</p>
        <div className="lp-demo-task-list">
          {tasks.map(t => (
            <button key={t.id} className={`lp-demo-task${t.done ? ' done' : ''}`} onClick={() => toggleTask(t.id)}>
              <span className="lp-demo-task-check">
                {t.done && (
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6.5l2.8 2.8L10 3.5" />
                  </svg>
                )}
              </span>
              <span className="lp-demo-task-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Demo Tab: Gästeliste ─────────────────────────────────────────────────────

type GuestStatus = 'zugesagt' | 'ausstehend'
type Guest = { id: number; name: string; status: GuestStatus; detail?: string }

function DemoGaeste() {
  const [guests, setGuests] = useState<Guest[]>([
    { id: 1, name: 'Anna Berger', status: 'zugesagt', detail: 'Menü: Fisch' },
    { id: 2, name: 'Tom & Mia Keller +1', status: 'zugesagt', detail: 'Vegetarisch' },
    { id: 3, name: 'Jonas Brandt', status: 'ausstehend' },
    { id: 4, name: 'Familie Schmidt (4)', status: 'zugesagt' },
    { id: 5, name: 'Lea Hoffmann', status: 'ausstehend' },
  ])
  const [toast, setToast] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true
        obs.disconnect()
        // After 1.5s: Jonas Brandt → zugesagt + toast
        const t = setTimeout(() => {
          setGuests(prev => prev.map(g => g.id === 3 ? { ...g, status: 'zugesagt' } : g))
          setToast(true)
          setTimeout(() => setToast(false), 2500)
        }, 1500)
        return () => clearTimeout(t)
      }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  function toggleStatus(id: number) {
    setGuests(prev => prev.map(g => g.id === id
      ? { ...g, status: g.status === 'zugesagt' ? 'ausstehend' : 'zugesagt' }
      : g
    ))
  }

  return (
    <div ref={sectionRef} className="lp-demo-view" style={{ position: 'relative' }}>
      {/* Toast */}
      <div className={`lp-demo-toast${toast ? ' visible' : ''}`}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8.5l3.2 3.2L13 4.5" />
        </svg>
        Neue Zusage eingegangen
      </div>

      <div className="lp-demo-view-header">
        <p className="lp-demo-event-name">Gästeliste</p>
        <p className="lp-demo-event-date">86 Gäste · 64 zugesagt</p>
      </div>

      {/* Fake search */}
      <div className="lp-demo-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
        </svg>
        <span>Gast suchen …</span>
      </div>

      {/* Guest list */}
      <div className="lp-demo-guest-list">
        {guests.map(g => (
          <div key={g.id} className="lp-demo-guest-row">
            <div className="lp-demo-guest-info">
              <span className="lp-demo-guest-name">{g.name}</span>
              {g.detail && <span className="lp-demo-guest-detail">{g.detail}</span>}
            </div>
            <button
              className={`lp-demo-badge lp-demo-badge-${g.status === 'zugesagt' ? 'green' : 'neutral'}`}
              onClick={() => toggleStatus(g.id)}
              title="Status wechseln"
            >
              {g.status === 'zugesagt' ? 'Zugesagt' : 'Ausstehend'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Demo Tab: Sitzplan ───────────────────────────────────────────────────────

type TableData = {
  id: number
  cx: number; cy: number
  label: string; capacity: number; occupied: number
  guests: string[]
  shape: 'round' | 'rect'
  rx?: number; ry?: number
}

const TABLES: TableData[] = [
  { id: 1, cx: 140, cy: 130, label: 'Familientisch', capacity: 8, occupied: 6, guests: ['Maria M.', 'Peter M.', 'Anja B.', 'Klaus B.', 'Sophie M.', 'Lukas M.'], shape: 'round' },
  { id: 2, cx: 300, cy: 130, label: 'Freunde', capacity: 8, occupied: 8, guests: ['Tom K.', 'Mia K.', 'Lars W.', 'Eva W.', 'Finn H.', 'Nina H.', 'Max R.', 'Lena R.'], shape: 'round' },
  { id: 3, cx: 220, cy: 260, label: 'Kollegen', capacity: 8, occupied: 5, guests: ['Anna B.', 'Ben S.', 'Cara T.', 'David N.', 'Emma P.'], shape: 'round' },
  { id: 4, cx: 370, cy: 250, label: 'Brauttafel', capacity: 6, occupied: 4, guests: ['Lisa', 'Jonas', 'Best Man', 'Maid of Honor'], shape: 'rect', rx: 80, ry: 28 },
]

const CHAIR_COUNT = 8
function chairPos(cx: number, cy: number, i: number, total: number, r: number) {
  const angle = (i / total) * Math.PI * 2 - Math.PI / 2
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
}

function DemoSitzplan() {
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const [animDone, setAnimDone] = useState(false)
  const [movingChair, setMovingChair] = useState<{ x: number; y: number } | null>({ x: 300, y: 75 })
  const sectionRef = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true
        obs.disconnect()
        // slide chair into place ~600ms after visible
        const t = setTimeout(() => {
          setAnimDone(true)
          setMovingChair(null)
        }, 700)
        return () => clearTimeout(t)
      }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const selTable = TABLES.find(t => t.id === selectedTable)

  return (
    <div ref={sectionRef} className="lp-demo-view">
      <div className="lp-demo-view-header">
        <p className="lp-demo-event-name">Sitzplan</p>
        <p className="lp-demo-event-date">4 Tische · 31 von 34 Plätzen belegt</p>
      </div>

      <div className="lp-demo-seating-wrap">
        <svg viewBox="0 0 480 320" className="lp-demo-svg" style={{ width: '100%', height: 'auto' }}>
          {/* Room outline */}
          <rect x="8" y="8" width="464" height="304" rx="12" fill="#F8F8F6" stroke="#E8E8E6" strokeWidth="1.5" />

          {TABLES.map(table => {
            const isSelected = selectedTable === table.id
            if (table.shape === 'rect') {
              const seats = [
                { x: table.cx - 50, y: table.cy - 44 },
                { x: table.cx, y: table.cy - 44 },
                { x: table.cx + 50, y: table.cy - 44 },
                { x: table.cx - 50, y: table.cy + 44 },
                { x: table.cx, y: table.cy + 44 },
                { x: table.cx + 50, y: table.cy + 44 },
              ]
              return (
                <g key={table.id} onClick={() => setSelectedTable(isSelected ? null : table.id)} style={{ cursor: 'pointer' }}>
                  {isSelected && <rect x={table.cx - (table.rx! + 14)} y={table.cy - (table.ry! + 14)} width={(table.rx! + 14) * 2} height={(table.ry! + 14) * 2} rx="8" fill="none" stroke="#B89968" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />}
                  <rect x={table.cx - table.rx!} y={table.cy - table.ry!} width={table.rx! * 2} height={table.ry! * 2} rx="5" fill={isSelected ? '#FDF4E7' : '#FBF6EE'} stroke={isSelected ? '#B89968' : '#DDD0B8'} strokeWidth="1.5" />
                  {seats.map((s, i) => (
                    <circle key={i} cx={s.x} cy={s.y} r="7" fill={i < table.occupied ? '#B89968' : 'none'} stroke="#B89968" strokeWidth="1.5" opacity={i < table.occupied ? 1 : 0.45} />
                  ))}
                  <text x={table.cx} y={table.cy - 6} textAnchor="middle" fontSize="9" fontFamily="DM Sans,sans-serif" fill="#5A5A6A" fontWeight="500">{table.label}</text>
                  <text x={table.cx} y={table.cy + 7} textAnchor="middle" fontSize="8" fontFamily="DM Sans,sans-serif" fill="#B89968">{table.occupied}/{table.capacity}</text>
                </g>
              )
            }
            // Round table
            const r = 30
            return (
              <g key={table.id} onClick={() => setSelectedTable(isSelected ? null : table.id)} style={{ cursor: 'pointer' }}>
                {isSelected && <circle cx={table.cx} cy={table.cy} r={r + 16} fill="none" stroke="#B89968" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />}
                <circle cx={table.cx} cy={table.cy} r={r} fill={isSelected ? '#FDF4E7' : '#FBF6EE'} stroke={isSelected ? '#B89968' : '#DDD0B8'} strokeWidth="1.5" />
                {Array.from({ length: CHAIR_COUNT }).map((_, i) => {
                  const pos = chairPos(table.cx, table.cy, i, CHAIR_COUNT, r + 13)
                  const isFilled = i < table.occupied
                  // For table 2 (Freunde), last chair animates
                  const isAnimChair = table.id === 2 && i === 7
                  if (isAnimChair && movingChair && !animDone) {
                    return (
                      <circle
                        key={i}
                        cx={movingChair.x}
                        cy={movingChair.y}
                        r="6"
                        fill="none"
                        stroke="#B89968"
                        strokeWidth="1.5"
                        opacity="0.6"
                        style={{ transition: 'cx 0.8s cubic-bezier(0.16,1,0.3,1), cy 0.8s cubic-bezier(0.16,1,0.3,1)' }}
                      />
                    )
                  }
                  return (
                    <circle
                      key={i}
                      cx={pos.x}
                      cy={pos.y}
                      r="6"
                      fill={isFilled ? '#B89968' : 'none'}
                      stroke="#B89968"
                      strokeWidth="1.5"
                      opacity={isFilled ? 1 : 0.35}
                    />
                  )
                })}
                <text x={table.cx} y={table.cy - 4} textAnchor="middle" fontSize="8.5" fontFamily="DM Sans,sans-serif" fill="#5A5A6A" fontWeight="500">{table.label}</text>
                <text x={table.cx} y={table.cy + 8} textAnchor="middle" fontSize="8" fontFamily="DM Sans,sans-serif" fill="#B89968">{table.occupied}/{table.capacity}</text>
              </g>
            )
          })}

          {/* Moving chair animation: a ghost chair gliding to its spot */}
          {movingChair && !animDone && (() => {
            const targetTable = TABLES[1] // Freunde
            const targetPos = chairPos(targetTable.cx, targetTable.cy, 7, CHAIR_COUNT, 43)
            return (
              <circle
                cx={animDone ? targetPos.x : movingChair.x}
                cy={animDone ? targetPos.y : movingChair.y}
                r="6"
                fill="#B89968"
                stroke="#B89968"
                strokeWidth="1"
                opacity="0.5"
                style={{
                  transition: animDone ? 'cx 0.8s ease, cy 0.8s ease' : 'none',
                }}
              />
            )
          })()}
        </svg>

        {selTable && (
          <div className="lp-demo-table-detail">
            <p className="lp-demo-card-title" style={{ marginBottom: '10px' }}>{selTable.label} — Gäste</p>
            <div className="lp-demo-table-guests">
              {selTable.guests.map((g, i) => (
                <span key={i} className="lp-demo-table-guest-tag">{g}</span>
              ))}
              {Array.from({ length: selTable.capacity - selTable.occupied }).map((_, i) => (
                <span key={`empty-${i}`} className="lp-demo-table-guest-tag lp-demo-table-guest-empty">— frei —</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Phone frame mini overview ────────────────────────────────────────────────

function DemoPhone({ activeTab }: { activeTab: number }) {
  const [countdown] = useState(142)
  return (
    <div className="lp-demo-phone">
      <div className="lp-demo-phone-notch" />
      <div className="lp-demo-phone-screen">
        {activeTab === 0 && (
          <>
            <p className="lp-demo-phone-greeting">Hallo, Lisa</p>
            <div className="lp-demo-phone-countdown">
              <p className="lp-demo-phone-big">{countdown}</p>
              <p className="lp-demo-phone-sub">Tage noch</p>
            </div>
            <div className="lp-demo-phone-stats">
              <div className="lp-demo-phone-stat"><span className="lp-demo-phone-stat-n">86</span><span>Gäste</span></div>
              <div className="lp-demo-phone-stat"><span className="lp-demo-phone-stat-n">64</span><span>Zusagen</span></div>
            </div>
          </>
        )}
        {activeTab === 1 && (
          <>
            <p className="lp-demo-phone-greeting">Gästeliste</p>
            <div className="lp-demo-phone-glist">
              <div className="lp-demo-phone-grow"><span>Anna B.</span><span className="lp-demo-phone-badge-g">Zu</span></div>
              <div className="lp-demo-phone-grow"><span>Tom & Mia K.</span><span className="lp-demo-phone-badge-g">Zu</span></div>
              <div className="lp-demo-phone-grow"><span>Jonas B.</span><span className="lp-demo-phone-badge-n">Aus</span></div>
              <div className="lp-demo-phone-grow"><span>Familie Sch.</span><span className="lp-demo-phone-badge-g">Zu</span></div>
            </div>
          </>
        )}
        {activeTab === 2 && (
          <>
            <p className="lp-demo-phone-greeting">Sitzplan</p>
            <svg viewBox="0 0 120 90" className="lp-demo-phone-svg">
              <circle cx="30" cy="30" r="16" fill="#FBF6EE" stroke="#DDD0B8" strokeWidth="1" />
              <text x="30" y="33" textAnchor="middle" fontSize="6" fontFamily="DM Sans" fill="#8A8A96">Familie</text>
              <circle cx="75" cy="30" r="16" fill="#FBF6EE" stroke="#DDD0B8" strokeWidth="1" />
              <text x="75" y="33" textAnchor="middle" fontSize="6" fontFamily="DM Sans" fill="#8A8A96">Freunde</text>
              <circle cx="52" cy="68" r="16" fill="#FBF6EE" stroke="#DDD0B8" strokeWidth="1" />
              <text x="52" y="71" textAnchor="middle" fontSize="6" fontFamily="DM Sans" fill="#8A8A96">Kollegen</text>
            </svg>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Full Demo Section ─────────────────────────────────────────────────────────

const TABS = ['Übersicht', 'Gästeliste & RSVP', 'Sitzplan']

function DemoSection() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <section className="lp-demo" id="lp-demo">
      {/* Section header */}
      <div className="lp-demo-header">
        <p className="lp-section-eyebrow lp-reveal">Ein Blick ins Produkt</p>
        <h2 className="lp-section-title">
          <span className="lp-reveal-clip"><span className="lp-reveal-clip-inner">So <em>fühlt sich Velvet an</em></span></span>
        </h2>
        <p className="lp-section-sub lp-reveal lp-reveal-d2">
          Klickt euch durch — das ist euer Dashboard mit Beispieldaten von Lisa &amp; Jonas.
        </p>
      </div>

      {/* Tabs */}
      <div className="lp-demo-tabs lp-reveal lp-reveal-d2">
        {TABS.map((tab, i) => (
          <button
            key={i}
            className={`lp-demo-tab${activeTab === i ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Device combo */}
      <div className="lp-demo-devices lp-reveal lp-reveal-d3">
        {/* Browser window (desktop only) */}
        <div className="lp-demo-browser">
          <div className="lp-demo-browser-bar">
            <span className="lp-demo-browser-dot" style={{ background: '#FF5F57' }} />
            <span className="lp-demo-browser-dot" style={{ background: '#FFBD2E' }} />
            <span className="lp-demo-browser-dot" style={{ background: '#28C840' }} />
            <span className="lp-demo-browser-url">app.velvet.de</span>
          </div>
          <div className="lp-demo-browser-content">
            {activeTab === 0 && <DemoUebersicht />}
            {activeTab === 1 && <DemoGaeste />}
            {activeTab === 2 && <DemoSitzplan />}
          </div>
        </div>

        {/* Phone (always visible) */}
        <DemoPhone activeTab={activeTab} />
      </div>

      {/* Steps integration */}
      <div className="lp-demo-steps lp-reveal">
        <div className="lp-demo-steps-inner">
          <div className="lp-demo-step-item">
            <span className="lp-demo-step-num">01</span>
            <div>
              <span className="lp-demo-step-title">Registrieren</span>
              <span className="lp-demo-step-sep"> · </span>
              <span className="lp-demo-step-desc">E-Mail, Name, fertig</span>
            </div>
          </div>
          <div className="lp-demo-steps-divider" />
          <div className="lp-demo-step-item">
            <span className="lp-demo-step-num">02</span>
            <div>
              <span className="lp-demo-step-title">Loslegen</span>
              <span className="lp-demo-step-sep"> · </span>
              <span className="lp-demo-step-desc">genau so wie hier oben</span>
            </div>
          </div>
        </div>
        <a href={SIGNUP_URL} className="lp-btn-primary" style={{ marginTop: '36px', display: 'inline-block' }}>
          3 Tage kostenlos testen
        </a>
        <p className="lp-demo-invite-note">
          Ihr habt einen Einladungslink von eurem Veranstalter? Dann seid ihr mit einem Klick drin.
        </p>
      </div>
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null)
  const heroBgRef = useRef<HTMLDivElement>(null)

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
    const sectionIds = ['lp-features', 'lp-demo', 'lp-pricing', 'lp-faq']
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
          <li><a href="#lp-demo">So funktioniert&apos;s</a></li>
          <li><a href="#lp-faq">FAQ</a></li>
        </ul>
        <div className="lp-nav-right">
          <a href="/login" className="lp-nav-login">Anmelden</a>
          <a href={SIGNUP_URL} className="lp-nav-cta">3 Tage kostenlos testen</a>
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
              <a href="#lp-demo" className="lp-btn-ghost">So funktioniert&apos;s</a>
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

      {/* DEMO SECTION */}
      <DemoSection />

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
              <li><a href="#lp-demo">So funktioniert&apos;s</a></li>
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
