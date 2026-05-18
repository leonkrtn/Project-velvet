import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
}

function fmtMoney(n: number) {
  if (!n) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
}

export default function PdfSectionPatisserie({ data, mode }: Props) {
  const p = data.patisserieConfig

  return (
    <Page size="A4" orientation="portrait" style={S.page}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionHeaderText}>Patisserie & Torte</Text>
      </View>

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

          {/* Tortendetails */}
          <Text style={S.subHeader}>Tortendetails</Text>
          <View style={S.kvGrid2}>
            {p.cake_description && (
              <View style={{ width: '100%' }}>
                <Text style={S.kvLabel}>Beschreibung</Text>
                <Text style={S.kvValue}>{p.cake_description}</Text>
              </View>
            )}
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Etagen</Text>
              <Text style={S.kvValue}>{p.layers}</Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Aromen</Text>
              <Text style={S.kvValue}>{p.flavors.length > 0 ? p.flavors.join(', ') : '—'}</Text>
            </View>
            <View style={{ width: '100%' }}>
              <Text style={S.kvLabel}>Diätetische Anforderungen</Text>
              <Text style={S.kvValue}>{p.dietary_notes || 'Keine'}</Text>
            </View>
          </View>

          {/* Logistik */}
          <Text style={S.subHeader}>Logistik & Lieferung</Text>
          <View style={S.kvGrid2}>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Lieferdatum</Text>
              <Text style={S.kvValue}>{p.delivery_date || '—'}</Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Uhrzeit</Text>
              <Text style={S.kvValue}>{p.delivery_time ? `${p.delivery_time} Uhr` : '—'}</Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Kühlung erforderlich</Text>
              <Text style={S.kvValue}>
                {p.cooling_required
                  ? `Ja${p.cooling_notes ? ` — ${p.cooling_notes}` : ''}`
                  : 'Nein'}
              </Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Aufstellungsort</Text>
              <Text style={S.kvValue}>{p.setup_location || '—'}</Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Tortentisch</Text>
              <Text style={S.kvValue}>{p.cake_table_provided ? 'Wird gestellt' : 'Wird benötigt'}</Text>
            </View>
          </View>

          {/* Dessertbuffet */}
          {p.dessert_buffet && p.dessert_items.length > 0 && (
            <>
              <Text style={S.subHeader}>Dessertbuffet</Text>
              <View style={{
                backgroundColor: COLORS.ultraLight,
                borderWidth: 1, borderColor: COLORS.border, borderStyle: 'solid',
                borderRadius: 3, padding: 10, marginBottom: 14,
              }}>
                {p.dessert_items.map((item, i) => (
                  <Text key={i} style={{ fontSize: 9, color: COLORS.darkGray, marginBottom: 2 }}>
                    • {item}
                  </Text>
                ))}
              </View>
            </>
          )}

          {/* Kosten — intern only */}
          {mode === 'intern' && (p.price > 0 || p.vendor_notes) && (
            <>
              <Text style={S.subHeader}>Kosten & Dienstleisternotizen</Text>
              <View style={S.kvGrid2}>
                {p.price > 0 && (
                  <View style={S.kvItem}>
                    <Text style={S.kvLabel}>Preis</Text>
                    <Text style={[S.kvValue, { fontFamily: 'Helvetica-Bold' }]}>{fmtMoney(p.price)}</Text>
                  </View>
                )}
                {p.vendor_notes && (
                  <View style={{ width: '100%' }}>
                    <Text style={S.kvLabel}>Dienstleisternotizen</Text>
                    <Text style={S.kvValue}>{p.vendor_notes}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </>
      ) : (
        <Text style={[S.muted, S.small]}>Keine Patisserie-Konfiguration vorhanden.</Text>
      )}

      <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  )
}
