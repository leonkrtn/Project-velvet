// Server-only: rendert ein Angebots-PDF mit @react-pdf/renderer.
// Übernimmt das etablierte Forevr-Dokumentdesign (siehe components/pdf/):
// minimalistisch in Schwarz/Grau, Helvetica, Akzentbalken, eigene Titelfolie
// + laufende Kopf-/Fußzeile mit Seitenzahlen. Bewusst ohne Custom-Font-
// Registrierung (eingebautes Helvetica), damit kein Laufzeit-Fontdownload
// fehlschlagen kann. Dienstleister-Branding über Firmenname + optionales Logo.
import 'server-only'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer, Font } from '@react-pdf/renderer'
import { formatMoney, type Answer, type TaxMode } from './questionnaire'
import type { LineItem } from './pricing'

// In @react-pdf/renderer v4 kann die Default-Hyphenation null sein und
// "re is not a function" werfen — No-op deaktiviert die Silbentrennung.
Font.registerHyphenationCallback(word => [word])

export interface OfferPdfData {
  vendor: {
    companyName: string
    address: string | null
    email: string | null
    phone: string | null
    website: string | null
  }
  logoDataUri: string | null
  /** Markenfarbe (Hex) fuer Akzente; null = Forevr-Standard (Schwarz). */
  brandColor?: string | null
  offer: {
    lineItems: LineItem[]
    subtotal: number
    taxMode: TaxMode
    taxRate: number
    taxAmount: number
    total: number
    currency: string
    validUntil: string | null
    footerNote: string
    vendorNotes: string
  }
  standardInfo: {
    coupleName?: string | null
    date?: string | null
    location?: string | null
    guestCount?: number | null
  }
  answers: Answer[]
  offerNumber: string
}

// Etablierte Forevr-Palette (vgl. components/pdf/PdfStyles.ts)
const BLACK = '#0F0F0F'
const DARK = '#2D2D2D'
const MID = '#6B6B6B'
const HEADER = '#9CA3AF'
const BORDER = '#D0D0D0'
const ULTRA = '#F5F5F5'
const ALT = '#F8F8F8'

const s = StyleSheet.create({
  // Inhaltsseite
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: DARK, backgroundColor: '#FFFFFF',
    paddingTop: 44, paddingBottom: 50, paddingLeft: 40, paddingRight: 40,
  },

  // Branding-Kopf der Inhaltsseite
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  company: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: BLACK },
  vendorMeta: { fontSize: 8, color: MID, marginTop: 2, lineHeight: 1.4 },
  logo: { width: 110, maxHeight: 50, objectFit: 'contain' },

  sectionLabel: {
    fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLACK, textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 8, marginTop: 16,
  },

  // Positionstabelle (Forevr-Stil: schwarze Kopfzeile, Zebrastreifen)
  table: { borderWidth: 1, borderColor: BORDER, borderStyle: 'solid', borderRadius: 2, overflow: 'hidden' },
  tHeadRow: { flexDirection: 'row', backgroundColor: BLACK },
  tRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: BORDER, borderTopStyle: 'solid' },
  tRowAlt: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: BORDER, borderTopStyle: 'solid', backgroundColor: ALT },
  th: {
    paddingVertical: 6, paddingHorizontal: 8, fontSize: 7, fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.4,
  },
  td: { paddingVertical: 6, paddingHorizontal: 8, fontSize: 9, color: DARK, lineHeight: 1.35 },
  cDesc: { flex: 1 },
  cQty: { width: 50, textAlign: 'right' },
  cUnit: { width: 78, textAlign: 'right' },
  cTotal: { width: 84, textAlign: 'right' },

  // Summenblock
  totalsBox: { marginTop: 12, marginLeft: 'auto', width: 250 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, fontSize: 9.5 },
  grandRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: BLACK, marginTop: 5, paddingTop: 7, backgroundColor: ULTRA,
    paddingHorizontal: 8, paddingBottom: 7,
  },
  grandLabel: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: BLACK },
  grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: BLACK },

  notesText: { fontSize: 9, color: DARK, lineHeight: 1.5 },
  answerRow: { marginBottom: 3, fontSize: 9 },
  answerLabel: { color: MID },

  footerNote: {
    position: 'absolute', bottom: 20, left: 40, right: 100, fontSize: 7.5, color: HEADER,
    fontFamily: 'Helvetica',
  },
})

// Titelfolie-Bausteine (vgl. components/pdf/PdfCoverPage.tsx)
const cover = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: DARK, backgroundColor: '#FFFFFF',
    paddingTop: 40, paddingBottom: 50, paddingLeft: 40, paddingRight: 40,
  },
  badge: { borderWidth: 1, borderColor: BORDER, borderStyle: 'solid', borderRadius: 2, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: DARK, textTransform: 'uppercase', letterSpacing: 0.5 },
  accent: { width: 40, height: 3, backgroundColor: BLACK, marginBottom: 16 },
  title: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: BLACK, letterSpacing: -0.3, lineHeight: 1.15, marginBottom: 8 },
  subtitle: { fontSize: 12, color: MID, marginBottom: 24 },
  grid: { borderWidth: 1, borderColor: BORDER, borderStyle: 'solid', marginBottom: 10 },
  gridRow: { flexDirection: 'row' },
  gridRowTop: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: 'solid' },
  cell: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  cellBorder: { borderRightWidth: 1, borderRightColor: BORDER, borderRightStyle: 'solid' },
  cellLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: HEADER, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  cellValue: { fontSize: 10, color: DARK, lineHeight: 1.35 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontSize: 8, color: MID },
})

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return typeof d === 'string' ? d : '—'
  return dt.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function PageNumber() {
  return (
    <Text
      fixed
      style={{ position: 'absolute', bottom: 20, right: 40, fontSize: 8, color: HEADER, fontFamily: 'Helvetica' }}
      render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
    />
  )
}

function RunningHeader({ title }: { title: string }) {
  return (
    <View
      fixed
      style={{ position: 'absolute', top: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <Text style={{ fontSize: 8, color: HEADER, fontFamily: 'Helvetica' }}>{title}</Text>
      <Text style={{ fontSize: 8, color: HEADER, fontFamily: 'Helvetica' }}>{`Angebot · ${fmtDate(new Date().toISOString())}`}</Text>
    </View>
  )
}

function CoverPage({ data }: { data: OfferPdfData }) {
  const { vendor, offer, standardInfo, logoDataUri, offerNumber } = data
  const coupleName = standardInfo.coupleName || '—'
  const accent = data.brandColor || BLACK

  return (
    <Page size="A4" orientation="portrait" style={cover.page}>
      {/* Eyebrow-Badges + optionales Logo */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={cover.badge}><Text style={cover.badgeText}>Angebot</Text></View>
          <View style={cover.badge}><Text style={cover.badgeText}>{`Nr. ${offerNumber}`}</Text></View>
        </View>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {logoDataUri ? <Image src={logoDataUri} style={s.logo} /> : null}
      </View>

      {/* Hauptinhalt — vertikal zentriert */}
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 16 }}>
        <View style={[cover.accent, { backgroundColor: accent }]} />
        <Text style={cover.title}>{vendor.companyName}</Text>
        <Text style={cover.subtitle}>{`Angebot für ${coupleName}`}</Text>

        {/* Info-Grid — die drei Kerninfos zuerst */}
        <View style={cover.grid}>
          <View style={cover.gridRow}>
            <View style={[cover.cell, cover.cellBorder]}>
              <Text style={cover.cellLabel}>Datum</Text>
              <Text style={cover.cellValue}>{fmtDate(standardInfo.date)}</Text>
            </View>
            <View style={[cover.cell, cover.cellBorder]}>
              <Text style={cover.cellLabel}>Brautpaar</Text>
              <Text style={cover.cellValue}>{coupleName}</Text>
            </View>
            <View style={cover.cell}>
              <Text style={cover.cellLabel}>Dienstleister</Text>
              <Text style={cover.cellValue}>{vendor.companyName}</Text>
            </View>
          </View>
          <View style={cover.gridRowTop}>
            <View style={[cover.cell, cover.cellBorder]}>
              <Text style={cover.cellLabel}>Ort</Text>
              <Text style={cover.cellValue}>{standardInfo.location || '—'}</Text>
            </View>
            <View style={[cover.cell, cover.cellBorder]}>
              <Text style={cover.cellLabel}>Gäste</Text>
              <Text style={cover.cellValue}>{standardInfo.guestCount ? String(standardInfo.guestCount) : '—'}</Text>
            </View>
            <View style={cover.cell}>
              <Text style={cover.cellLabel}>Gültig bis</Text>
              <Text style={cover.cellValue}>{fmtDate(offer.validUntil)}</Text>
            </View>
          </View>
        </View>

        {/* Meta-Zeile */}
        <View style={cover.metaRow}>
          <Text style={cover.metaText}>{`Erstellt am ${fmtDate(new Date().toISOString())}`}</Text>
          <Text style={cover.metaText}>{`Gesamtsumme: ${formatMoney(offer.total, offer.currency || 'EUR')}`}</Text>
        </View>
      </View>

      <PageNumber />
    </Page>
  )
}

function OfferDocument(data: OfferPdfData) {
  const { vendor, offer, standardInfo, answers, offerNumber, logoDataUri } = data
  const cur = offer.currency || 'EUR'
  const accent = data.brandColor || BLACK
  const headerTitle = `${vendor.companyName} – Angebot ${offerNumber}`

  return (
    <Document
      title={`Angebot ${offerNumber}`}
      author={vendor.companyName}
      subject={`Angebot für ${standardInfo.coupleName ?? ''}`.trim()}
      creator="Forevr Event Management"
    >
      {/* Titelfolie */}
      <CoverPage data={data} />

      {/* Inhaltsseite */}
      <Page size="A4" style={s.page}>
        <RunningHeader title={headerTitle} />

        {/* Branding-Kopf */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.company}>{vendor.companyName}</Text>
            {vendor.address ? <Text style={s.vendorMeta}>{vendor.address}</Text> : null}
            <Text style={s.vendorMeta}>{[vendor.email, vendor.phone, vendor.website].filter(Boolean).join('  ·  ')}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logoDataUri ? <Image src={logoDataUri} style={s.logo} /> : null}
        </View>

        {/* Positionen */}
        <Text style={s.sectionLabel}>Positionen</Text>
        <View style={s.table}>
          <View style={[s.tHeadRow, { backgroundColor: accent }]}>
            <Text style={[s.th, s.cDesc]}>Position</Text>
            <Text style={[s.th, s.cQty]}>Menge</Text>
            <Text style={[s.th, s.cUnit]}>Einzel</Text>
            <Text style={[s.th, s.cTotal]}>Summe</Text>
          </View>
          {offer.lineItems.length === 0 ? (
            <View style={s.tRow}><Text style={[s.td, s.cDesc]}>Keine Positionen.</Text></View>
          ) : offer.lineItems.map((li, i) => (
            <View style={i % 2 === 1 ? s.tRowAlt : s.tRow} key={i}>
              <Text style={[s.td, s.cDesc]}>{li.label}</Text>
              <Text style={[s.td, s.cQty]}>{li.type === 'flat' ? '—' : li.qty}</Text>
              <Text style={[s.td, s.cUnit]}>{formatMoney(li.unitPrice, cur)}</Text>
              <Text style={[s.td, s.cTotal]}>{formatMoney(li.total, cur)}</Text>
            </View>
          ))}
        </View>

        {/* Summen */}
        <View style={s.totalsBox}>
          <View style={s.totalsRow}><Text>Zwischensumme</Text><Text>{formatMoney(offer.subtotal, cur)}</Text></View>
          {offer.taxMode === 'regular' ? (
            <View style={s.totalsRow}><Text>{`zzgl. USt. (${offer.taxRate}%)`}</Text><Text>{formatMoney(offer.taxAmount, cur)}</Text></View>
          ) : null}
          <View style={[s.grandRow, { borderTopColor: accent }]}>
            <Text style={s.grandLabel}>Gesamt</Text>
            <Text style={[s.grandValue, { color: accent }]}>{formatMoney(offer.total, cur)}</Text>
          </View>
          {offer.taxMode === 'kleinunternehmer' ? (
            <Text style={[s.vendorMeta, { marginTop: 6 }]}>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</Text>
          ) : null}
        </View>

        {/* Anmerkungen */}
        {offer.vendorNotes ? (
          <View>
            <Text style={s.sectionLabel}>Anmerkungen</Text>
            <Text style={s.notesText}>{offer.vendorNotes}</Text>
          </View>
        ) : null}

        {/* Eure Angaben */}
        {answers.length > 0 ? (
          <View>
            <Text style={s.sectionLabel}>Eure Angaben</Text>
            {answers.map((a, i) => (
              <View style={s.answerRow} key={i}>
                <Text><Text style={s.answerLabel}>{`${a.label}: `}</Text>{a.display}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={s.footerNote} fixed>
          {offer.footerNote || 'Dieses Angebot ist freibleibend und unverbindlich.'}
        </Text>
        <PageNumber />
      </Page>
    </Document>
  )
}

export async function renderOfferPdf(data: OfferPdfData): Promise<Buffer> {
  return renderToBuffer(<OfferDocument {...data} />)
}
