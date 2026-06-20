// Server-only: rendert ein Angebots-PDF mit @react-pdf/renderer.
// Bewusst ohne Custom-Font-Registrierung (nutzt eingebautes Helvetica), damit
// kein Laufzeit-Fontdownload fehlschlagen kann. Dienstleister-Branding ueber
// Firmenname + optionales Logo; faellt ohne Logo sauber auf Text zurueck.
import 'server-only'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer'
import { formatMoney, type Answer, type TaxMode } from './questionnaire'
import type { LineItem } from './pricing'

export interface OfferPdfData {
  vendor: {
    companyName: string
    address: string | null
    email: string | null
    phone: string | null
    website: string | null
  }
  logoDataUri: string | null
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

const GOLD = '#B89968'
const INK = '#1c1c1c'
const DIM = '#6b6b6b'
const RULE = '#e2ddd4'

const s = StyleSheet.create({
  page: { padding: 44, fontSize: 10, color: INK, fontFamily: 'Helvetica', lineHeight: 1.5 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  logo: { width: 120, maxHeight: 56, objectFit: 'contain' },
  company: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: INK },
  vendorMeta: { fontSize: 9, color: DIM, marginTop: 2 },
  docTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: GOLD, letterSpacing: 1, marginTop: 24 },
  docSub: { fontSize: 9, color: DIM, marginTop: 2 },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginVertical: 14 },
  twoCol: { flexDirection: 'row', justifyContent: 'space-between', gap: 24 },
  col: { flex: 1 },
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: DIM, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  kv: { flexDirection: 'row', marginBottom: 2 },
  kvLabel: { width: 70, color: DIM },
  kvValue: { flex: 1, color: INK },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 4, marginTop: 6 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: RULE, paddingVertical: 5 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 44, textAlign: 'right' },
  cUnit: { width: 70, textAlign: 'right' },
  cTotal: { width: 78, textAlign: 'right' },
  totalsBox: { marginTop: 10, marginLeft: 'auto', width: 240 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: INK, marginTop: 4, paddingTop: 5 },
  grandLabel: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: GOLD },
  notes: { marginTop: 16, fontSize: 9, color: INK },
  answerRow: { marginBottom: 3 },
  answerLabel: { color: DIM },
  footer: { position: 'absolute', bottom: 28, left: 44, right: 44, fontSize: 7.5, color: DIM, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
})

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function OfferDocument(data: OfferPdfData) {
  const { vendor, offer, standardInfo, answers, offerNumber, logoDataUri } = data
  const cur = offer.currency || 'EUR'

  return (
    <Document title={`Angebot ${offerNumber}`} author={vendor.companyName}>
      <Page size="A4" style={s.page}>
        {/* Kopf: Branding */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.company}>{vendor.companyName}</Text>
            {vendor.address ? <Text style={s.vendorMeta}>{vendor.address}</Text> : null}
            <Text style={s.vendorMeta}>
              {[vendor.email, vendor.phone, vendor.website].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
          {logoDataUri ? <Image src={logoDataUri} style={s.logo} /> : null}
        </View>

        <Text style={s.docTitle}>ANGEBOT</Text>
        <Text style={s.docSub}>Nr. {offerNumber}  ·  erstellt am {fmtDate(new Date().toISOString())}</Text>

        <View style={s.rule} />

        {/* Empfaenger + Eckdaten */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.sectionLabel}>Fuer</Text>
            <View style={s.kv}><Text style={s.kvLabel}>Anlass</Text><Text style={s.kvValue}>{standardInfo.coupleName ?? '—'}</Text></View>
            <View style={s.kv}><Text style={s.kvLabel}>Datum</Text><Text style={s.kvValue}>{fmtDate(standardInfo.date)}</Text></View>
            <View style={s.kv}><Text style={s.kvLabel}>Ort</Text><Text style={s.kvValue}>{standardInfo.location ?? '—'}</Text></View>
            {standardInfo.guestCount ? <View style={s.kv}><Text style={s.kvLabel}>Gaeste</Text><Text style={s.kvValue}>{String(standardInfo.guestCount)}</Text></View> : null}
          </View>
          <View style={s.col}>
            <Text style={s.sectionLabel}>Konditionen</Text>
            <View style={s.kv}><Text style={s.kvLabel}>Gueltig bis</Text><Text style={s.kvValue}>{fmtDate(offer.validUntil)}</Text></View>
            <View style={s.kv}><Text style={s.kvLabel}>Waehrung</Text><Text style={s.kvValue}>{cur}</Text></View>
          </View>
        </View>

        {/* Positionen */}
        <View style={s.tableHead}>
          <Text style={[s.th, s.cDesc]}>Position</Text>
          <Text style={[s.th, s.cQty]}>Menge</Text>
          <Text style={[s.th, s.cUnit]}>Einzel</Text>
          <Text style={[s.th, s.cTotal]}>Summe</Text>
        </View>
        {offer.lineItems.length === 0 ? (
          <View style={s.tr}><Text style={s.cDesc}>Keine Positionen.</Text></View>
        ) : offer.lineItems.map((li, i) => (
          <View style={s.tr} key={i}>
            <Text style={s.cDesc}>{li.label}</Text>
            <Text style={s.cQty}>{li.qty}</Text>
            <Text style={s.cUnit}>{formatMoney(li.unitPrice, cur)}</Text>
            <Text style={s.cTotal}>{formatMoney(li.total, cur)}</Text>
          </View>
        ))}

        {/* Summen */}
        <View style={s.totalsBox}>
          <View style={s.totalsRow}><Text>Zwischensumme</Text><Text>{formatMoney(offer.subtotal, cur)}</Text></View>
          {offer.taxMode === 'regular' ? (
            <View style={s.totalsRow}><Text>zzgl. USt. ({offer.taxRate}%)</Text><Text>{formatMoney(offer.taxAmount, cur)}</Text></View>
          ) : null}
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>Gesamt</Text>
            <Text style={s.grandValue}>{formatMoney(offer.total, cur)}</Text>
          </View>
          {offer.taxMode === 'kleinunternehmer' ? (
            <Text style={[s.vendorMeta, { marginTop: 6 }]}>Gemaess §19 UStG wird keine Umsatzsteuer berechnet.</Text>
          ) : null}
        </View>

        {offer.vendorNotes ? (
          <View style={s.notes}>
            <Text style={s.sectionLabel}>Anmerkungen</Text>
            <Text>{offer.vendorNotes}</Text>
          </View>
        ) : null}

        {/* Zusammenfassung des Bedarfs */}
        {answers.length > 0 ? (
          <View style={s.notes}>
            <Text style={s.sectionLabel}>Eure Angaben</Text>
            {answers.map((a, i) => (
              <View style={s.answerRow} key={i}>
                <Text><Text style={s.answerLabel}>{a.label}: </Text>{a.display}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>{offer.footerNote || 'Dieses Angebot ist freibleibend und unverbindlich.'}</Text>
          <Text>Erstellt mit Forevr</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderOfferPdf(data: OfferPdfData): Promise<Buffer> {
  return renderToBuffer(<OfferDocument {...data} />)
}
