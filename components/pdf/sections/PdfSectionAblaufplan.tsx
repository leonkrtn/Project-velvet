import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import { PageHeader, SectionTitle, PageFooter } from '../PdfShared'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
  sectionIndex: number
  headerTitle: string
  exportTimestamp: string
}

const CATEGORY_BG: Record<string, string> = {
  Zeremonie: '#DBEAFE',
  Empfang:   '#DCFCE7',
  Feier:     '#EDE9FE',
  Logistik:  '#F3F4F6',
}
const CATEGORY_COLOR: Record<string, string> = {
  Zeremonie: '#1D4ED8',
  Empfang:   '#15803D',
  Feier:     '#7C3AED',
  Logistik:  '#6B7280',
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
  return m > 0 ? `${h} h ${m} min` : `${h} h`
}

function getDayDate(eventDate: string | null, dayIndex: number) {
  if (!eventDate) return null
  const d = new Date(eventDate)
  d.setDate(d.getDate() + dayIndex)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PdfSectionAblaufplan({ data, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { timelineEntries, ablaufplanDays, event } = data

  const days = ablaufplanDays.length > 0
    ? [...ablaufplanDays].sort((a, b) => a.day_index - b.day_index)
    : [{ id: 'default', day_index: 0, name: 'Veranstaltungstag', start_hour: 8, end_hour: 24 }]

  const entriesByDay = new Map<number, typeof timelineEntries>()
  for (const d of days) entriesByDay.set(d.day_index, [])
  for (const e of timelineEntries) {
    const idx = e.day_index ?? 0
    if (!entriesByDay.has(idx)) entriesByDay.set(idx, [])
    entriesByDay.get(idx)!.push(e)
  }

  return (
    <>
      {days.map((day, di) => {
        const entries = (entriesByDay.get(day.day_index) ?? [])
          .sort((a, b) => (a.start_minutes ?? 9999) - (b.start_minutes ?? 9999))

        const dayDateStr = getDayDate(event.date, day.day_index)
        const dayLabel = days.length > 1
          ? `TAG ${day.day_index + 1} · ${dayDateStr || day.name}`.toUpperCase()
          : dayDateStr
            ? `TAG 1 · ${dayDateStr}`.toUpperCase()
            : day.name.toUpperCase()

        return (
          <Page key={day.id} size="A4" orientation="portrait" style={S.page} wrap>
            <PageHeader title={headerTitle} timestamp={exportTimestamp} />

            {di === 0 && <SectionTitle index={sectionIndex} title="Ablaufplan" />}

            {di === 0 && (
              <View style={S.statRow}>
                <View style={S.statBox}>
                  <Text style={S.statValue}>{days.length}</Text>
                  <Text style={S.statLabel}>Tage</Text>
                </View>
                <View style={S.statBox}>
                  <Text style={S.statValue}>{timelineEntries.length}</Text>
                  <Text style={S.statLabel}>Einträge gesamt</Text>
                </View>
                <View style={S.statBox}>
                  <Text style={S.statValue}>{timelineEntries.filter(e => e.category === 'Zeremonie').length}</Text>
                  <Text style={S.statLabel}>Zeremonie-Einträge</Text>
                </View>
              </View>
            )}

            {/* Day header */}
            <Text style={[S.subHeader, di === 0 ? {} : { marginTop: 0 }]}>{dayLabel}</Text>

            {entries.length > 0 ? (
              <View style={[S.table, { marginTop: 8 }]}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { width: 44 }]}>Zeit</Text>
                  <Text style={[S.tableCellHeader, { width: 52 }]}>Dauer</Text>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Titel</Text>
                  <Text style={[S.tableCellHeader, { width: 68 }]}>Kategorie</Text>
                  <Text style={[S.tableCellHeader, { flex: 1 }]}>Ort</Text>
                  <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Zugewiesen an</Text>
                  <Text style={[S.tableCellHeader, { width: 50 }]}>Checklist</Text>
                </View>
                {entries.map((e, i) => {
                  const assigned = [
                    ...e.assigned_staff.map(s => s.name),
                    ...e.assigned_vendors.map(v => v.name),
                    ...e.assigned_members.map(m => m.name),
                  ].join(', ')
                  const done = e.checklist.filter(c => c.done).length
                  const catBg    = CATEGORY_BG[e.category ?? ''] ?? COLORS.ultraLight
                  const catColor = CATEGORY_COLOR[e.category ?? ''] ?? COLORS.midGray

                  return (
                    <View key={e.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt} wrap={false}>
                      <Text style={[S.tableCell, { width: 44, fontFamily: 'Helvetica-Bold' }]}>
                        {minsToTime(e.start_minutes)}
                      </Text>
                      <Text style={[S.tableCell, { width: 52 }]}>
                        {fmtDuration(e.duration_minutes)}
                      </Text>
                      <Text style={[S.tableCell, { flex: 2 }]}>{e.title ?? '—'}</Text>
                      <View style={[S.tableCell, { width: 68, justifyContent: 'center' }]}>
                        {e.category ? (
                          <View style={{ backgroundColor: catBg, borderRadius: 2, paddingVertical: 1, paddingHorizontal: 4, alignSelf: 'flex-start' }}>
                            <Text style={{ fontSize: 7, color: catColor, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                              {e.category}
                            </Text>
                          </View>
                        ) : (
                          <Text style={S.muted}>—</Text>
                        )}
                      </View>
                      <Text style={[S.tableCell, { flex: 1 }]}>{e.location ?? '—'}</Text>
                      <Text style={[S.tableCell, { flex: 1.5 }]}>{assigned || '—'}</Text>
                      <Text style={[S.tableCell, { width: 50, textAlign: 'center' }]}>
                        {e.checklist.length > 0 ? `${done}/${e.checklist.length}` : '—'}
                      </Text>
                    </View>
                  )
                })}
              </View>
            ) : (
              <Text style={S.mutedItalic}>Keine Einträge für diesen Tag.</Text>
            )}

            <PageFooter />
          </Page>
        )
      })}
    </>
  )
}
