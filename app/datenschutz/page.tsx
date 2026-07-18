import React from 'react'
import Link from 'next/link'

export const metadata = { title: 'Datenschutzerklärung — Forevr' }

// Vollständige Datenschutzerklärung (Stand Juli 2026). Inhalte spiegeln die
// tatsächlich implementierten Verarbeitungen wider — bei neuen Drittdiensten,
// Aktivierung des Abo-Systems (Zahlungsdienstleister!) oder neuen Datenfeldern
// muss diese Seite nachgezogen werden.
export default function DatenschutzPage() {
  return (
    <main style={page}>
      <div style={wrap}>
        <h1 style={h1}>Datenschutzerklärung</h1>
        <p style={muted}>Stand: Juli 2026</p>

        <p style={p}>
          Wir freuen uns über dein Interesse an Forevr. Der Schutz deiner personenbezogenen Daten ist uns wichtig.
          Nachfolgend informieren wir dich gemäß Art. 13, 14 DSGVO darüber, welche Daten wir bei der Nutzung der
          Website und Plattform <strong>forevrweddings.de</strong> („Forevr") verarbeiten, zu welchen Zwecken und
          welche Rechte dir zustehen.
        </p>

        <h2 style={h2}>1. Verantwortliche</h2>
        <p style={p}>
          Verantwortlich für die Datenverarbeitung auf dieser Website sind als gemeinsam Verantwortliche
          (Art. 26 DSGVO):
        </p>
        <p style={p}>
          Leon Kirsten, Malte Haas, Nico Schöbel<br />
          Gustav-Heinemann-Straße 10<br />
          63110 Rodgau<br />
          Deutschland<br />
          E-Mail: <a href="mailto:datenschutz@forevrweddings.de" style={link}>datenschutz@forevrweddings.de</a>
        </p>
        <p style={p}>
          Die Verantwortlichen betreiben Forevr gemeinsam und haben die Wahrnehmung der datenschutzrechtlichen
          Pflichten untereinander in einer Vereinbarung nach Art. 26 DSGVO geregelt. Du kannst deine Rechte
          (Ziffer 2) gegenüber jedem der Verantwortlichen geltend machen; zentrale Anlaufstelle ist die oben
          genannte E-Mail-Adresse. Siehe auch unser <a href="/impressum" style={link}>Impressum</a>.
        </p>
        <p style={p}>
          Ein Datenschutzbeauftragter ist nicht bestellt, da die gesetzlichen Voraussetzungen für eine
          Benennungspflicht (Art. 37 DSGVO, § 38 BDSG) derzeit nicht vorliegen.
        </p>

        <h2 style={h2}>2. Deine Rechte</h2>
        <p style={p}>
          Du hast gegenüber uns folgende Rechte hinsichtlich der dich betreffenden personenbezogenen Daten:
        </p>
        <ul style={ul}>
          <li style={li}>Recht auf Auskunft (Art. 15 DSGVO)</li>
          <li style={li}>Recht auf Berichtigung (Art. 16 DSGVO)</li>
          <li style={li}>Recht auf Löschung (Art. 17 DSGVO)</li>
          <li style={li}>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li style={li}>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li style={li}>Recht auf Widerspruch gegen die Verarbeitung (Art. 21 DSGVO, siehe unten)</li>
          <li style={li}>Recht, eine erteilte Einwilligung jederzeit mit Wirkung für die Zukunft zu widerrufen (Art. 7 Abs. 3 DSGVO)</li>
        </ul>
        <p style={p}>
          <strong>Widerspruchsrecht:</strong> Soweit wir Daten auf Grundlage berechtigter Interessen
          (Art. 6 Abs. 1 lit. f DSGVO) verarbeiten, kannst du aus Gründen, die sich aus deiner besonderen Situation
          ergeben, jederzeit Widerspruch einlegen. Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir können
          zwingende schutzwürdige Gründe nachweisen, die deine Interessen, Rechte und Freiheiten überwiegen, oder die
          Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.
        </p>
        <p style={p}>
          Zudem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO).
          Zuständig für uns ist der Hessische Beauftragte für Datenschutz und Informationsfreiheit,
          Gustav-Stresemann-Ring 1, 65189 Wiesbaden; du kannst dich aber auch an die Aufsichtsbehörde deines
          gewöhnlichen Aufenthaltsorts wenden.
        </p>

        <h2 style={h2}>3. Hosting &amp; Server-Logfiles</h2>
        <p style={p}>
          Die Website wird bei Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA („Vercel") gehostet.
          Beim Aufruf der Website werden automatisch technisch notwendige Daten in Server-Logfiles verarbeitet,
          insbesondere IP-Adresse, Datum und Uhrzeit des Zugriffs, angeforderte Ressource (URL), Referrer-URL,
          Browsertyp/-version und Betriebssystem. Diese Daten sind für die Auslieferung der Website, die
          Gewährleistung der Stabilität und Sicherheit (z. B. Missbrauchs- und Angriffserkennung) erforderlich.
        </p>
        <p style={p}>
          Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und stabilen Betrieb der Website
          (Art. 6 Abs. 1 lit. f DSGVO). Die Logfiles werden in der Regel spätestens nach 30 Tagen gelöscht,
          sofern nicht ein konkreter Sicherheitsvorfall eine längere Aufbewahrung erfordert. Mit Vercel besteht
          ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO; zur Datenübermittlung in die USA siehe Ziffer 15.
        </p>

        <h2 style={h2}>4. Registrierung, Nutzerkonto &amp; Datenbank</h2>
        <p style={p}>
          Für Registrierung, Login und die Speicherung deiner Inhalte nutzen wir Supabase (Supabase Inc.);
          die Datenbank wird in der EU betrieben (AWS-Region eu-central-1, Frankfurt am Main). Mit Supabase
          besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.
        </p>
        <p style={p}>
          Bei der Registrierung verarbeiten wir je nach Rolle (Brautpaar, Veranstalter, Dienstleister,
          Trauzeuge, Mitarbeiter): Name, E-Mail-Adresse und Passwort (verschlüsselt gespeichert) sowie optional
          ein Profilbild. Zur Verifizierung deiner E-Mail-Adresse senden wir dir einen Bestätigungscode; Code,
          Ablaufzeit (15 Minuten) und Fehlversuche werden temporär zu deinem Konto gespeichert.
          Dienstleister können zusätzlich ein Firmenprofil anlegen (Firmenname, Kategorie, Beschreibung, Logo,
          Website, Telefonnummer, Anschrift, Preisangaben, Galerie-Fotos, Markenfarbe, E-Mail-Textbausteine).
        </p>
        <p style={p}>
          Im Rahmen der Nutzung speichern wir außerdem die von dir in der Plattform angelegten Inhalte
          (z. B. Eventdaten, Gästelisten, Sitzpläne, Ablaufpläne, Budgets, Notizen, Nachrichten, Dateien).
          Rechtsgrundlage ist die Vertragserfüllung bzw. Durchführung vorvertraglicher Maßnahmen
          (Art. 6 Abs. 1 lit. b DSGVO). Zu den dabei gesetzten notwendigen Cookies siehe unsere{' '}
          <a href="/cookies" style={link}>Cookie-Richtlinie</a>.
        </p>

        <h2 style={h2}>5. Cookies, lokaler Speicher &amp; Einwilligung</h2>
        <p style={p}>
          Wir verwenden notwendige Cookies (Login/Sitzung, Sicherheits- und Einstellungs-Cookies) sowie — nur mit
          deiner Einwilligung — Dienste der Kategorien „Statistik" und „Externe Medien". Die Einwilligung erfolgt
          über unser Cookie-Banner und kann jederzeit über die Cookie-Einstellungen mit Wirkung für die Zukunft
          widerrufen oder geändert werden. Zusätzlich nutzen wir den lokalen Browser-Speicher (localStorage), um
          deine Cookie-Auswahl sowie Anzeige- und Arbeitsstände der App auf deinem Gerät zu speichern.
        </p>
        <p style={p}>
          Rechtsgrundlagen: für notwendige Cookies § 25 Abs. 2 TDDDG i. V. m. Art. 6 Abs. 1 lit. f DSGVO, für
          einwilligungspflichtige Dienste § 25 Abs. 1 TDDDG i. V. m. Art. 6 Abs. 1 lit. a DSGVO. Eine vollständige
          Auflistung aller Cookies und Technologien mit Anbietern und Speicherdauern findest du in der{' '}
          <a href="/cookies" style={link}>Cookie-Richtlinie</a>.
        </p>

        <h2 style={h2}>6. Reichweitenmessung (Statistik)</h2>
        <p style={p}>
          Nach deiner Einwilligung nutzen wir Vercel Speed Insights zur anonymen Performance- und
          Reichweitenmessung. Die Erhebung erfolgt cookielos und ohne Bildung von Nutzerprofilen; IP-Adressen
          werden nicht dauerhaft gespeichert. Rechtsgrundlage ist deine Einwilligung
          (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Du kannst die Einwilligung jederzeit über die
          Cookie-Einstellungen widerrufen.
        </p>

        <h2 style={h2}>7. Externe Medien (Drittanbieter-Einbettungen)</h2>
        <p style={p}>
          Karten (Google Maps), Videos (YouTube im erweiterten Datenschutzmodus/No-Cookie) und Musik-Player
          (Spotify, Apple Music) binden wir nur nach deiner Einwilligung ein; vorher siehst du einen Platzhalter.
          Erst mit dem Laden wird eine Verbindung zum jeweiligen Anbieter aufgebaut, wobei u. a. deine IP-Adresse
          übertragen wird und der Anbieter Cookies setzen kann. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO,
          § 25 Abs. 1 TDDDG. Anbieter und Datenschutzhinweise:
          Google Ireland Ltd. (<a href="https://policies.google.com/privacy" style={link} target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>),
          Spotify AB (<a href="https://www.spotify.com/de/legal/privacy-policy/" style={link} target="_blank" rel="noopener noreferrer">spotify.com</a>),
          Apple Inc. (<a href="https://www.apple.com/legal/privacy/" style={link} target="_blank" rel="noopener noreferrer">apple.com/legal/privacy</a>).
          Bei diesen Anbietern kann es zu Datenübermittlungen in Drittländer kommen (siehe Ziffer 15).
        </p>
        <p style={p}>
          Schriftarten werden ausschließlich lokal von unseren Servern ausgeliefert (selbst gehostet); eine
          Verbindung zu Google-Servern findet hierfür nicht statt.
        </p>

        <h2 style={h2}>8. E-Mail-Versand</h2>
        <p style={p}>
          Für den Versand transaktionaler E-Mails (z. B. Registrierungscodes, Einladungen, Anfrage- und
          Angebotsbenachrichtigungen, RSVP-Bestätigungen, Erinnerungen und Bewertungsanfragen) nutzen wir den
          Dienst Resend (Resend, Inc., USA). Verarbeitet werden dabei Empfängeradresse, Betreff und Inhalt der
          jeweiligen Nachricht. Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) bzw. unser
          berechtigtes Interesse an der Zustellung funktionsnotwendiger Benachrichtigungen
          (Art. 6 Abs. 1 lit. f DSGVO). Mit Resend besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO;
          zur Datenübermittlung in die USA siehe Ziffer 15. Einen Newsletter versenden wir derzeit nicht.
        </p>

        <h2 style={h2}>9. Datei-Uploads &amp; Fotospeicherung</h2>
        <p style={p}>
          Von Nutzern hochgeladene Dateien (z. B. Dokumente, Profil-/Galeriebilder, Gastfotos, Chat-Anhänge)
          werden bei Cloudflare R2 (Cloudflare, Inc., USA) gespeichert. Der Speicher ist vertraglich auf die
          <strong> EU-Jurisdiktion (Region Westeuropa)</strong> festgelegt; die Daten liegen auf Servern in der EU.
          Dateien sind nicht öffentlich zugänglich, sondern werden ausschließlich über kurzlebige, signierte
          Abruf-Links an berechtigte Nutzer ausgeliefert. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Mit
          Cloudflare besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO (siehe auch Ziffer 15).
        </p>

        <h2 style={h2}>10. Plattformfunktionen — Datenaustausch zwischen Nutzern</h2>
        <p style={p}>
          Forevr ist eine Plattform, auf der Brautpaare, Veranstalter, Dienstleister, Trauzeugen, Mitarbeiter
          und Gäste zusammenarbeiten. Dabei werden personenbezogene Daten bestimmungsgemäß zwischen den
          Beteiligten geteilt:
        </p>
        <p style={p}>
          <strong>a) Marktplatz-Anfragen &amp; Angebote:</strong> Stellst du als Brautpaar eine Anfrage an einen
          Dienstleister, übermitteln wir ihm die für die Angebotserstellung erforderlichen Angaben — insbesondere
          Name(n), Veranstaltungs-/Hochzeitsdatum, Gästezahl, Veranstaltungsort, deine Anfrage-Nachricht sowie
          ggf. Budgetangaben und Fragebogen-Antworten. Deine Telefonnummer wird dem Dienstleister erst nach
          Annahme der Zusammenarbeit angezeigt. Umgekehrt sehen Brautpaare die Profil- und Kontaktdaten der
          Dienstleister sowie deren freigegebene Angebote. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
        </p>
        <p style={p}>
          <strong>b) Kundenverwaltung (CRM) der Dienstleister:</strong> Dienstleister können die aus Anfragen,
          angenommenen Angeboten und verknüpften Events stammenden Kundendaten (Name, Kontaktdaten,
          Veranstaltungsdatum, Umsatz-/Budgetinformationen, Notizen, Aufgaben, Aktivitäten) in einer
          CRM-Funktion innerhalb der Plattform verwalten. Für diese Verarbeitung ist der jeweilige Dienstleister
          eigenständiger Verantwortlicher im Sinne der DSGVO; wir stellen die Funktion als technischer
          Dienstleister bereit. Auskunfts- und Löschersuchen hierzu richtest du an den jeweiligen Dienstleister;
          wir unterstützen auf Anfrage.
        </p>
        <p style={p}>
          <strong>c) Gästedaten &amp; RSVP:</strong> Brautpaare und Veranstalter können Gästedaten (Name, E-Mail,
          Telefonnummer, Gruppenzugehörigkeit, Sitzplatz, Anmerkungen) erfassen; Gäste können über einen
          persönlichen Einladungslink selbst ihre Rückmeldung abgeben. Optional können dabei Angaben zu
          Unverträglichkeiten und Allergien erfasst werden, um die Verpflegung zu planen. Soweit diese Angaben
          Gesundheitsdaten darstellen, erfolgt die Verarbeitung auf Grundlage einer ausdrücklichen Einwilligung
          des Gastes bei der Eingabe (Art. 9 Abs. 2 lit. a DSGVO); die Angabe ist stets freiwillig. Für die
          Gästedaten ihres Events sind die einladenden Brautpaare/Veranstalter datenschutzrechtlich
          verantwortlich; Forevr verarbeitet diese Daten in ihrem Auftrag.
        </p>
        <p style={p}>
          <strong>d) Gastfotos:</strong> Gäste können nach dem Event über ihren persönlichen Link Fotos in die
          Galerie des Events hochladen (ohne eigenes Konto). Die Fotos sind für die Mitglieder des Events sichtbar
          und werden gemäß Ziffer 9 gespeichert. Bitte lade nur Fotos hoch, für die du die Zustimmung der
          abgebildeten Personen hast.
        </p>
        <p style={p}>
          <strong>e) Mitarbeiter- &amp; Schichtdaten:</strong> Veranstalter können Team-Mitglieder anlegen
          (Name, Rolle, E-Mail, Telefonnummer) und Schichten planen; Mitarbeiter können sich ein-/ausstempeln
          (Arbeitszeiterfassung) und Schichttäusche anfragen. Verantwortlich für diese Beschäftigtendaten ist der
          jeweilige Veranstalter; Forevr verarbeitet sie in dessen Auftrag.
        </p>
        <p style={p}>
          <strong>f) Nachrichten &amp; Datenfreigaben:</strong> Die Chat-Funktion speichert Nachrichten, Anhänge
          und gezielt freigegebene Modul-Daten (z. B. Ablaufplan-Auszüge) für die Teilnehmer der jeweiligen
          Konversation. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
        </p>

        <h2 style={h2}>11. Umkreissuche (Geocoding)</h2>
        <p style={p}>
          Für die Umkreissuche im Marktplatz übersetzen wir Ortsangaben (z. B. PLZ/Ort) serverseitig über den
          Dienst Nominatim der OpenStreetMap Foundation in Geokoordinaten. Die Anfrage erfolgt von unserem Server
          aus; deine IP-Adresse wird dabei nicht an OpenStreetMap übertragen. Rechtsgrundlage:
          Art. 6 Abs. 1 lit. b DSGVO.
        </p>

        <h2 style={h2}>12. Interaktionsstatistiken im Marktplatz</h2>
        <p style={p}>
          Zur Information der Dienstleister zählen wir bestimmte Interaktionen mit Marktplatz-Profilen
          (z. B. Profilaufrufe, Klicks auf Kontaktdaten). Diese Zählung erfolgt ohne Speicherung eines
          Personenbezugs — es wird nur der Zähler je Anbieter erfasst, nicht wer die Interaktion ausgelöst hat.
        </p>

        <h2 style={h2}>13. Bewerbung als Veranstalter/Dienstleister</h2>
        <p style={p}>
          Über unser Bewerbungsformular kannst du dich für die Freischaltung als Veranstalter bzw. für den
          Marktplatz bewerben. Verarbeitet werden: Ansprechpartner, E-Mail-Adresse sowie optional Firmenname,
          Telefonnummer, Website und Beschreibung. Die Daten nutzen wir ausschließlich zur Bearbeitung deiner
          Bewerbung und Kontaktaufnahme (Art. 6 Abs. 1 lit. b DSGVO — vorvertragliche Maßnahmen). Nicht
          angenommene Bewerbungen löschen wir spätestens 6 Monate nach Abschluss des Verfahrens, sofern keine
          gesetzlichen Aufbewahrungspflichten entgegenstehen.
        </p>

        <h2 style={h2}>14. Zahlungsdaten</h2>
        <p style={p}>
          Die Nutzung von Forevr ist derzeit kostenlos; ein Zahlungsdienstleister ist nicht angebunden und es
          werden keine Zahlungs-, Karten- oder Bankdaten verarbeitet. Sollte künftig ein kostenpflichtiges Abo
          mit Zahlungsabwicklung eingeführt werden, informieren wir vorab durch eine Aktualisierung dieser
          Datenschutzerklärung.
        </p>

        <h2 style={h2}>15. Datenübermittlung in Drittländer</h2>
        <p style={p}>
          Unsere Kerndaten (Datenbank, Datei-Speicher) liegen auf Servern in der EU (Supabase: Frankfurt am Main;
          Cloudflare R2: EU-Jurisdiktion). Einige unserer Dienstleister sind jedoch US-Unternehmen (Vercel,
          Cloudflare, Resend), sodass ein Zugriff aus den bzw. eine Übermittlung in die USA nicht ausgeschlossen
          werden kann; beim E-Mail-Versand über Resend findet eine Verarbeitung in den USA statt. Diese
          Übermittlungen stützen wir auf Angemessenheitsbeschlüsse nach Art. 45 DSGVO — die genannten Anbieter
          sind unter dem EU-U.S. Data Privacy Framework (DPF) zertifiziert — sowie ergänzend auf die
          EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO), die Bestandteil der jeweiligen
          Auftragsverarbeitungsverträge sind. Bei einwilligungsbasierten Drittanbieter-Einbettungen (Ziffer 7)
          erfolgt die Übermittlung zusätzlich auf Grundlage deiner Einwilligung (Art. 49 Abs. 1 lit. a DSGVO),
          soweit kein Angemessenheitsbeschluss greift.
        </p>

        <h2 style={h2}>16. Speicherdauer &amp; Löschung</h2>
        <p style={p}>
          Wir verarbeiten personenbezogene Daten nur so lange, wie es für die jeweiligen Zwecke erforderlich ist:
        </p>
        <ul style={ul}>
          <li style={li}>Server-Logfiles: in der Regel maximal 30 Tage (Ziffer 3).</li>
          <li style={li}>E-Mail-Verifizierungscodes: 15 Minuten Gültigkeit; danach nur ein neuer Code nutzbar.</li>
          <li style={li}>
            Konto- und Eventdaten: für die Dauer der Kontonutzung. Auf Anfrage an{' '}
            <a href="mailto:datenschutz@forevrweddings.de" style={link}>datenschutz@forevrweddings.de</a> oder bei
            Kontolöschung löschen wir deine Daten, soweit keine gesetzlichen Aufbewahrungspflichten
            (z. B. §§ 147 AO, 257 HGB für Angebots-/Abrechnungsunterlagen) oder berechtigte Interessen
            (z. B. Rechtsverteidigung) entgegenstehen; in diesen Fällen wird die Verarbeitung eingeschränkt.
          </li>
          <li style={li}>Bewerbungsdaten (Ziffer 13): spätestens 6 Monate nach Abschluss des Verfahrens.</li>
          <li style={li}>Cookies/localStorage: siehe Speicherdauern in der <a href="/cookies" style={link}>Cookie-Richtlinie</a>.</li>
        </ul>

        <h2 style={h2}>17. Datensicherheit</h2>
        <p style={p}>
          Wir treffen technische und organisatorische Maßnahmen nach Art. 32 DSGVO, um deine Daten zu schützen —
          insbesondere TLS-Verschlüsselung aller Verbindungen, verschlüsselte Passwortspeicherung, ein
          rollenbasiertes Berechtigungssystem auf Datenbankebene (Row Level Security) sowie zeitlich begrenzte,
          signierte Abruf-Links für Dateien. Dateien und Datenbankinhalte sind zu keinem Zeitpunkt öffentlich
          zugänglich.
        </p>

        <h2 style={h2}>18. Keine automatisierte Entscheidungsfindung</h2>
        <p style={p}>
          Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne des Art. 22 DSGVO findet
          nicht statt. Automatisch erstellte Angebotsentwürfe im Marktplatz sind unverbindliche Entwürfe, die
          stets vom jeweiligen Dienstleister geprüft und freigegeben werden.
        </p>

        <h2 style={h2}>19. Pflicht zur Bereitstellung</h2>
        <p style={p}>
          Die Bereitstellung von Name, E-Mail-Adresse und Passwort ist für die Registrierung erforderlich; ohne
          diese Angaben kann kein Konto angelegt werden. Alle weiteren Angaben sind freiwillig, soweit sie nicht
          im Einzelfall als Pflichtfeld gekennzeichnet sind.
        </p>

        <h2 style={h2}>20. Änderungen dieser Datenschutzerklärung</h2>
        <p style={p}>
          Wir passen diese Datenschutzerklärung an, wenn sich die Rechtslage, die Plattform oder die eingesetzten
          Dienste ändern. Es gilt jeweils die hier veröffentlichte aktuelle Fassung.
        </p>

        <p style={{ ...p, marginTop: 24 }}><Link href="/" style={link}>Zurück zur Startseite</Link></p>
      </div>
    </main>
  )
}

const page: React.CSSProperties = { minHeight: '100dvh', background: '#F7F8FB', padding: '40px 20px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1f2733' }
const wrap: React.CSSProperties = { maxWidth: 760, margin: '0 auto', background: '#fff', border: '1px solid #E6EAF2', borderRadius: 16, padding: '32px 28px' }
const h1: React.CSSProperties = { fontSize: 26, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.4px' }
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '22px 0 6px' }
const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.65, color: '#3b4453', margin: '0 0 6px' }
const muted: React.CSSProperties = { fontSize: 13, color: '#6b7480', margin: '0 0 18px' }
const ul: React.CSSProperties = { margin: '0 0 6px', paddingLeft: 20 }
const li: React.CSSProperties = { fontSize: 14, lineHeight: 1.65, color: '#3b4453', margin: '0 0 4px' }
const link: React.CSSProperties = { color: '#2352C8', fontWeight: 600, textDecoration: 'underline' }
