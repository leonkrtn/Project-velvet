import React from 'react'
import Link from 'next/link'

export const metadata = { title: 'Datenschutzerklärung — Forevr' }

// Platzhalter-Gerüst mit den technisch bereits feststehenden Verarbeitungen
// (Hosting, Auth, Cookies, Drittanbieter-Embeds). Betreiber-/Kontaktangaben und
// die rechtliche Feinprüfung ([ ... ]) müssen ergänzt werden.
export default function DatenschutzPage() {
  return (
    <main style={page}>
      <div style={wrap}>
        <div style={notice}>
          Entwurf / Gerüst — Betreiberangaben ([ … ]) ergänzen und vor Veröffentlichung rechtlich prüfen lassen.
        </div>
        <h1 style={h1}>Datenschutzerklärung</h1>

        <h2 style={h2}>1. Verantwortlicher</h2>
        <p style={p}>
          Verantwortlich für die Datenverarbeitung auf dieser Website ist:<br />
          [Firmenname], [Anschrift], E-Mail: [E-Mail]. Siehe auch <a href="/impressum" style={link}>Impressum</a>.
        </p>

        <h2 style={h2}>2. Deine Rechte</h2>
        <p style={p}>
          Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18),
          Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) sowie das Recht, eine erteilte Einwilligung
          jederzeit zu widerrufen. Zudem besteht ein Beschwerderecht bei einer Aufsichtsbehörde.
        </p>

        <h2 style={h2}>3. Hosting</h2>
        <p style={p}>
          Die Website wird bei [Vercel Inc. / Hosting-Anbieter] gehostet. Beim Aufruf werden technisch notwendige Daten
          (u. a. IP-Adresse, Zeitpunkt, angeforderte Ressource) in Server-Logs verarbeitet (Art. 6 Abs. 1 lit. f DSGVO).
          [Ggf. Auftragsverarbeitungsvertrag / Serverstandort ergänzen.]
        </p>

        <h2 style={h2}>4. Konto, Authentifizierung &amp; Datenbank</h2>
        <p style={p}>
          Für Registrierung, Login und Speicherung deiner Inhalte nutzen wir [Supabase]. Dabei werden Konto- und
          Nutzungsdaten sowie notwendige Cookies (Sitzung/Anmeldung) verarbeitet (Art. 6 Abs. 1 lit. b DSGVO zur
          Vertragserfüllung). Details zu den Cookies: <a href="/cookies" style={link}>Cookie-Richtlinie</a>.
        </p>

        <h2 style={h2}>5. Cookies &amp; Einwilligung</h2>
        <p style={p}>
          Wir verwenden notwendige Cookies sowie – nur mit deiner Einwilligung – Statistik und externe Medien. Die
          Einwilligung erfolgt über unser Cookie-Banner und ist jederzeit widerrufbar. Umfang, Anbieter und Speicherdauer
          sind in der <a href="/cookies" style={link}>Cookie-Richtlinie</a> aufgeführt (Rechtsgrundlage: § 25 TDDDG,
          Art. 6 Abs. 1 lit. a DSGVO).
        </p>

        <h2 style={h2}>6. Reichweitenmessung (Statistik)</h2>
        <p style={p}>
          Nach Einwilligung nutzen wir Vercel Speed Insights zur anonymen Performance-/Reichweitenmessung. Die Erhebung
          erfolgt cookielos und ohne Personenbezug (Art. 6 Abs. 1 lit. a DSGVO).
        </p>

        <h2 style={h2}>7. Externe Medien (Drittanbieter-Embeds)</h2>
        <p style={p}>
          Karten (Google Maps), Videos (YouTube im No-Cookie-Modus) und Musik (Spotify, Apple Music) binden wir nur nach
          deiner Einwilligung ein. Erst dann wird eine Verbindung zum jeweiligen Anbieter aufgebaut, wobei u. a. deine
          IP-Adresse übertragen wird und Cookies gesetzt werden können. Anbieter und deren Datenschutzhinweise:
          Google (<a href="https://policies.google.com/privacy" style={link} target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>),
          Spotify (<a href="https://www.spotify.com/de/legal/privacy-policy/" style={link} target="_blank" rel="noopener noreferrer">spotify.com</a>),
          Apple (<a href="https://www.apple.com/legal/privacy/" style={link} target="_blank" rel="noopener noreferrer">apple.com/legal/privacy</a>).
        </p>

        <h2 style={h2}>8. E-Mail-Versand</h2>
        <p style={p}>
          Für transaktionale E-Mails (z. B. Anfragen, Angebote, Benachrichtigungen) nutzen wir [Resend]. Verarbeitet werden
          Empfängeradresse und Inhalt der jeweiligen Nachricht (Art. 6 Abs. 1 lit. b/f DSGVO).
        </p>

        <h2 style={h2}>9. Datei-Uploads</h2>
        <p style={p}>
          Hochgeladene Dateien (z. B. Fotos) werden bei [Cloudflare R2, EU-Region] gespeichert. [Ggf. weitere Angaben.]
        </p>

        <h2 style={h2}>10. Speicherdauer</h2>
        <p style={p}>[Angaben zur Speicherdauer bzw. zu den Löschfristen ergänzen.]</p>

        <p style={{ ...p, marginTop: 24 }}><Link href="/" style={link}>Zurück zur Startseite</Link></p>
      </div>
    </main>
  )
}

const page: React.CSSProperties = { minHeight: '100dvh', background: '#F7F8FB', padding: '40px 20px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1f2733' }
const wrap: React.CSSProperties = { maxWidth: 760, margin: '0 auto', background: '#fff', border: '1px solid #E6EAF2', borderRadius: 16, padding: '32px 28px' }
const notice: React.CSSProperties = { background: '#FEF9F0', border: '1px solid #F5E4C3', color: '#92600A', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 20 }
const h1: React.CSSProperties = { fontSize: 26, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.4px' }
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '22px 0 6px' }
const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.65, color: '#3b4453', margin: '0 0 6px' }
const link: React.CSSProperties = { color: '#2352C8', fontWeight: 600, textDecoration: 'underline' }
