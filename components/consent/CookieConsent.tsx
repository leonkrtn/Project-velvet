'use client'

import React, { useEffect, useState } from 'react'
import { Cookie, X } from 'lucide-react'
import { useConsent } from '@/components/consent/ConsentProvider'
import { CATEGORY_LABELS } from '@/lib/consent/consent'

// Cookie-Banner + Einstellungen. Erscheint, bis eine Entscheidung getroffen ist;
// die Einstellungen lassen sich jederzeit erneut öffnen (Footer/Provider-Event).
export default function CookieConsent() {
  const { ready, decided, settingsOpen, consent, acceptAll, rejectAll, save, openSettings, closeSettings } = useConsent()

  if (!ready) return null
  const showBanner = !decided
  if (!showBanner && !settingsOpen) return null

  return (
    <>
      {showBanner && !settingsOpen && <Banner onAcceptAll={acceptAll} onRejectAll={rejectAll} onSettings={openSettings} />}
      {settingsOpen && (
        <SettingsModal
          initial={{ statistics: !!consent?.statistics, externalMedia: !!consent?.externalMedia }}
          firstTime={!decided}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onSave={save}
          onClose={closeSettings}
        />
      )}
    </>
  )
}

function Banner({ onAcceptAll, onRejectAll, onSettings }: { onAcceptAll: () => void; onRejectAll: () => void; onSettings: () => void }) {
  return (
    <div role="dialog" aria-label="Cookie-Hinweis" aria-live="polite"
      style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9000, display: 'flex', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
      <div style={{ ...card, maxWidth: 720, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Cookie size={18} style={{ color: ACCENT, flexShrink: 0 }} />
          <strong style={{ fontSize: 15, color: INK }}>Wir respektieren deine Privatsphäre</strong>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: INK2, margin: '0 0 14px' }}>
          Wir verwenden notwendige Cookies für Login und Sitzung. Mit deiner Einwilligung nutzen wir zusätzlich
          Statistik (anonyme Reichweitenmessung) und externe Medien (z. B. Google Maps, YouTube). Details in unserer{' '}
          <a href="/cookies" style={link}>Cookie-Richtlinie</a> und{' '}
          <a href="/datenschutz" style={link}>Datenschutzerklärung</a>. Deine Wahl kannst du jederzeit ändern.
        </p>
        <div className="ccn-banner-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button onClick={onAcceptAll} style={btnPrimary}>Alle akzeptieren</button>
          <button onClick={onRejectAll} style={btnGhost}>Nur notwendige</button>
          <button onClick={onSettings} className="ccn-settings-btn" style={{ ...btnGhost, marginLeft: 'auto' }}>Einstellungen</button>
        </div>
      </div>
      <style>{`
        @media (max-width: 560px) {
          .ccn-banner-actions { flex-direction: column; align-items: stretch; }
          .ccn-banner-actions button { width: 100%; justify-content: center; }
          .ccn-banner-actions .ccn-settings-btn { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  )
}

function SettingsModal({ initial, firstTime, onAcceptAll, onRejectAll, onSave, onClose }: {
  initial: { statistics: boolean; externalMedia: boolean }
  firstTime: boolean
  onAcceptAll: () => void
  onRejectAll: () => void
  onSave: (c: { statistics: boolean; externalMedia: boolean }) => void
  onClose: () => void
}) {
  const [statistics, setStatistics] = useState(initial.statistics)
  const [externalMedia, setExternalMedia] = useState(initial.externalMedia)

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Cookie-Einstellungen"
      style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(20,22,26,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cookie size={18} style={{ color: ACCENT }} />
            <strong style={{ fontSize: 15.5, color: INK }}>Cookie-Einstellungen</strong>
          </div>
          <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK2, display: 'flex' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: INK2, margin: '0 0 16px' }}>
            Entscheide selbst, welche Kategorien du zulässt. Notwendige Cookies sind für den Betrieb erforderlich und
            immer aktiv. Mehr in der <a href="/cookies" style={link}>Cookie-Richtlinie</a>.
          </p>

          <Row title="Notwendig" desc="Erforderlich für Login, Sitzung und Sicherheit (Supabase-Auth, Login-Persistenz, Speicherung deiner Cookie-Wahl). Nicht abwählbar." fixed checked />
          <Row title={CATEGORY_LABELS.statistics.title} desc={CATEGORY_LABELS.statistics.desc} checked={statistics} onChange={setStatistics} />
          <Row title={CATEGORY_LABELS.externalMedia.title} desc={CATEGORY_LABELS.externalMedia.desc} checked={externalMedia} onChange={setExternalMedia} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 20px', borderTop: `1px solid ${LINE}` }}>
          <button onClick={() => onSave({ statistics, externalMedia })} style={btnPrimary}>Auswahl speichern</button>
          <button onClick={onAcceptAll} style={btnGhost}>Alle akzeptieren</button>
          <button onClick={onRejectAll} style={{ ...btnGhost, marginLeft: firstTime ? 0 : 'auto' }}>Nur notwendige</button>
        </div>
      </div>
    </div>
  )
}

function Row({ title, desc, checked, onChange, fixed }: {
  title: string; desc: string; checked: boolean; onChange?: (v: boolean) => void; fixed?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: `1px solid ${LINE}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{title}</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: INK2, margin: '4px 0 0' }}>{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={fixed}
        onClick={() => onChange?.(!checked)}
        style={{
          width: 44, height: 26, borderRadius: 13, border: 'none', padding: 0, flexShrink: 0, position: 'relative',
          cursor: fixed ? 'default' : 'pointer', opacity: fixed ? 0.6 : 1,
          background: checked ? ACCENT : '#D8D2C6', transition: 'background .15s',
        }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .15s' }} />
      </button>
    </div>
  )
}

// FOREVR-Markenoptik: Gold als Akzent, weißer Hintergrund, schwarzer Text.
// Theme-unabhängig (funktioniert auf Landing + in allen Portalen).
const ACCENT = '#B89968'        // FOREVR-Gold (--gold)
const ACCENT_DEEP = '#8A6F3F'   // dunkleres Gold für Text auf Gold-Flächen / Links
const INK = '#111111'           // schwarzer Text
const INK2 = '#5A5A5A'
const LINE = '#E7E2D8'          // warme, zum Gold passende Trennlinie
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16, border: `1px solid ${LINE}`,
  boxShadow: '0 18px 50px rgba(28,24,16,0.22)', padding: '16px 18px',
  fontFamily: "'DM Sans', system-ui, sans-serif",
}
const link: React.CSSProperties = { color: ACCENT_DEEP, textDecoration: 'underline', fontWeight: 600 }
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 18px', borderRadius: 10,
  fontSize: 13.5, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: '#111111', border: 'none', fontFamily: 'inherit',
}
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px', borderRadius: 10,
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: '#fff', color: INK, border: `1px solid ${LINE}`, fontFamily: 'inherit',
}
