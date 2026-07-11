import React from 'react'
import Link from 'next/link'

export const metadata = { title: 'Impressum — Forevr' }

// Platzhalter-Gerüst. Die mit [ ... ] markierten Felder müssen mit den echten
// Angaben des Betreibers gefüllt werden (rechtlich verpflichtend nach § 5 DDG).
export default function ImpressumPage() {
  return (
    <main style={page}>
      <div style={wrap}>
        <div style={notice}>
          Entwurf / Platzhalter — bitte durch die tatsächlichen Angaben ersetzen und rechtlich prüfen lassen.
        </div>
        <h1 style={h1}>Impressum</h1>

        <h2 style={h2}>Angaben gemäß § 5 DDG</h2>
        <p style={p}>
          [Firmenname / Betreiber]<br />
          [Straße und Hausnummer]<br />
          [PLZ Ort]<br />
          [Land]
        </p>

        <h2 style={h2}>Vertreten durch</h2>
        <p style={p}>[Name der vertretungsberechtigten Person(en)]</p>

        <h2 style={h2}>Kontakt</h2>
        <p style={p}>
          Telefon: [Telefonnummer]<br />
          E-Mail: [E-Mail-Adresse]
        </p>

        <h2 style={h2}>Registereintrag</h2>
        <p style={p}>
          Registergericht: [z. B. Amtsgericht …]<br />
          Registernummer: [HRB …]
        </p>

        <h2 style={h2}>Umsatzsteuer-ID</h2>
        <p style={p}>[USt-IdNr. gemäß § 27a UStG, falls vorhanden]</p>

        <h2 style={h2}>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p style={p}>[Name, Anschrift]</p>

        <h2 style={h2}>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
        <p style={p}>
          [Angabe, ob zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
          verpflichtet/bereit.] Plattform der EU-Kommission zur Online-Streitbeilegung:{' '}
          <a href="https://ec.europa.eu/consumers/odr" style={link} target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr</a>.
        </p>

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
