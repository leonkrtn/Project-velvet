'use client'

import React, { useState, useEffect, useCallback, Component } from 'react'
import dynamic from 'next/dynamic'
import {
  Eye, Download, LayoutDashboard, Users, Grid2X2, Calendar,
  UtensilsCrossed, Wallet, Music2, Flower2, Camera, Briefcase,
  CakeSlice, FileDown, Loader2, AlertTriangle,
} from 'lucide-react'
import type { PdfEventData, PdfMode, PdfSection } from '@/components/pdf/PdfTypes'

// Lazy-load PDF components — browser only
const PDFViewer      = dynamic(() => import('@react-pdf/renderer').then(m => ({ default: m.PDFViewer })),      { ssr: false })
const PDFDownloadLink = dynamic(() => import('@react-pdf/renderer').then(m => ({ default: m.PDFDownloadLink })), { ssr: false })
const VelvetPdfDocument = dynamic(() => import('@/components/pdf/VelvetPdfDocument'), { ssr: false })

// ── Error boundary to prevent PDF render errors from crashing the app ────────
class PdfErrorBoundary extends Component<
  { children: React.ReactNode; onError: (msg: string) => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: (msg: string) => void }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error) { this.props.onError(error.message) }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

// ── Section definitions ───────────────────────────────────────────────────
const ALL_SECTIONS: Array<{ key: PdfSection; label: string; Icon: React.ElementType }> = [
  { key: 'allgemein',     label: 'Veranstaltungsinfo', Icon: LayoutDashboard },
  { key: 'gaesteliste',   label: 'Gästeliste',          Icon: Users },
  { key: 'sitzplan',      label: 'Sitzplan',            Icon: Grid2X2 },
  { key: 'ablaufplan',    label: 'Ablaufplan',           Icon: Calendar },
  { key: 'catering',      label: 'Catering',             Icon: UtensilsCrossed },
  { key: 'budget',        label: 'Budget',               Icon: Wallet },
  { key: 'musik',         label: 'Musik',                Icon: Music2 },
  { key: 'dekoration',    label: 'Dekoration',           Icon: Flower2 },
  { key: 'patisserie',    label: 'Patisserie',           Icon: CakeSlice },
  { key: 'medien',        label: 'Medien & Fotografie',  Icon: Camera },
  { key: 'dienstleister', label: 'Dienstleister',        Icon: Briefcase },
]

interface Props {
  eventId: string
  data: PdfEventData
}

export default function PdfExportClient({ eventId, data }: Props) {
  const [mounted, setMounted]         = useState(false)
  const [mode, setMode]               = useState<PdfMode>('intern')
  const [selected, setSelected]       = useState<Set<PdfSection>>(
    new Set(ALL_SECTIONS.map(s => s.key))
  )
  const [showPreview, setShowPreview] = useState(false)
  const [generating, setGenerating]   = useState(false)
  const [pdfError, setPdfError]       = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // When mode switches to extern, remove budget
  useEffect(() => {
    if (mode === 'extern') {
      setSelected(prev => {
        const next = new Set(prev)
        next.delete('budget')
        return next
      })
      setShowPreview(false)
    }
  }, [mode])

  const toggleSection = (key: PdfSection) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setShowPreview(false)
  }

  const selectAll = () => {
    const next = new Set(ALL_SECTIONS.map(s => s.key) as PdfSection[])
    if (mode === 'extern') next.delete('budget')
    setSelected(next)
    setShowPreview(false)
  }

  const selectNone = () => {
    setSelected(new Set())
    setShowPreview(false)
  }

  const handleGenerate = useCallback(() => {
    if (selected.size === 0) return
    setPdfError(null)
    setGenerating(true)
    setTimeout(() => {
      setShowPreview(true)
      setGenerating(false)
    }, 80)
  }, [selected])

  const activeSections = ALL_SECTIONS
    .filter(s => !(s.key === 'budget' && mode === 'extern'))

  const fileName = `velvet-export-${data.event.title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`

  const docNode = mounted && showPreview && selected.size > 0 && VelvetPdfDocument
    ? (
      <VelvetPdfDocument
        data={data}
        mode={mode}
        sections={Array.from(selected)}
      />
    )
    : null

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 36px)', gap: 0, overflow: 'hidden' }}>

      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div style={{
        width: 320,
        minWidth: 320,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        background: 'var(--surface)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <FileDown size={18} style={{ color: 'var(--text-secondary)' }} />
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: '-0.2px' }}>
              PDF-Export
            </h1>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            {data.event.title}
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Modus
          </p>
          <div style={{
            display: 'flex', borderRadius: 8,
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {(['intern', 'extern'] as PdfMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  background: mode === m ? 'var(--accent, #0F0F0F)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--text-secondary)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {m === 'intern' ? 'Intern' : 'Extern'}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, marginBottom: 0 }}>
            {mode === 'intern'
              ? 'Alle Daten inkl. Budget, Preise und interne Notizen.'
              : 'Ohne Budget, Preise und persönliche Kontaktdaten.'}
          </p>
        </div>

        {/* Section list */}
        <div style={{ padding: '12px 20px', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', margin: 0 }}>
              Bereiche
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={selectAll} style={textBtn}>Alle</button>
              <span style={{ color: 'var(--text-tertiary)' }}>·</span>
              <button onClick={selectNone} style={textBtn}>Keine</button>
            </div>
          </div>

          {activeSections.map(({ key, label, Icon }) => {
            const active = selected.has(key)
            return (
              <button
                key={key}
                onClick={() => toggleSection(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 10px', borderRadius: 8, border: 'none',
                  background: active ? 'var(--surface-hover, rgba(0,0,0,0.04))' : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                  marginBottom: 2, transition: 'background 0.12s',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${active ? 'var(--accent, #0F0F0F)' : 'var(--border)'}`,
                  background: active ? 'var(--accent, #0F0F0F)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {active && (
                    <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
                      <path d="M1 3.5L3.5 6L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <Icon size={14} style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                <span style={{
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleGenerate}
            disabled={selected.size === 0 || generating}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
              background: selected.size === 0 ? 'var(--border)' : 'var(--accent, #0F0F0F)',
              color: selected.size === 0 ? 'var(--text-tertiary)' : '#fff',
              cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              transition: 'opacity 0.15s',
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating
              ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              : <Eye size={15} />
            }
            {generating ? 'Wird generiert…' : 'Vorschau generieren'}
          </button>

          {mounted && showPreview && docNode && (
            <PDFDownloadLink
              document={docNode}
              fileName={fileName}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 0', borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                fontSize: 13, fontWeight: 500,
                boxSizing: 'border-box',
              }}
            >
              {({ loading }) => (
                <>
                  {loading
                    ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Download size={15} />
                  }
                  {loading ? 'Wird vorbereitet…' : 'PDF herunterladen'}
                </>
              )}
            </PDFDownloadLink>
          )}
        </div>
      </div>

      {/* ── Right panel: PDF viewer ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#e5e5e5' }}>
        {pdfError ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <AlertTriangle size={28} style={{ color: '#D97706' }} />
            </div>
            <div style={{ textAlign: 'center', maxWidth: 320 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                PDF konnte nicht erstellt werden
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px', fontFamily: 'monospace' }}>
                {pdfError}
              </p>
              <button
                onClick={() => { setPdfError(null); setShowPreview(false) }}
                style={{ ...textBtn, textDecoration: 'none', fontSize: 13, color: 'var(--text-primary)' }}
              >
                Zurücksetzen
              </button>
            </div>
          </div>
        ) : mounted && showPreview && docNode ? (
          <PdfErrorBoundary onError={msg => { setShowPreview(false); setPdfError(msg) }}>
            <PDFViewer
              width="100%"
              height="100%"
              showToolbar={true}
              style={{ border: 'none', flex: 1 }}
            >
              {docNode}
            </PDFViewer>
          </PdfErrorBoundary>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <FileDown size={28} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                {selected.size === 0 ? 'Keine Bereiche ausgewählt' : 'Vorschau noch nicht generiert'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                {selected.size === 0
                  ? 'Wähle mindestens einen Bereich aus.'
                  : 'Klicke auf „Vorschau generieren" um fortzufahren.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const textBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'inherit',
  padding: 0, textDecoration: 'underline',
}
