import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from './PdfStyles'
import type { PdfEventData, PdfMode } from './PdfTypes'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

interface Props {
  data: PdfEventData
  mode: PdfMode
}

export default function PdfCoverPage({ data, mode }: Props) {
  const { event } = data
  const venue = event.location_name || event.venue || null
  const city = [event.location_street, event.location_zip, event.location_city].filter(Boolean).join(', ')

  return (
    <Page size="A4" orientation="portrait" style={S.page}>
      {/* Mode badge — top right */}
      <View style={{ position: 'absolute', top: 32, right: 36 }}>
        <Text style={[
          S.badge,
          mode === 'intern'
            ? { backgroundColor: '#0F0F0F', color: '#FFFFFF' }
            : { backgroundColor: '#E8E8E8', color: '#6B6B6B' }
        ]}>
          {mode === 'intern' ? 'Intern' : 'Extern'}
        </Text>
      </View>

      {/* Centered content */}
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
        {/* Top line */}
        <View style={{
          borderBottomWidth: 1,
          borderBottomColor: COLORS.darkGray,
          borderBottomStyle: 'solid',
          marginBottom: 18,
        }} />

        {/* Event title */}
        <Text style={{
          fontSize: 28,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.black,
          letterSpacing: -0.5,
          marginBottom: 8,
          lineHeight: 1.1,
        }}>
          {event.title}
        </Text>

        {/* Couple name */}
        {event.couple_name && (
          <Text style={{ fontSize: 14, color: COLORS.midGray, marginBottom: 20 }}>
            {event.couple_name}
          </Text>
        )}

        {/* Bottom line */}
        <View style={{
          borderBottomWidth: 1,
          borderBottomColor: COLORS.darkGray,
          borderBottomStyle: 'solid',
          marginBottom: 20,
        }} />

        {/* Event details */}
        <View style={{ gap: 5 }}>
          {event.date && (
            <View style={S.row}>
              <Text style={[S.kvLabel, { width: 100 }]}>Datum</Text>
              <Text style={{ fontSize: 11, color: COLORS.darkGray }}>
                {fmtDate(event.date)}
                {event.ceremony_start ? `  ·  ${event.ceremony_start} Uhr` : ''}
              </Text>
            </View>
          )}
          {venue && (
            <View style={S.row}>
              <Text style={[S.kvLabel, { width: 100 }]}>Veranstaltungsort</Text>
              <Text style={{ fontSize: 11, color: COLORS.darkGray }}>{venue}</Text>
            </View>
          )}
          {city && (
            <View style={S.row}>
              <Text style={[S.kvLabel, { width: 100 }]}>Adresse</Text>
              <Text style={{ fontSize: 11, color: COLORS.darkGray }}>{city}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Export date — bottom */}
      <Text style={S.footer}>
        Exportiert am {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
      </Text>
    </Page>
  )
}
