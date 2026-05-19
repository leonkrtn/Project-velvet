import { Page, View, Text } from '@react-pdf/renderer'
import { S } from '../PdfStyles'
import { PageHeader, SectionTitle, PageFooter } from '../PdfShared'
import type { PdfEventData } from '../PdfTypes'

interface Props {
  data: PdfEventData
  sectionIndex: number
  headerTitle: string
  exportTimestamp: string
}

export default function PdfSectionMusik({ data, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { musicSongs, musicRequirements } = data

  const wishes          = musicSongs.filter(s => s.type === 'wish')
  const noGos           = musicSongs.filter(s => s.type === 'no_go')
  const playlist        = musicSongs.filter(s => s.type === 'playlist')
  const guestSuggestions = musicSongs.filter(s => s.source === 'gast' && s.type !== 'wish')

  return (
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Musik" />

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{wishes.length}</Text>
          <Text style={S.statLabel}>Wunschliste</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{noGos.length}</Text>
          <Text style={S.statLabel}>No-Gos</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{guestSuggestions.length}</Text>
          <Text style={S.statLabel}>Gast-Vorschläge</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{playlist.length}</Text>
          <Text style={S.statLabel}>Playlist</Text>
        </View>
      </View>

      {/* No-Go-Liste + Technische Anforderungen side by side */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {/* Left: No-Go-Liste */}
        <View style={{ flex: 1 }}>
          <Text style={S.subHeader}>No-Go-Liste</Text>
          {noGos.length > 0 ? (
            <View style={[S.table, { marginTop: 8 }]}>
              <View style={S.tableHeaderRow}>
                <Text style={[S.tableCellHeader, { flex: 2 }]}>Titel</Text>
                <Text style={[S.tableCellHeader, { flex: 2 }]}>Interpret</Text>
              </View>
              {noGos.map((s, i) => (
                <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tableCell, { flex: 2 }]}>{s.title || '—'}</Text>
                  <Text style={[S.tableCell, { flex: 2 }]}>{s.artist || '—'}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[S.mutedItalic, { marginTop: 8 }]}>Keine No-Gos erfasst.</Text>
          )}
        </View>

        {/* Right: Technische Anforderungen */}
        {musicRequirements && (
          <View style={{ flex: 1 }}>
            <Text style={S.subHeader}>Technische Anforderungen</Text>
            <View style={[S.kvGrid, { marginTop: 8 }]}>
              {musicRequirements.soundcheck_date && (
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Soundcheck</Text>
                  <Text style={S.kvValue}>
                    {musicRequirements.soundcheck_date}
                    {musicRequirements.soundcheck_time ? ` · ${musicRequirements.soundcheck_time} Uhr` : ''}
                  </Text>
                </View>
              )}
              {musicRequirements.stage_dimensions && (
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Bühnenmasse</Text>
                  <Text style={S.kvValue}>{musicRequirements.stage_dimensions}</Text>
                </View>
              )}
              {musicRequirements.microphone_count > 0 && (
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Mikrofone</Text>
                  <Text style={S.kvValue}>{musicRequirements.microphone_count}</Text>
                </View>
              )}
              {musicRequirements.power_required && (
                <View style={S.kvItem}>
                  <Text style={S.kvLabel}>Stromversorgung</Text>
                  <Text style={S.kvValue}>{musicRequirements.power_required}</Text>
                </View>
              )}
              {musicRequirements.streaming_needed !== undefined && (
                <View style={{ width: '100%' }}>
                  <Text style={S.kvLabel}>Streaming</Text>
                  <Text style={S.kvValue}>
                    {musicRequirements.streaming_needed
                      ? `Ja${musicRequirements.streaming_notes ? ` – ${musicRequirements.streaming_notes}` : ''}`
                      : 'Nein'}
                  </Text>
                </View>
              )}
              {musicRequirements.pa_notes && (
                <View style={{ width: '100%' }}>
                  <Text style={S.kvLabel}>PA-Anforderungen</Text>
                  <Text style={S.kvValue}>{musicRequirements.pa_notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Playlist */}
      {playlist.length > 0 && (
        <>
          <Text style={S.subHeader}>Playlist</Text>
          <View style={[S.table, { marginTop: 8 }]}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { width: 24 }]}>#</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Titel</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Interpret</Text>
              <Text style={[S.tableCellHeader, { flex: 1 }]}>Moment</Text>
            </View>
            {playlist.map((s, i) => (
              <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[S.tableCell, { width: 24 }]}>{i + 1}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{s.title || '—'}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{s.artist || '—'}</Text>
                <Text style={[S.tableCell, { flex: 1 }]}>{s.moment || '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Gast-Vorschläge */}
      {guestSuggestions.length > 0 && (
        <>
          <Text style={S.subHeader}>Gast-Vorschläge (noch nicht übernommen)</Text>
          <View style={[S.table, { marginTop: 8 }]}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Vorgeschlagen von</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Titel</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Interpret</Text>
            </View>
            {guestSuggestions.map((s, i) => (
              <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[S.tableCell, { flex: 1.5 }]}>{s.suggested_by_guest_name ?? '—'}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{s.title || '—'}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{s.artist || '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <PageFooter />
    </Page>
  )
}
