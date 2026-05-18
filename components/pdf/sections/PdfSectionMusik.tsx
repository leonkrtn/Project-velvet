import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData } from '../PdfTypes'

const MOMENT_ORDER = ['Einzug', 'Zeremonie', 'Sektempfang', 'Abendessen', 'Party', 'Abschluss', 'Allgemein']

export default function PdfSectionMusik({ data }: { data: PdfEventData }) {
  const { musicSongs, musicRequirements } = data

  const wishes   = musicSongs.filter(s => s.type === 'wish')
  const noGos    = musicSongs.filter(s => s.type === 'no_go')
  const playlist = musicSongs.filter(s => s.type === 'playlist')
  // Only show guest suggestions that aren't already in the wish list (avoiding duplicates)
  const guestSuggestions = musicSongs.filter(s => s.source === 'gast' && s.type !== 'wish')

  // Group wishes by moment
  const byMoment = new Map<string, typeof wishes>()
  for (const m of MOMENT_ORDER) byMoment.set(m, [])
  for (const s of wishes) {
    const m = s.moment || 'Allgemein'
    if (!byMoment.has(m)) byMoment.set(m, [])
    byMoment.get(m)!.push(s)
  }

  return (
    <Page size="A4" orientation="portrait" style={S.page}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionHeaderText}>Musik</Text>
      </View>

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{wishes.length}</Text>
          <Text style={S.statLabel}>Wunschliste</Text>
        </View>
        <View style={S.statBox}>
          <Text style={[S.statValue, { color: COLORS.red }]}>{noGos.length}</Text>
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

      {/* Wishes by moment */}
      {wishes.length > 0 && (
        <>
          <Text style={S.subHeader}>Wunschliste nach Moment</Text>
          {Array.from(byMoment.entries())
            .filter(([, songs]) => songs.length > 0)
            .map(([moment, songs]) => (
              <View key={moment} style={{ marginBottom: 10 }} wrap={false}>
                <Text style={[S.kvLabel, { marginBottom: 4 }]}>{moment}</Text>
                <View style={S.table}>
                  <View style={S.tableHeaderRow}>
                    <Text style={[S.tableCellHeader, { flex: 2 }]}>Titel</Text>
                    <Text style={[S.tableCellHeader, { flex: 2 }]}>Interpret</Text>
                    <Text style={[S.tableCellHeader, { flex: 1 }]}>Quelle</Text>
                  </View>
                  {songs.map((s, i) => (
                    <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                      <Text style={[S.tableCell, { flex: 2 }]}>{s.title || '—'}</Text>
                      <Text style={[S.tableCell, { flex: 2 }]}>{s.artist || '—'}</Text>
                      <Text style={[S.tableCell, { flex: 1 }]}>
                        {s.source === 'gast' ? `Gast${s.suggested_by_guest_name ? `: ${s.suggested_by_guest_name}` : ''}` : 'Intern'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
        </>
      )}

      {/* No-go list */}
      {noGos.length > 0 && (
        <>
          <Text style={S.subHeader}>No-Go-Liste</Text>
          <View style={S.table}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Titel</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Interpret</Text>
            </View>
            {noGos.map((s, i) => (
              <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[S.tableCell, { flex: 2, color: COLORS.red }]}>{s.title || '—'}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{s.artist || '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Playlist */}
      {playlist.length > 0 && (
        <>
          <Text style={S.subHeader}>Playlist</Text>
          <View style={S.table}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Titel</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Interpret</Text>
              <Text style={[S.tableCellHeader, { flex: 1 }]}>Moment</Text>
            </View>
            {playlist.map((s, i) => (
              <View key={s.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[S.tableCell, { flex: 2 }]}>{s.title || '—'}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{s.artist || '—'}</Text>
                <Text style={[S.tableCell, { flex: 1 }]}>{s.moment || '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Guest suggestions (only those not already in wish list) */}
      {guestSuggestions.length > 0 && (
        <>
          <Text style={S.subHeader}>Gast-Vorschläge (noch nicht übernommen)</Text>
          <View style={S.table}>
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

      {/* Technical requirements */}
      {musicRequirements && (
        <>
          <Text style={S.subHeader}>Technische Anforderungen</Text>
          <View style={S.kvGrid2}>
            {[
              ['Soundcheck', musicRequirements.soundcheck_date
                ? `${musicRequirements.soundcheck_date}${musicRequirements.soundcheck_time ? ` um ${musicRequirements.soundcheck_time}` : ''}` : null],
              ['PA-Anforderungen', musicRequirements.pa_notes],
              ['Bühnenmaße', musicRequirements.stage_dimensions],
              ['Mikrofone', musicRequirements.microphone_count > 0 ? String(musicRequirements.microphone_count) : null],
              ['Stromversorgung', musicRequirements.power_required],
              ['Streaming', musicRequirements.streaming_needed
                ? `Ja${musicRequirements.streaming_notes ? ` — ${musicRequirements.streaming_notes}` : ''}` : 'Nein'],
            ].map(([label, value]) => value ? (
              <View key={String(label)} style={S.kvItem}>
                <Text style={S.kvLabel}>{label}</Text>
                <Text style={S.kvValue}>{String(value)}</Text>
              </View>
            ) : null)}
          </View>
          {musicRequirements.notes && (
            <View>
              <Text style={S.kvLabel}>Weitere Notizen</Text>
              <Text style={[S.kvValue, { marginBottom: 14 }]}>{musicRequirements.notes}</Text>
            </View>
          )}
        </>
      )}

      <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  )
}
