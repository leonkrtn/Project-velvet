import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData } from '../PdfTypes'

const TYPE_COLORS: Record<string, string> = {
  must_have: COLORS.green,
  optional:  COLORS.blue,
  forbidden: COLORS.red,
}
const TYPE_LABELS: Record<string, string> = {
  must_have: 'Pflicht',
  optional:  'Optional',
  forbidden: 'Verboten',
}

export default function PdfSectionMedien({ data }: { data: PdfEventData }) {
  const { mediaBriefing, mediaShotItems } = data

  const mustHave  = mediaShotItems.filter(s => s.type === 'must_have')
  const optional  = mediaShotItems.filter(s => s.type === 'optional')
  const forbidden = mediaShotItems.filter(s => s.type === 'forbidden')

  // Group must_have by category
  const byCategory = new Map<string, typeof mustHave>()
  for (const s of mustHave) {
    const cat = s.category || 'Allgemein'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(s)
  }

  return (
    <Page size="A4" orientation="portrait" style={S.page}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionHeaderText}>Medien & Fotografie</Text>
      </View>

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={[S.statValue, { color: COLORS.green }]}>{mustHave.length}</Text>
          <Text style={S.statLabel}>Pflicht-Shots</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{optional.length}</Text>
          <Text style={S.statLabel}>Optionale Shots</Text>
        </View>
        <View style={S.statBox}>
          <Text style={[S.statValue, { color: COLORS.red }]}>{forbidden.length}</Text>
          <Text style={S.statLabel}>Verboten</Text>
        </View>
      </View>

      {/* Briefing */}
      {mediaBriefing && (
        <>
          <Text style={S.subHeader}>Briefing</Text>
          <View style={S.kvGrid2}>
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
            {mediaBriefing.photo_restrictions && (
              <View style={{ width: '100%' }}>
                <Text style={S.kvLabel}>Einschränkungen</Text>
                <Text style={[S.kvValue, { color: COLORS.red }]}>{mediaBriefing.photo_restrictions}</Text>
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

      {/* Shot list — must have, grouped by category */}
      {mustHave.length > 0 && (
        <>
          <Text style={S.subHeader}>Shot-Liste — Pflicht-Aufnahmen</Text>
          {Array.from(byCategory.entries()).map(([cat, shots]) => (
            <View key={cat} style={{ marginBottom: 10 }} wrap={false}>
              <Text style={[S.kvLabel, { marginBottom: 4 }]}>{cat}</Text>
              <View style={S.table}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { flex: 2 }]}>Aufnahme</Text>
                  <Text style={[S.tableCellHeader, { flex: 3 }]}>Beschreibung</Text>
                </View>
                {shots.map((s, i) => (
                  <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{s.title}</Text>
                    <Text style={[S.tableCell, { flex: 3 }]}>{s.description || '—'}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      )}

      {/* Optional shots */}
      {optional.length > 0 && (
        <>
          <Text style={S.subHeader}>Shot-Liste — Optionale Aufnahmen</Text>
          <View style={S.table}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Aufnahme</Text>
              <Text style={[S.tableCellHeader, { width: 60 }]}>Kategorie</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Beschreibung</Text>
            </View>
            {optional.map((s, i) => (
              <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[S.tableCell, { flex: 1.5 }]}>{s.title}</Text>
                <Text style={[S.tableCell, { width: 60 }]}>{s.category || '—'}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{s.description || '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Forbidden */}
      {forbidden.length > 0 && (
        <>
          <Text style={S.subHeader}>Verboten / Unerwünscht</Text>
          <View style={S.table}>
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
        </>
      )}

      {mediaShotItems.length === 0 && !mediaBriefing && (
        <Text style={[S.muted, S.small]}>Kein Medien-Briefing vorhanden.</Text>
      )}

      <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  )
}
