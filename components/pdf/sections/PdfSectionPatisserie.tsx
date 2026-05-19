import { Page, View, Text } from '@react-pdf/renderer'
import { S } from '../PdfStyles'
import { PageHeader, SectionTitle, PageFooter } from '../PdfShared'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
  sectionIndex: number
  headerTitle: string
  exportTimestamp: string
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PdfSectionPatisserie({ data, mode, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const p = data.patisserieConfig

  return (
    <Page size="A4" orientation="portrait" style={S.page}>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Patisserie & Torte" />

      {p ? (
        <>
          {/* Stats */}
          <View style={S.statRow}>
            <View style={S.statBox}>
              <Text style={S.statValue}>{p.layers}</Text>
              <Text style={S.statLabel}>Etagen</Text>
            </View>
            <View style={S.statBox}>
              <Text style={S.statValue}>{p.dessert_buffet ? 'Ja' : 'Nein'}</Text>
              <Text style={S.statLabel}>Dessertbuffet</Text>
            </View>
            <View style={S.statBox}>
              <Text style={S.statValue}>{p.delivery_date || '—'}</Text>
              <Text style={S.statLabel}>Lieferdatum</Text>
            </View>
          </View>

          {/* Two-column: Tortendetails left, Kosten right */}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={S.subHeader}>Tortendetails</Text>
              <View style={[S.kvGrid, { marginTop: 8 }]}>
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Etagen</Text>
                  <Text style={S.kvValue}>{p.layers}</Text>
                </View>
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Aromen</Text>
                  <Text style={S.kvValue}>{(p.flavors ?? []).length > 0 ? p.flavors.join(', ') : '—'}</Text>
                </View>
                <View style={{ width: '100%' }}>
                  <Text style={S.kvLabel}>Diätetische Anforderungen</Text>
                  <Text style={S.kvValue}>{p.dietary_notes || 'Keine'}</Text>
                </View>
                {p.cake_description && (
                  <View style={{ width: '100%' }}>
                    <Text style={S.kvLabel}>Beschreibung</Text>
                    <Text style={S.kvValue}>{p.cake_description}</Text>
                  </View>
                )}
              </View>
            </View>

            {mode === 'intern' && p.price > 0 && (
              <View style={{ flex: 1 }}>
                <Text style={S.subHeader}>Kosten</Text>
                <View style={[S.table, { marginTop: 8 }]}>
                  <View style={S.tableHeaderRow}>
                    <Text style={[S.tableCellHeader, { flex: 2 }]}>Position</Text>
                    <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Betrag (€)</Text>
                  </View>
                  <View style={S.tableRow}>
                    <Text style={[S.tableCell, { flex: 2 }]}>Torte</Text>
                    <Text style={[S.tableCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                      {fmtMoney(p.price)}
                    </Text>
                  </View>
                </View>
                {p.vendor_notes && (
                  <>
                    <Text style={S.kvLabel}>Dienstleisternotizen</Text>
                    <Text style={S.kvValue}>{p.vendor_notes}</Text>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Logistik & Lieferung */}
          <Text style={S.subHeader}>Logistik & Lieferung</Text>
          <View style={[S.kvGrid, { marginTop: 8 }]}>
            <View style={S.kvItem3}>
              <Text style={S.kvLabel}>Lieferdatum</Text>
              <Text style={S.kvValue}>{p.delivery_date || '—'}</Text>
            </View>
            <View style={S.kvItem3}>
              <Text style={S.kvLabel}>Uhrzeit</Text>
              <Text style={S.kvValue}>{p.delivery_time ? `${p.delivery_time} Uhr` : '—'}</Text>
            </View>
            <View style={S.kvItem3}>
              <Text style={S.kvLabel}>Aufstellungsort</Text>
              <Text style={S.kvValue}>{p.setup_location || '—'}</Text>
            </View>
            <View style={S.kvItem3}>
              <Text style={S.kvLabel}>Tortentisch</Text>
              <Text style={S.kvValue}>{p.cake_table_provided ? 'Wird gestellt' : 'Wird benötigt'}</Text>
            </View>
            <View style={S.kvItem3}>
              <Text style={S.kvLabel}>Kühlung erforderlich</Text>
              <Text style={S.kvValue}>
                {p.cooling_required
                  ? `Ja${p.cooling_notes ? ` – ${p.cooling_notes}` : ''}`
                  : 'Nein'}
              </Text>
            </View>
          </View>

          {/* Dessertbuffet */}
          {p.dessert_buffet && (p.dessert_items ?? []).length > 0 && (
            <>
              <Text style={S.subHeader}>Dessertbuffet</Text>
              <View style={[S.kvGrid, { marginTop: 8 }]}>
                {p.dessert_items.map((item, i) => (
                  <Text key={i} style={[S.kvValue, { width: '100%' }]}>· {item}</Text>
                ))}
              </View>
            </>
          )}
        </>
      ) : (
        <Text style={S.mutedItalic}>Keine Patisserie-Konfiguration vorhanden.</Text>
      )}

      <PageFooter />
    </Page>
  )
}
