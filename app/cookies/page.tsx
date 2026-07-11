'use client'

import React from 'react'
import Link from 'next/link'
import { Cookie } from 'lucide-react'
import { CONSENT_OPEN_EVENT } from '@/lib/consent/consent'

// Cookie-Richtlinie — faktische Auflistung der eingesetzten Cookies/Technologien.
// Inhalte spiegeln die tatsächliche Nutzung in der App wider (Stand: laufend zu pflegen).
export default function CookiesPage() {
  return (
    <main style={page}>
      <div style={wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Cookie size={22} style={{ color: ACCENT }} />
          <h1 style={h1}>Cookie-Richtlinie</h1>
        </div>
        <p style={muted}>Diese Seite erklärt, welche Cookies und ähnlichen Technologien Forevr verwendet und wozu.</p>

        <button onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))} style={btn}>
          Cookie-Einstellungen öffnen
        </button>

        <h2 style={h2}>Was sind Cookies?</h2>
        <p style={p}>
          Cookies sind kleine Textdateien, die auf deinem Gerät gespeichert werden. Wir nutzen zusätzlich vergleichbare
          Techniken wie den lokalen Browser-Speicher (localStorage). Manche sind für den Betrieb notwendig, andere setzen wir nur mit deiner
          Einwilligung ein. Deine Einwilligung kannst du jederzeit über die Cookie-Einstellungen widerrufen oder ändern.
        </p>

        <h2 style={h2}>1. Notwendig (immer aktiv)</h2>
        <p style={p}>Erforderlich für Login, Sitzung und Sicherheit. Ohne sie funktioniert die Anmeldung nicht.</p>
        <Table rows={[
          ['sb-…-auth-token', 'Supabase', 'Anmeldung/Sitzung (Zugriff & Refresh-Token).', 'bis zu 400 Tage'],
          ['fv_pref', 'Forevr', 'Speichert die Wahl „angemeldet bleiben" (30 Tage) bzw. „nur diese Sitzung".', 'bis 60 Tage'],
          ['fv_alive', 'Forevr', 'Session-Marker; erkennt das Ende der Browser-Sitzung.', 'Sitzung'],
          ['forevr_cookie_consent_v1', 'Forevr', 'Speichert deine Cookie-Auswahl (localStorage).', 'dauerhaft, bis Widerruf'],
        ]} />

        <h2 style={h2}>2. Statistik (Einwilligung erforderlich)</h2>
        <p style={p}>Anonyme Reichweiten-/Performance-Messung zur Verbesserung der Website. Wird nur nach Einwilligung geladen.</p>
        <Table rows={[
          ['Vercel Speed Insights', 'Vercel Inc.', 'Misst anonym Ladezeiten/Nutzungsmetriken. Cookielos, ohne Personenbezug.', '—'],
        ]} />

        <h2 style={h2}>3. Externe Medien (Einwilligung erforderlich)</h2>
        <p style={p}>
          Eingebettete Inhalte von Drittanbietern. Sie werden erst nach deiner Einwilligung geladen; vorher siehst du
          einen Platzhalter. Beim Laden können Daten (u. a. deine IP-Adresse) an die Anbieter übertragen werden, die dabei
          Cookies setzen können.
        </p>
        <Table rows={[
          ['Google Maps', 'Google Ireland Ltd.', 'Kartendarstellung von Standorten.', 'Anbieter-abhängig'],
          ['YouTube (No-Cookie)', 'Google Ireland Ltd.', 'Video-Einbettungen (erweiterter Datenschutzmodus; Cookies erst bei Wiedergabe).', 'Anbieter-abhängig'],
          ['Spotify', 'Spotify AB', 'Playlist-/Musik-Einbettungen.', 'Anbieter-abhängig'],
          ['Apple Music', 'Apple Inc.', 'Playlist-/Musik-Einbettungen.', 'Anbieter-abhängig'],
        ]} />

        <h2 style={h2}>Schriften</h2>
        <p style={p}>
          Schriftarten werden lokal von unseren Servern ausgeliefert (selbst gehostet). Es besteht dabei keine Verbindung
          zu Google-Servern, es werden keine Cookies gesetzt.
        </p>

        <h2 style={h2}>Rechtsgrundlagen &amp; deine Rechte</h2>
        <p style={p}>
          Notwendige Cookies: § 25 Abs. 2 TDDDG (unbedingt erforderlich) i. V. m. Art. 6 Abs. 1 lit. f DSGVO. Statistik &amp;
          externe Medien: § 25 Abs. 1 TDDDG i. V. m. Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Du kannst deine Einwilligung
          jederzeit mit Wirkung für die Zukunft widerrufen. Weitere Informationen zur Verarbeitung findest du in unserer{' '}
          <a href="/datenschutz" style={link}>Datenschutzerklärung</a>.
        </p>

        <p style={{ ...muted, marginTop: 28 }}>
          <Link href="/" style={link}>Zurück zur Startseite</Link>
        </p>
      </div>
    </main>
  )
}

function Table({ rows }: { rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '10px 0 4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 560 }}>
        <thead>
          <tr>
            {['Name', 'Anbieter', 'Zweck', 'Speicherdauer'].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j} style={td}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ACCENT = '#2352C8'
const page: React.CSSProperties = { minHeight: '100dvh', background: '#F7F8FB', padding: '40px 20px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1f2733' }
const wrap: React.CSSProperties = { maxWidth: 820, margin: '0 auto', background: '#fff', border: '1px solid #E6EAF2', borderRadius: 16, padding: '32px 28px' }
const h1: React.CSSProperties = { fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.4px' }
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 700, margin: '26px 0 8px' }
const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.65, color: '#3b4453', margin: '0 0 6px' }
const muted: React.CSSProperties = { fontSize: 13.5, color: '#6b7480', margin: '0 0 18px' }
const link: React.CSSProperties = { color: ACCENT, fontWeight: 600, textDecoration: 'underline' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 42, padding: '0 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', margin: '4px 0 8px' }
const th: React.CSSProperties = { textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7480', padding: '8px 10px', borderBottom: '2px solid #E6EAF2' }
const td: React.CSSProperties = { padding: '9px 10px', borderBottom: '1px solid #EEF1F6', verticalAlign: 'top', color: '#3b4453' }
