import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import { PageHeader, SectionTitle, PageFooter } from '../PdfShared'
import type { PdfEventData } from '../PdfTypes'

interface Props {
  data: PdfEventData
  sectionIndex: number
  headerTitle: string
  exportTimestamp: string
}

export default function PdfSectionMedien({ data, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { mediaBriefing, mediaShotItems } = data

  const mustHave  = mediaShotItems.filter(s => s.type === 'must_have').sort((a, b) => a.sort_order - b.sort_order)
  const optional  = mediaShotItems.filter(s => s.type === 'optional').sort((a, b) => a.sort_order - b.sort_order)
  const forbidden = mediaShotItems.filter(s => s.type === 'forbidden').sort((a, b) => a.sort_order - b.sort_order)

  // Group must_have by category for the 3-col table
  const byCategory = new Map<string, typeof mustHave>()
  for (const s of mustHave) {
    const cat = s.category || 'Allgemein'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(s)
  }

  return (
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Medien & Fotografie" />

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{mustHave.length}</Text>
          <Text style={S.statLabel}>Pflicht-Shots</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{optional.length}</Text>
          <Text style={S.statLabel}>Optionale Shots</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{forbidden.length}</Text>
          <Text style={S.statLabel}>Verboten</Text>
        </View>
      </View>

      {/* Briefing */}
      {mediaBriefing && (
        <>
          <Text style={S.subHeader}>Briefing</Text>
          <View style={[S.kvGrid, { marginTop: 8 }]}>
            {mediaBriefing.photo_briefing && (
              <View style={{ width: '100%' }}>
                <Text style={S.kvLabel}>Foto-Briefing</Text>
                <Text style={S.kvValue}>{mediaBriefing.photo_briefing}</Text>
              </View>
            )}
            {mediaBriefing.video_briefing && (
              <View style={{ width: '100%' }}>
                <Text style={S.kvLabel}>Video-Briefing</Text>
                <Text style={S.kvValue}>{mediaBriefing.video_briefing}</Text>
              </View>
            )}
            {mediaBriefing.upload_instructions && (
              <View style={S.kvItem}>
                <Text style={S.kvLabel}>Upload-Anleitung</Text>
                <Text style={S.kvValue}>{mediaBriefing.upload_instructions}</Text>
              </View>
            )}
            {mediaBriefing.delivery_deadline && (
              <View style={S.kvItem}>
                <Text style={S.kvLabel}>Abgabe-Frist</Text>
                <Text style={S.kvValue}>{mediaBriefing.delivery_deadline}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Shot list — must have, grouped by category (3 columns: category / title / description) */}
      <Text style={S.subHeader}>Shot-Liste – Pflicht-Aufnahmen</Text>
      {mustHave.length > 0 ? (
        <View style={[S.table, { marginTop: 8 }]}>
          <View style={S.tableHeaderRow}>
            <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Zeremonie-Abschnitt</Text>
            <Text style={[S.tableCellHeader, { flex: 2 }]}>Aufnahme</Text>
            <Text style={[S.tableCellHeader, { flex: 3 }]}>Beschreibung</Text>
          </View>
          {(() => {
            let rowIdx = 0
            return Array.from(byCategory.entries()).map(([cat, shots]) =>
              shots.map((s, i) => {
                const idx = rowIdx++
                return (
                  <View key={s.id} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCell, { flex: 1.5 }]}>{i === 0 ? cat : ''}</Text>
                    <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{s.title}</Text>
                    <Text style={[S.tableCell, { flex: 3 }]}>{s.description || '—'}</Text>
                  </View>
                )
              })
            )
          })()}
        </View>
      ) : (
        <Text style={[S.mutedItalic, { marginTop: 6 }]}>Keine Pflicht-Aufnahmen erfasst.</Text>
      )}

      {/* Optional shots */}
      <Text style={S.subHeader}>Optionale Shots</Text>
      {optional.length > 0 ? (
        <View style={[S.table, { marginTop: 8 }]}>
          <View style={S.tableHeaderRow}>
            <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Aufnahme</Text>
            <Text style={[S.tableCellHeader, { width: 70 }]}>Kategorie</Text>
            <Text style={[S.tableCellHeader, { flex: 3 }]}>Beschreibung</Text>
          </View>
          {optional.map((s, i) => (
            <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={[S.tableCell, { flex: 1.5, fontFamily: 'Helvetica-Bold' }]}>{s.title}</Text>
              <Text style={[S.tableCell, { width: 70 }]}>{s.category || '—'}</Text>
              <Text style={[S.tableCell, { flex: 3 }]}>{s.description || '—'}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[S.mutedItalic, { marginTop: 6 }]}>Keine optionalen Shots erfasst.</Text>
      )}

      {/* Forbidden */}
      <Text style={S.subHeader}>Verbotene Aufnahmen</Text>
      {forbidden.length > 0 ? (
        <View style={[S.table, { marginTop: 8 }]}>
          <View style={S.tableHeaderRow}>
            <Text style={[S.tableCellHeader, { flex: 2 }]}>Aufnahme</Text>
            <Text style={[S.tableCellHeader, { flex: 3 }]}>Begründung</Text>
          </View>
          {forbidden.map((s, i) => (
            <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={[S.tableCell, { flex: 2, color: COLORS.red }]}>{s.title}</Text>
              <Text style={[S.tableCell, { flex: 3 }]}>{s.description || '—'}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[S.mutedItalic, { marginTop: 6 }]}>Keine Einschränkungen erfasst.</Text>
      )}

      <PageFooter />
    </Page>
  )
}
