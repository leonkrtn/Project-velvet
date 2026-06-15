import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import { PageHeader, SectionTitle, PageFooter, StatusBadge } from '../PdfShared'
import type { PdfEventData, PdfMode } from '../PdfTypes'
import { allergyLabel } from '@/lib/text'

interface Props {
  data: PdfEventData
  mode: PdfMode
  sectionIndex: number
  headerTitle: string
  exportTimestamp: string
}

function rsvpBadge(status: string) {
  if (status === 'zugesagt') return { label: 'Zugesagt', bg: COLORS.green, color: COLORS.white }
  if (status === 'abgesagt') return { label: 'Abgesagt', bg: COLORS.red, color: COLORS.white }
  return { label: 'Begleit.', bg: COLORS.lightGray, color: COLORS.darkGray }
}

export default function PdfSectionGaesteliste({ data, mode, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { guests, begleitpersonen, event, mealCounts, allergyCounts } = data

  const zugesagt = guests.filter(g => g.status === 'zugesagt').length
  const abgesagt = guests.filter(g => g.status === 'abgesagt').length
  const offen = guests.length - zugesagt - abgesagt
  const confirmedIds = new Set(guests.filter(g => g.status === 'zugesagt').map(g => g.id))
  const confirmedBegleit = begleitpersonen.filter(b => confirmedIds.has(b.guest_id))

  const begleitByGuest = new Map<string, typeof begleitpersonen>()
  for (const b of begleitpersonen) {
    if (!begleitByGuest.has(b.guest_id)) begleitByGuest.set(b.guest_id, [])
    begleitByGuest.get(b.guest_id)!.push(b)
  }

  const sortedGuests = [...guests].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const mealOptions = event.meal_options ?? []

  // Compact cell padding for many-column portrait table
  const tc = { paddingVertical: 5, paddingHorizontal: 6, fontSize: 8, color: COLORS.darkGray, lineHeight: 1.3 }
  const th = { paddingVertical: 5, paddingHorizontal: 6, fontSize: 7, fontFamily: 'Helvetica-Bold', color: COLORS.white, textTransform: 'uppercase' as const, letterSpacing: 0.4 }

  return (
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Gästeliste" />

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{guests.length}</Text>
          <Text style={S.statLabel}>Gesamt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{zugesagt}</Text>
          <Text style={S.statLabel}>Zugesagt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{abgesagt}</Text>
          <Text style={S.statLabel}>Abgesagt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{offen}</Text>
          <Text style={S.statLabel}>Offen</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{confirmedBegleit.length}</Text>
          <Text style={S.statLabel}>Best. Begleit.</Text>
        </View>
      </View>

      {/* Main guest table */}
      <Text style={S.subHeader}>Gästeliste</Text>
      <View style={[S.table, { marginTop: 8 }]}>
        <View style={S.tableHeaderRow}>
          <Text style={[th, { flex: 2 }]}>Name</Text>
          <Text style={[th, { width: 46 }]}>Seite</Text>
          <Text style={[th, { width: 68 }]}>RSVP</Text>
          <Text style={[th, { flex: 1 }]}>Menü</Text>
          <Text style={[th, { flex: 1.5 }]}>Allergien / Diät</Text>
          {mode === 'intern' && <Text style={[th, { flex: 1.2 }]}>Notizen</Text>}
        </View>
        {sortedGuests.map((g, i) => {
          const begleit = begleitByGuest.get(g.id) ?? []
          const allergies = [
            ...(g.allergy_tags ?? []).map(allergyLabel),
            ...(g.allergy_custom ? [g.allergy_custom] : []),
          ].join(', ')
          const badge = rsvpBadge(g.status)

          return (
            <View key={g.id} wrap={false}>
              <View style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[tc, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{g.name}</Text>
                <Text style={[tc, { width: 46 }]}>{g.side ?? '—'}</Text>
                <View style={[{ width: 68 }, tc, { justifyContent: 'center' }]}>
                  <StatusBadge label={badge.label} bg={badge.bg} color={badge.color} />
                </View>
                <Text style={[tc, { flex: 1 }]}>{g.meal_choice ?? '—'}</Text>
                <Text style={[tc, { flex: 1.5 }]}>{allergies || '—'}</Text>
                {mode === 'intern' && <Text style={[tc, { flex: 1.2 }]}>{g.notes ?? '—'}</Text>}
              </View>
              {begleit.map((b, bi) => {
                const ba = [
                  ...(b.allergy_tags ?? []).map(allergyLabel),
                  ...(b.allergy_custom ? [b.allergy_custom] : []),
                ].join(', ')
                return (
                  <View key={b.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[{ flex: 2 }, tc, { color: COLORS.midGray, fontStyle: 'italic' }]}>{'  └ '}{b.name}</Text>
                    <Text style={[tc, { width: 46 }]}>—</Text>
                    <View style={[{ width: 68 }, tc, { justifyContent: 'center' }]}>
                      <StatusBadge label="Begleit." bg={COLORS.lightGray} color={COLORS.darkGray} />
                    </View>
                    <Text style={[tc, { flex: 1 }]}>{b.meal_choice ?? '—'}</Text>
                    <Text style={[tc, { flex: 1.5 }]}>{ba || '—'}</Text>
                    {mode === 'intern' && <Text style={[tc, { flex: 1.2 }]}>—</Text>}
                  </View>
                )
              })}
            </View>
          )
        })}
      </View>

      {/* Menüwahl + Allergien side by side */}
      {(mealOptions.length > 0 || Object.keys(allergyCounts).length > 0) && (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {mealOptions.length > 0 && Object.keys(mealCounts).length > 0 && (
            <View style={{ flex: 1 }}>
              <Text style={S.subHeader}>Menüwahl</Text>
              <View style={[S.table, { marginTop: 8 }]}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Option</Text>
                  <Text style={[S.tableCellHeader, { width: 50, textAlign: 'right' }]}>Anzahl</Text>
                </View>
                {Object.entries(mealCounts).map(([opt, cnt], i) => (
                  <View key={opt} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCell, { flex: 2 }]}>{opt}</Text>
                    <Text style={[S.tableCell, { width: 50, textAlign: 'right' }]}>{cnt}</Text>
                  </View>
                ))}
                <View style={S.tableRowTotal}>
                  <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>Gesamt</Text>
                  <Text style={[S.tableCell, { width: 50, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                    {Object.values(mealCounts).reduce((s, v) => s + v, 0)}
                  </Text>
                </View>
              </View>
            </View>
          )}
          {Object.keys(allergyCounts).length > 0 && (
            <View style={{ flex: 1 }}>
              <Text style={S.subHeader}>Allergien & Diäten</Text>
              <View style={[S.table, { marginTop: 8 }]}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Allergen / Diät</Text>
                  <Text style={[S.tableCellHeader, { width: 50, textAlign: 'right' }]}>Anzahl</Text>
                </View>
                {Object.entries(allergyCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tag, cnt], i) => (
                    <View key={tag} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                      <Text style={[S.tableCell, { flex: 2 }]}>{allergyLabel(tag)}</Text>
                      <Text style={[S.tableCell, { width: 50, textAlign: 'right' }]}>{cnt}</Text>
                    </View>
                  ))}
              </View>
            </View>
          )}
        </View>
      )}

      <PageFooter />
    </Page>
  )
}
