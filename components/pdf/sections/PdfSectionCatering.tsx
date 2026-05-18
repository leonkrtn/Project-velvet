import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
}

const SERVICE_STYLE_MAP: Record<string, string> = {
  klassisch: 'Klassisch (mehrgängig)',
  buffet: 'Buffet',
  family: 'Family Style',
  foodtruck: 'Food Truck',
  live: 'Live-Cooking',
}

export default function PdfSectionCatering({ data, mode }: Props) {
  const { cateringPlan, cateringCosts, mealCounts, allergyCounts, confirmedGuestCount, event } = data

  const totalMeals = Object.values(mealCounts).reduce((s, v) => s + v, 0)
  const kinderMenus = (cateringPlan?.kinder_meal_options ?? []).length
  const allergyCount = Object.values(allergyCounts).reduce((s, v) => s + v, 0)

  return (
    <Page size="A4" orientation="portrait" style={S.page}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionHeaderText}>Catering & Menü</Text>
      </View>

      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{confirmedGuestCount}</Text>
          <Text style={S.statLabel}>Best. Gäste</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>
            {cateringPlan?.service_style ? SERVICE_STYLE_MAP[cateringPlan.service_style] ?? cateringPlan.service_style : '—'}
          </Text>
          <Text style={S.statLabel}>Service-Stil</Text>
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
          {/* Service & Organisation */}
          <Text style={S.subHeader}>Service & Organisation</Text>
          <View style={S.kvGrid2}>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Service-Stil</Text>
              <Text style={S.kvValue}>
                {SERVICE_STYLE_MAP[cateringPlan.service_style ?? ''] ?? cateringPlan.service_style ?? '—'}
              </Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Ort hat Küche</Text>
              <Text style={S.kvValue}>{cateringPlan.location_has_kitchen ? 'Ja' : 'Nein'}</Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Sektempfang</Text>
              <Text style={S.kvValue}>
                {cateringPlan.sektempfang ? `Ja${cateringPlan.sektempfang_note ? ` — ${cateringPlan.sektempfang_note}` : ''}` : 'Nein'}
              </Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Weinbegleitung</Text>
              <Text style={S.kvValue}>
                {cateringPlan.weinbegleitung ? `Ja${cateringPlan.weinbegleitung_note ? ` — ${cateringPlan.weinbegleitung_note}` : ''}` : 'Nein'}
              </Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Mitternachtssnack</Text>
              <Text style={S.kvValue}>
                {cateringPlan.midnight_snack ? `Ja${cateringPlan.midnight_snack_note ? ` — ${cateringPlan.midnight_snack_note}` : ''}` : 'Nein'}
              </Text>
            </View>
            <View style={S.kvItem}>
              <Text style={S.kvLabel}>Service-Personal</Text>
              <Text style={S.kvValue}>{cateringPlan.service_staff ? 'Ja' : 'Nein'}</Text>
            </View>
            {cateringPlan.equipment_needed.length > 0 && (
              <View style={{ width: '100%' }}>
                <Text style={S.kvLabel}>Benötigtes Equipment</Text>
                <Text style={S.kvValue}>{cateringPlan.equipment_needed.join(', ')}</Text>
              </View>
            )}
          </View>

          {/* Drinks */}
          {cateringPlan.drinks_selection.length > 0 && (
            <>
              <Text style={S.subHeader}>Getränke</Text>
              <View style={S.kvGrid2}>
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Auswahl</Text>
                  <Text style={S.kvValue}>{cateringPlan.drinks_selection.join(', ')}</Text>
                </View>
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Abrechnung</Text>
                  <Text style={S.kvValue}>{cateringPlan.drinks_billing || '—'}</Text>
                </View>
              </View>
            </>
          )}

          {/* Menu courses */}
          {cateringPlan.menu_courses.length > 0 && (
            <>
              <Text style={S.subHeader}>Menügänge</Text>
              {cateringPlan.menu_courses.map((course, ci) => (
                <View key={course.id} style={{ marginBottom: 10 }} wrap={false}>
                  <Text style={[S.kvLabel, { marginBottom: 4 }]}>Gang {ci + 1}: {course.name}</Text>
                  <View style={S.table}>
                    <View style={S.tableHeaderRow}>
                      <Text style={[S.tableCellHeader, { width: 100 }]}>Menüoption</Text>
                      <Text style={[S.tableCellHeader, { flex: 1 }]}>Beschreibung</Text>
                    </View>
                    {Object.entries(course.descriptions).map(([opt, desc], i) => (
                      <View key={opt} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                        <Text style={[S.tableCell, { width: 100, fontFamily: 'Helvetica-Bold' }]}>{opt}</Text>
                        <Text style={[S.tableCell, { flex: 1 }]}>{desc || '—'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Dietary stats */}
          {(Object.keys(mealCounts).length > 0 || Object.keys(allergyCounts).length > 0) && (
            <>
              <Text style={S.subHeader}>Ernährung & Allergien</Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {Object.keys(mealCounts).length > 0 && (
                  <View style={{ flex: 1 }}>
                    <View style={S.table}>
                      <View style={S.tableHeaderRow}>
                        <Text style={[S.tableCellHeader, { flex: 2 }]}>Menüwahl</Text>
                        <Text style={[S.tableCellHeader, { width: 40, textAlign: 'right' }]}>Anzahl</Text>
                      </View>
                      {Object.entries(mealCounts).map(([opt, cnt], i) => (
                        <View key={opt} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                          <Text style={[S.tableCell, { flex: 2 }]}>{opt}</Text>
                          <Text style={[S.tableCell, { width: 40, textAlign: 'right' }]}>{cnt}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {Object.keys(allergyCounts).length > 0 && (
                  <View style={{ flex: 1 }}>
                    <View style={S.table}>
                      <View style={S.tableHeaderRow}>
                        <Text style={[S.tableCellHeader, { flex: 2 }]}>Allergen / Diät</Text>
                        <Text style={[S.tableCellHeader, { width: 40, textAlign: 'right' }]}>Anzahl</Text>
                      </View>
                      {Object.entries(allergyCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([tag, cnt], i) => (
                        <View key={tag} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                          <Text style={[S.tableCell, { flex: 2 }]}>{tag}</Text>
                          <Text style={[S.tableCell, { width: 40, textAlign: 'right' }]}>{cnt}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Costs — intern only */}
          {mode === 'intern' && cateringCosts.length > 0 && (
            <>
              <Text style={S.subHeader}>Kosten</Text>
              <View style={S.table}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Kategorie</Text>
                  <Text style={[S.tableCellHeader, { width: 80, textAlign: 'right' }]}>Pro Person</Text>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Notizen</Text>
                </View>
                {cateringCosts.map((c, i) => (
                  <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCell, { flex: 2 }]}>{c.category}</Text>
                    <Text style={[S.tableCell, { width: 80, textAlign: 'right' }]}>
                      {c.price_per_person.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={[S.tableCell, { flex: 2 }]}>{c.notes ?? '—'}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      ) : (
        <Text style={[S.muted, S.small]}>Kein Catering-Plan konfiguriert.</Text>
      )}

      <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  )
}
