'use client'

// Wiederverwendbare PDF-Vorschau-Modal. Zeigt ein serverseitig gerendertes PDF
// (inline ausgeliefert) in einem iframe — inkl. Öffnen-im-Tab + Download.
// Neutral gestylt, damit es in allen Portalen (Vendor, Brautpaar) passt.
import React, { useEffect, useState } from 'react'
import { X, Download, ExternalLink, Loader2 } from 'lucide-react'

interface Props {
  url: string
  title?: string
  fileName?: string
  onClose: () => void
}

export default function PdfPreviewModal({ url, title = 'PDF-Vorschau', fileName = 'angebot.pdf', onClose }: Props) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const iconBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
    border: '1px solid #d9d6cf', background: '#fff', color: '#1c1c1c', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 500, textDecoration: 'none',
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 920, maxWidth: '100%', height: '92vh', background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}
      >
        {/* Kopfzeile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #e6e2da', flexShrink: 0 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          <a href={url} target="_blank" rel="noreferrer" style={iconBtn}><ExternalLink size={15} /> Öffnen</a>
          <a href={url} download={fileName} style={iconBtn}><Download size={15} /> Download</a>
          <button onClick={onClose} aria-label="Schließen" style={{ ...iconBtn, padding: 7 }}><X size={16} /></button>
        </div>

        {/* PDF-Inhalt */}
        <div style={{ flex: 1, position: 'relative', background: '#e5e5e5', minHeight: 0 }}>
          {!loaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={28} style={{ color: '#8a8178', animation: 'pdfprev-spin 1s linear infinite' }} />
            </div>
          )}
          <iframe
            src={url}
            title={title}
            onLoad={() => setLoaded(true)}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        </div>
      </div>
      <style>{`@keyframes pdfprev-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
