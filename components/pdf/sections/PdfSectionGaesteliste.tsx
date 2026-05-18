import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
}

function allergyLabel(tag: string) {
  const map: Record<string, string> = {
    gluten: 'Gluten', lactose: 'Laktose', nuts: 'Nüsse', egg: 'Eier',
    fish: 'Fisch', shellfish: 'Schalentiere', soy: 'Soja', vegetarian: 'Vegetarisch',
    vegan: 'Vegan', halal: 'Halal', kosher: 'Koscher',
  }
  return map[tag] || tag
}

function statusColor(status: string) {
  if (status === 'zugesagt') return COLORS.green
  if (status === 'abgesagt') return COLORS.red
  return '#9CA3AF'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    zugesagt: 'Zugesagt', abgesagt: 'Abgesagt',
    eingeladen: 'Eingeladen', angelegt: 'Angelegt',
  }
  return map[status] || status
}

export default function PdfSectionGaesteliste({ data, mode }: Props) {
  const { guests, begleitpersonen, event } = data

  const zugesagt = guests.filter(g => g.status === 'zugesagt').length
  const abgesagt = guests.filter(g => g.status === 'abgesagt').length
  const offen = guests.length - zugesagt - abgesagt

  // Count begleitpersonen of confirmed guests
  const confirmedIds = new Set(guests.filter(g => g.status === 'zugesagt').map(g => g.id))
  const confirmedBegleit = begleitpersonen.filter(b => confirmedIds.has(b.guest_id))

  // Meal counts
  const mealCounts: Record<string, number> = {}
  for (const g of guests.filter(g => g.status === 'zugesagt')) {
    if (g.meal_choice) mealCounts[g.meal_choice] = (mealCounts[g.meal_choice] ?? 0) + 1
  }
  for (const b of confirmedBegleit) {
    if (b.meal_choice) mealCounts[b.meal_choice] = (mealCounts[b.meal_choice] ?? 0) + 1
  }

  // Allergy counts
  const allergyCounts: Record<string, number> = {}
  for (const g of guests.filter(g => g.status === 'zugesagt')) {
    for (const tag of (g.allergy_tags ?? [])) {
      allergyCounts[tag] = (allergyCounts[tag] ?? 0) + 1
    }
  }
  for (const b of confirmedBegleit) {
    for (const tag of (b.allergy_tags ?? [])) {
      allergyCounts[tag] = (allergyCounts[tag] ?? 0) + 1
    }
  }

  const mealOptions = event.meal_options ?? []

  // Build begleit map
  const begleitByGuest = new Map<string, typeof begleitpersonen>()
  for (const b of begleitpersonen) {
    if (!begleitByGuest.has(b.guest_id)) begleitByGuest.set(b.guest_id, [])
    begleitByGuest.get(b.guest_id)!.push(b)
  }

  const sortedGuests = [...guests].sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return (
    <Page size="A4" orientation="landscape" style={S.pageLandscape}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionHeaderText}>Gästeliste</Text>
      </View>

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{guests.length}</Text>
          <Text style={S.statLabel}>Gesamt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={[S.statValue, { color: COLORS.green }]}>{zugesagt}</Text>
          <Text style={S.statLabel}>Zugesagt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={[S.statValue, { color: COLORS.red }]}>{abgesagt}</Text>
          <Text style={S.statLabel}>Abgesagt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{offen}</Text>
          <Text style={S.statLabel}>Offen</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{begleitpersonen.length}</Text>
          <Text style={S.statLabel}>Begleitpersonen</Text>
        </View>
      </View>

      {/* Meal + Allergy stats side by side */}
      {(mealOptions.length > 0 || Object.keys(allergyCounts).length > 0) && (
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
          {mealOptions.length > 0 && Object.keys(mealCounts).length > 0 && (
            <View style={{ flex: 1 }}>
              <Text style={S.subHeader}>Menüwahl</Text>
              <View style={S.table}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Option</Text>
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
              <Text style={S.subHeader}>Allergien & Ernährung</Text>
              <View style={S.table}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Kategorie</Text>
                  <Text style={[S.tableCellHeader, { width: 40, textAlign: 'right' }]}>Anzahl</Text>
                </View>
                {Object.entries(allergyCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tag, cnt], i) => (
                  <View key={tag} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCell, { flex: 2 }]}>{allergyLabel(tag)}</Text>
                    <Text style={[S.tableCell, { width: 40, textAlign: 'right' }]}>{cnt}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Main guest table */}
      <Text style={S.subHeader}>Gästeliste</Text>
      <View style={S.table}>
        <View style={S.tableHeaderRow}>
          <Text style={[S.tableCellHeader, { flex: 2 }]}>Name</Text>
          <Text style={[S.tableCellHeader, { width: 55 }]}>Seite</Text>
          <Text style={[S.tableCellHeader, { width: 58 }]}>RSVP</Text>
          <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Menü</Text>
          <Text style={[S.tableCellHeader, { flex: 2 }]}>Allergien</Text>
          {mode === 'intern' && <Text style={[S.tableCellHeader, { flex: 1 }]}>Notizen</Text>}
        </View>
        {sortedGuests.map((g, i) => {
          const begleit = begleitByGuest.get(g.id) ?? []
          const allergies = [
            ...(g.allergy_tags ?? []).map(allergyLabel),
            ...(g.allergy_custom ? [g.allergy_custom] : [])
          ].join(', ')

          return (
            <View key={g.id} wrap={false}>
              {/* Guest row */}
              <View style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{g.name}</Text>
                <Text style={[S.tableCell, { width: 55 }]}>{g.side ?? '—'}</Text>
                <View style={[{ width: 58 }, S.tableCell, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  <View style={{
                    width: 6, height: 6, borderRadius: 1,
                    backgroundColor: statusColor(g.status),
                    flexShrink: 0,
                  }} />
                  <Text style={{ fontSize: 9 }}>{statusLabel(g.status)}</Text>
                </View>
                <Text style={[S.tableCell, { flex: 1.5 }]}>{g.meal_choice ?? '—'}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{allergies || '—'}</Text>
                {mode === 'intern' && <Text style={[S.tableCell, { flex: 1 }]}>{g.notes ?? '—'}</Text>}
              </View>

              {/* Begleitpersonen rows */}
              {begleit.map((b, bi) => {
                const ba = [
                  ...(b.allergy_tags ?? []).map(allergyLabel),
                  ...(b.allergy_custom ? [b.allergy_custom] : [])
                ].join(', ')
                return (
                  <View key={b.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCellMuted, { flex: 2 }]}>  └ {b.name}</Text>
                    <Text style={[S.tableCellMuted, { width: 55 }]}>—</Text>
                    <Text style={[S.tableCellMuted, { width: 58 }]}>Begleit.</Text>
                    <Text style={[S.tableCellMuted, { flex: 1.5 }]}>{b.meal_choice ?? '—'}</Text>
                    <Text style={[S.tableCellMuted, { flex: 2 }]}>{ba || '—'}</Text>
                    {mode === 'intern' && <Text style={[S.tableCellMuted, { flex: 1 }]}>—</Text>}
                  </View>
                )
              })}
            </View>
          )
        })}
      </View>

      <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  )
}
