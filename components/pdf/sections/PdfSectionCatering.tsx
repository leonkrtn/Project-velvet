import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import { PageHeader, SectionTitle, PageFooter } from '../PdfShared'
import type { PdfEventData, PdfMode } from '../PdfTypes'
import { allergyLabel } from '@/lib/text'

interface Props {
  data: PdfEventData
  mode: PdfMode
  sectionIndex: number
  headerTitle: string
  exportTimestamp: string
}

function fmtMoney(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PdfSectionCatering({ data, mode, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { cateringPlan, cateringCosts, mealCounts, allergyCounts, confirmedGuestCount } = data

  const gangCount      = (cateringPlan?.menu_courses ?? []).length
  const allergyCount   = Object.values(allergyCounts).reduce((s, v) => s + v, 0)
  const kinderMenus    = (cateringPlan?.kinder_meal_options ?? []).length

  return (
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Catering & Menü" />

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{confirmedGuestCount}</Text>
          <Text style={S.statLabel}>Best. Gäste</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{gangCount}</Text>
          <Text style={S.statLabel}>Gänge</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{allergyCount}</Text>
          <Text style={S.statLabel}>Allergien / Diäten</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{kinderMenus}</Text>
          <Text style={S.statLabel}>Kinder-Menüs</Text>
        </View>
      </View>

      {cateringPlan ? (
        <>
          {/* Two-column: Service & Organisation left, Getränke + Kosten right */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 4 }}>
            {/* Left: Service & Organisation */}
            <View style={{ flex: 1 }}>
              <Text style={S.subHeader}>Service & Organisation</Text>
              <View style={[S.kvGrid, { marginTop: 8 }]}>
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Ort hat Küche</Text>
                  <Text style={S.kvValue}>{cateringPlan.location_has_kitchen ? 'Ja' : 'Nein'}</Text>
                </View>
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Service-Personal</Text>
                  <Text style={S.kvValue}>{cateringPlan.service_staff ? 'Ja' : 'Nein'}</Text>
                </View>
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Sektempfang</Text>
                  <Text style={S.kvValue}>
                    {cateringPlan.sektempfang
                      ? `Ja${cateringPlan.sektempfang_note ? ` – ${cateringPlan.sektempfang_note}` : ''}`
                      : 'Nein'}
                  </Text>
                </View>
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Weinbegleitung</Text>
                  <Text style={S.kvValue}>
                    {cateringPlan.weinbegleitung
                      ? `Ja${cateringPlan.weinbegleitung_note ? ` – ${cateringPlan.weinbegleitung_note}` : ''}`
                      : 'Nein'}
                  </Text>
                </View>
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Mitternachtssnack</Text>
                  <Text style={S.kvValue}>
                    {cateringPlan.midnight_snack
                      ? `Ja${cateringPlan.midnight_snack_note ? ` – ${cateringPlan.midnight_snack_note}` : ''}`
                      : 'Nein'}
                  </Text>
                </View>
                {(cateringPlan.equipment_needed ?? []).length > 0 && (
                  <View style={{ width: '100%' }}>
                    <Text style={S.kvLabel}>Benötigtes Equipment</Text>
                    <Text style={S.kvValue}>{cateringPlan.equipment_needed.join(', ')}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Right: Getränke + Kosten pro Person */}
            <View style={{ flex: 1 }}>
              {(cateringPlan.drinks_selection ?? []).length > 0 && (
                <>
                  <Text style={S.subHeader}>Getränke</Text>
                  <View style={[S.kvGrid, { marginTop: 8 }]}>
                    <View style={S.kvItem}>
                      <Text style={S.kvLabel}>Auswahl</Text>
                      <Text style={S.kvValue}>{cateringPlan.drinks_selection.join(', ')}</Text>
                    </View>
                    {cateringPlan.drinks_billing && (
                      <View style={S.kvItem}>
                        <Text style={S.kvLabel}>Abrechnung</Text>
                        <Text style={S.kvValue}>{cateringPlan.drinks_billing}</Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              {mode === 'intern' && cateringCosts.length > 0 && (
                <>
                  <Text style={S.subHeader}>Kosten pro Person</Text>
                  <View style={[S.table, { marginTop: 8 }]}>
                    <View style={S.tableHeaderRow}>
                      <Text style={[S.tableCellHeader, { flex: 2 }]}>Kategorie</Text>
                      <Text style={[S.tableCellHeader, { width: 60, textAlign: 'right' }]}>€ / Pers.</Text>
                    </View>
                    {cateringCosts.map((c, i) => (
                      <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                        <Text style={[S.tableCell, { flex: 2 }]}>{c.category}</Text>
                        <Text style={[S.tableCell, { width: 60, textAlign: 'right' }]}>
                          {fmtMoney(c.price_per_person)}
                        </Text>
                      </View>
                    ))}
                    <View style={S.tableRowTotal}>
                      <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>Gesamt</Text>
                      <Text style={[S.tableCell, { width: 60, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                        {fmtMoney(cateringCosts.reduce((s, c) => s + c.price_per_person, 0))}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Menügänge — full width, merged-cell-style gang names */}
          {(cateringPlan.menu_courses ?? []).length > 0 && (
            <>
              <Text style={S.subHeader}>Menügänge</Text>
              <View style={[S.table, { marginTop: 8 }]}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Gang</Text>
                  <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Menüoption</Text>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Beschreibung</Text>
                </View>
                {(cateringPlan.menu_courses ?? []).map((course, ci) => {
                  const options = Object.entries(course.descriptions)
                  return options.map(([opt, desc], oi) => {
                    const rowIndex = ci * options.length + oi
                    return (
                      <View key={`${course.id}-${opt}`} style={rowIndex % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                        <Text style={[S.tableCell, { flex: 1.5 }]}>
                          {oi === 0 ? `${ci + 1} – ${course.name}` : ''}
                        </Text>
                        <Text style={[S.tableCell, { flex: 1.5 }]}>{opt}</Text>
                        <Text style={[S.tableCell, { flex: 2 }]}>{desc || '—'}</Text>
                      </View>
                    )
                  })
                })}
              </View>
            </>
          )}
        </>
      ) : (
        <Text style={S.mutedItalic}>Kein Catering-Plan konfiguriert.</Text>
      )}

      <PageFooter />
    </Page>
  )
}
