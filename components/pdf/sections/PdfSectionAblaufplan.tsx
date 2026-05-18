import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
}

const CATEGORY_COLORS: Record<string, string> = {
  Zeremonie: '#1D4ED8',
  Empfang: '#15803D',
  Feier: '#7C3AED',
  Logistik: '#6B6B6B',
}

function minsToTime(mins: number | null) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function fmtDuration(mins: number | null) {
  if (!mins || mins <= 0) return '—'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default function PdfSectionAblaufplan({ data, mode: _mode }: Props) {
  const { timelineEntries, ablaufplanDays } = data

  const days = ablaufplanDays.length > 0
    ? ablaufplanDays.sort((a, b) => a.day_index - b.day_index)
    : [{ id: 'default', day_index: 0, name: 'Veranstaltungstag', start_hour: 8, end_hour: 24 }]

  const entriesByDay = new Map<number, typeof timelineEntries>()
  for (const d of days) entriesByDay.set(d.day_index, [])
  for (const e of timelineEntries) {
    const dayIdx = e.day_index ?? 0
    if (!entriesByDay.has(dayIdx)) entriesByDay.set(dayIdx, [])
    entriesByDay.get(dayIdx)!.push(e)
  }

  const totalEntries = timelineEntries.length

  return (
    <>
      {days.map((day, di) => {
        const entries = (entriesByDay.get(day.day_index) ?? [])
          .sort((a, b) => (a.start_minutes ?? 9999) - (b.start_minutes ?? 9999))

        return (
          <Page key={day.id} size="A4" orientation="portrait" style={S.page} wrap>
            {/* Section header — full black on first page, darker continuation label on subsequent */}
            {di === 0 ? (
              <View style={S.sectionHeader}>
                <Text style={S.sectionHeaderText}>Ablaufplan</Text>
              </View>
            ) : (
              <View style={[S.sectionHeader, { backgroundColor: COLORS.darkGray }]}>
                <Text style={S.sectionHeaderText}>Ablaufplan — Fortsetzung</Text>
              </View>
            )}

            {di === 0 && (
              <View style={S.statRow}>
                <View style={S.statBox}>
                  <Text style={S.statValue}>{days.length}</Text>
                  <Text style={S.statLabel}>Tage</Text>
                </View>
                <View style={S.statBox}>
                  <Text style={S.statValue}>{totalEntries}</Text>
                  <Text style={S.statLabel}>Einträge gesamt</Text>
                </View>
                <View style={S.statBox}>
                  <Text style={S.statValue}>{timelineEntries.filter(e => e.category === 'Zeremonie').length}</Text>
                  <Text style={S.statLabel}>Zeremonie-Einträge</Text>
                </View>
              </View>
            )}

            {/* Day header */}
            <View style={{
              backgroundColor: COLORS.ultraLight,
              borderWidth: 1, borderColor: COLORS.border, borderStyle: 'solid',
              borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12,
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.black }}>
                {days.length > 1 ? `Tag ${day.day_index + 1}: ` : ''}{day.name}
              </Text>
              <Text style={S.muted}>
                {String(day.start_hour).padStart(2, '0')}:00 – {String(day.end_hour).padStart(2, '0')}:00 Uhr
              </Text>
            </View>

            {/* Detail table */}
            {entries.length > 0 ? (
              <View style={S.table}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { width: 42 }]}>Zeit</Text>
                  <Text style={[S.tableCellHeader, { width: 38 }]}>Dauer</Text>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Titel</Text>
                  <Text style={[S.tableCellHeader, { width: 60 }]}>Kategorie</Text>
                  <Text style={[S.tableCellHeader, { flex: 1 }]}>Ort</Text>
                  <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Zugewiesen</Text>
                  <Text style={[S.tableCellHeader, { width: 40 }]}>Checklist</Text>
                </View>
                {entries.map((e, i) => {
                  const assigned = [
                    ...e.assigned_staff.map(s => s.name),
                    ...e.assigned_vendors.map(v => v.name),
                    ...e.assigned_members.map(m => m.name),
                  ].join(', ')
                  const done = e.checklist.filter(c => c.done).length
                  const catColor = CATEGORY_COLORS[e.category ?? ''] ?? COLORS.midGray

                  return (
                    <View key={e.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt} wrap={false}>
                      <Text style={[S.tableCell, { width: 42, fontFamily: 'Helvetica-Bold' }]}>
                        {minsToTime(e.start_minutes)}
                      </Text>
                      <Text style={[S.tableCell, { width: 38 }]}>
                        {fmtDuration(e.duration_minutes)}
                      </Text>
                      <Text style={[S.tableCell, { flex: 2 }]}>{e.title ?? '—'}</Text>
                      <View style={[{ width: 60 }, S.tableCell]}>
                        {e.category ? (
                          <View style={{
                            backgroundColor: `${catColor}20`,
                            borderRadius: 2,
                            paddingVertical: 1, paddingHorizontal: 4,
                            alignSelf: 'flex-start',
                          }}>
                            <Text style={{ fontSize: 7, color: catColor, fontFamily: 'Helvetica-Bold' }}>
                              {e.category}
                            </Text>
                          </View>
                        ) : <Text style={S.muted}>—</Text>}
                      </View>
                      <Text style={[S.tableCell, { flex: 1 }]}>{e.location ?? '—'}</Text>
                      <Text style={[S.tableCell, { flex: 1.5 }]}>{assigned || '—'}</Text>
                      <Text style={[S.tableCell, { width: 40, textAlign: 'center' }]}>
                        {e.checklist.length > 0 ? `${done}/${e.checklist.length}` : '—'}
                      </Text>
                    </View>
                  )
                })}
              </View>
            ) : (
              <Text style={[S.muted, S.small]}>Keine Einträge für diesen Tag.</Text>
            )}

            <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
          </Page>
        )
      })}
    </>
  )
}
