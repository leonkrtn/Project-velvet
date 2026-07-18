import React from 'react'
import Link from 'next/link'

export const metadata = { title: 'Impressum — Forevr' }

// Vollständiges Impressum (Stand Juli 2026). Betreiber sind derzeit drei
// natürliche Personen als Gesellschafter; nach Gründung der geplanten GbR
// müssen Firmierung und ggf. Registerangaben/USt-IdNr. nachgezogen werden.
export default function ImpressumPage() {
  return (
    <main style={page}>
      <div style={wrap}>
        <h1 style={h1}>Impressum</h1>

        <h2 style={h2}>Angaben gemäß § 5 DDG</h2>
        <p style={p}>
          Leon Kirsten, Malte Haas, Nico Schöbel<br />
          Gustav-Heinemann-Straße 10<br />
          63110 Rodgau<br />
          Deutschland
        </p>

        <h2 style={h2}>Kontakt</h2>
        <p style={p}>
          E-Mail: <a href="mailto:info@forevrweddings.de" style={link}>info@forevrweddings.de</a>
        </p>

        <h2 style={h2}>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p style={p}>
          Leon Kirsten, Malte Haas, Nico Schöbel<br />
          Gustav-Heinemann-Straße 10, 63110 Rodgau
        </p>

        <h2 style={h2}>Verbraucherstreitbeilegung</h2>
        <p style={p}>
          Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
        </p>

        <h2 style={h2}>Weitere Informationen</h2>
        <p style={p}>
          <a href="/datenschutz" style={link}>Datenschutzerklärung</a> ·{' '}
          <a href="/cookies" style={link}>Cookie-Richtlinie</a>
        </p>

        <p style={{ ...p, marginTop: 24 }}><Link href="/" style={link}>Zurück zur Startseite</Link></p>
      </div>
    </main>
  )
}

const page: React.CSSProperties = { minHeight: '100dvh', background: '#F7F8FB', padding: '40px 20px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1f2733' }
const wrap: React.CSSProperties = { maxWidth: 760, margin: '0 auto', background: '#fff', border: '1px solid #E6EAF2', borderRadius: 16, padding: '32px 28px' }
const h1: React.CSSProperties = { fontSize: 26, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.4px' }
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '22px 0 6px' }
const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.65, color: '#3b4453', margin: '0 0 6px' }
const link: React.CSSProperties = { color: '#2352C8', fontWeight: 600, textDecoration: 'underline' }
