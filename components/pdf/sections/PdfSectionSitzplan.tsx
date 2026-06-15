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

function tableStatus(assigned: number, capacity: number) {
  if (assigned === 0) return { label: 'Leer', bg: COLORS.black, color: COLORS.white }
  if (assigned >= capacity) return { label: 'Voll', bg: COLORS.green, color: COLORS.white }
  return { label: 'Teilweise', bg: COLORS.amber, color: COLORS.white }
}

export default function PdfSectionSitzplan({ data, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { seatingTables, seatingAssignments, guests, begleitpersonen, coupleName } = data

  const guestMap   = new Map(guests.map(g => [g.id, g]))
  const begleitMap = new Map(begleitpersonen.map(b => [b.id, b]))

  const totalCapacity  = seatingTables.reduce((s, t) => s + t.capacity, 0)
  const placedCount    = seatingAssignments.length
  const confirmedGuests  = guests.filter(g => g.status === 'zugesagt').length
  const confirmedBegleit = begleitpersonen.filter(b => guestMap.get(b.guest_id)?.status === 'zugesagt').length
  const guestSeated    = seatingAssignments.filter(a => a.brautpaar_slot == null).length
  const unplaced       = Math.max(0, (confirmedGuests + confirmedBegleit) - guestSeated)

  const assignmentsByTable = new Map<string, typeof seatingAssignments>()
  for (const t of seatingTables) assignmentsByTable.set(t.id, [])
  for (const a of seatingAssignments) assignmentsByTable.get(a.table_id)?.push(a)

  return (
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Sitzplan" />

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{seatingTables.length}</Text>
          <Text style={S.statLabel}>Tische</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{totalCapacity}</Text>
          <Text style={S.statLabel}>Kapazität</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{placedCount}</Text>
          <Text style={S.statLabel}>Platziert</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{unplaced}</Text>
          <Text style={S.statLabel}>Ohne Platz</Text>
        </View>
      </View>

      {/* Tischübersicht */}
      {seatingTables.length > 0 ? (
        <>
          <Text style={S.subHeader}>Tischübersicht</Text>
          <View style={[S.table, { marginTop: 8 }]}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Tisch</Text>
              <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Belegt</Text>
              <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Kapazität</Text>
              <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Frei</Text>
              <Text style={[S.tableCellHeader, { flex: 1 }]}>Status</Text>
            </View>
            {seatingTables.map((t, i) => {
              const assignments = assignmentsByTable.get(t.id) ?? []
              const free = t.capacity - assignments.length
              const st = tableStatus(assignments.length, t.capacity)
              return (
                <View key={t.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tableCell, { flex: 2 }]}>{t.name}</Text>
                  <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{assignments.length}</Text>
                  <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{t.capacity}</Text>
                  <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{free}</Text>
                  <View style={[S.tableCell, { flex: 1, justifyContent: 'center' }]}>
                    <StatusBadge label={st.label} bg={st.bg} color={st.color} />
                  </View>
                </View>
              )
            })}
          </View>

          {/* Tischzuweisungen */}
          <Text style={S.subHeader}>Tischzuweisungen</Text>
          <View style={{ marginTop: 8 }}>
            {seatingTables.map((t) => {
              const assignments = assignmentsByTable.get(t.id) ?? []
              if (assignments.length === 0) {
                return (
                  <Text key={t.id} style={[S.mutedItalic, { marginBottom: 4 }]}>
                    {`Keine Gäste zugewiesen. Alle ${t.capacity} Plätze an ${t.name} sind noch frei.`}
                  </Text>
                )
              }

              const rows: Array<{ label: string; extra: string; muted?: boolean }> = []
              for (const a of assignments) {
                if (a.brautpaar_slot != null) {
                  const parts = coupleName?.split(' & ') ?? []
                  const slotName = a.brautpaar_slot === 1
                    ? (parts[0] || 'Brautpaar 1')
                    : (parts[1] || parts[0] || 'Brautpaar 2')
                  rows.push({ label: slotName, extra: '(Brautpaar)' })
                } else if (a.guest_id) {
                  const g = guestMap.get(a.guest_id)
                  if (g) rows.push({
                    label: g.name,
                    extra: [g.meal_choice, ...(g.allergy_tags ?? []).map(allergyLabel)].filter(Boolean).join(', '),
                  })
                } else if (a.begleitperson_id) {
                  const b = begleitMap.get(a.begleitperson_id)
                  if (b) rows.push({
                    label: `  └ ${b.name}`,
                    extra: [b.meal_choice, ...(b.allergy_tags ?? []).map(allergyLabel)].filter(Boolean).join(', '),
                    muted: true,
                  })
                }
              }

              return (
                <View key={t.id} style={{ marginBottom: 12 }} wrap={false}>
                  <View style={{
                    backgroundColor: COLORS.lightGray,
                    paddingVertical: 5, paddingHorizontal: 8,
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.black }}>
                      {t.name}
                    </Text>
                    <Text style={{ fontSize: 8, color: COLORS.midGray }}>
                      {assignments.length}/{t.capacity} Plätze
                    </Text>
                  </View>
                  <View style={{
                    borderWidth: 1, borderTopWidth: 0,
                    borderColor: COLORS.border, borderStyle: 'solid',
                  }}>
                    {rows.map((r, ri) => (
                      <View key={ri} style={{
                        flexDirection: 'row',
                        borderTopWidth: ri === 0 ? 0 : 0.5,
                        borderTopColor: COLORS.border, borderTopStyle: 'solid',
                        paddingVertical: 4, paddingHorizontal: 8,
                        backgroundColor: ri % 2 === 0 ? COLORS.white : COLORS.ultraLight,
                      }}>
                        <Text style={{ flex: 1, fontSize: 8, color: r.muted ? COLORS.midGray : COLORS.darkGray, fontStyle: r.muted ? 'italic' : 'normal' }}>
                          {r.label}
                        </Text>
                        {r.extra ? (
                          <Text style={{ fontSize: 7, color: COLORS.midGray, maxWidth: 100 }}>{r.extra}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              )
            })}
          </View>
        </>
      ) : (
        <Text style={S.mutedItalic}>Keine Tische konfiguriert.</Text>
      )}

      <PageFooter />
    </Page>
  )
}
