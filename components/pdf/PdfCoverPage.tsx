import { Page, View, Text } from '@react-pdf/renderer'
import { COLORS } from './PdfStyles'
import type { PdfEventData, PdfMode } from './PdfTypes'

function fmtDate(d: string | null | Date) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

const CELL_LABEL = {
  fontSize: 7,
  fontFamily: 'Helvetica-Bold' as const,
  color: COLORS.headerGray,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  marginBottom: 3,
}

const CELL_VALUE = {
  fontSize: 10,
  color: COLORS.darkGray,
  lineHeight: 1.35,
}

const BORDER_RIGHT = {
  borderRightWidth: 1,
  borderRightColor: COLORS.border,
  borderRightStyle: 'solid' as const,
}

const BORDER_TOP = {
  borderTopWidth: 1,
  borderTopColor: COLORS.border,
  borderTopStyle: 'solid' as const,
}

const CELL = {
  flex: 1,
  paddingVertical: 10,
  paddingHorizontal: 12,
}

interface Props {
  data: PdfEventData
  mode: PdfMode
}

export default function PdfCoverPage({ data, mode }: Props) {
  const { event } = data

  const venue = event.location_name || event.venue || '—'
  const address = [
    event.location_street,
    [event.location_zip, event.location_city].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ') || '—'

  const modeLabel = mode === 'intern' ? 'Interne Exportdokumentation' : 'Externe Exportdokumentation'

  const exportDate = fmtDate(new Date())

  return (
    <Page
      size="A4"
      orientation="portrait"
      style={{
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: COLORS.darkGray,
        backgroundColor: COLORS.white,
        paddingTop: 40,
        paddingBottom: 50,
        paddingLeft: 40,
        paddingRight: 40,
      }}
    >
      {/* Mode + brand badges */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderStyle: 'solid',
          borderRadius: 2,
          paddingVertical: 4,
          paddingHorizontal: 10,
        }}>
          <Text style={{
            fontSize: 7,
            fontFamily: 'Helvetica-Bold',
            color: COLORS.darkGray,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {modeLabel}
          </Text>
        </View>
        <View style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderStyle: 'solid',
          borderRadius: 2,
          paddingVertical: 4,
          paddingHorizontal: 10,
        }}>
          <Text style={{
            fontSize: 7,
            fontFamily: 'Helvetica-Bold',
            color: COLORS.darkGray,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Velvet Event Management
          </Text>
        </View>
      </View>

      {/* Main content — vertically centered */}
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 16 }}>
        {/* Accent bar */}
        <View style={{ width: 40, height: 3, backgroundColor: COLORS.black, marginBottom: 16 }} />

        {/* Event title */}
        <Text style={{
          fontSize: 28,
          fontFamily: 'Helvetica-Bold',
          color: COLORS.black,
          letterSpacing: -0.3,
          lineHeight: 1.15,
          marginBottom: 8,
        }}>
          {event.title}
        </Text>

        {/* Couple name */}
        {event.couple_name && (
          <Text style={{ fontSize: 12, color: COLORS.midGray, marginBottom: 24 }}>
            {event.couple_name}
          </Text>
        )}

        {/* 3×2 info grid */}
        <View style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderStyle: 'solid',
          marginBottom: 10,
        }}>
          {/* Row 1 */}
          <View style={{ flexDirection: 'row' }}>
            <View style={[CELL, BORDER_RIGHT]}>
              <Text style={CELL_LABEL}>Datum</Text>
              <Text style={CELL_VALUE}>{fmtDate(event.date)}</Text>
            </View>
            <View style={[CELL, BORDER_RIGHT]}>
              <Text style={CELL_LABEL}>Zeremonienstart</Text>
              <Text style={CELL_VALUE}>{event.ceremony_start ? `${event.ceremony_start} Uhr` : '—'}</Text>
            </View>
            <View style={CELL}>
              <Text style={CELL_LABEL}>Projektphase</Text>
              <Text style={CELL_VALUE}>{event.projektphase || '—'}</Text>
            </View>
          </View>
          {/* Row 2 */}
          <View style={[{ flexDirection: 'row' }, BORDER_TOP]}>
            <View style={[CELL, BORDER_RIGHT]}>
              <Text style={CELL_LABEL}>Veranstaltungsort</Text>
              <Text style={CELL_VALUE}>{venue}</Text>
            </View>
            <View style={[CELL, BORDER_RIGHT]}>
              <Text style={CELL_LABEL}>Adresse</Text>
              <Text style={CELL_VALUE}>{address}</Text>
            </View>
            <View style={CELL}>
              <Text style={CELL_LABEL}>Dresscode</Text>
              <Text style={CELL_VALUE}>{event.dresscode || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Export meta line */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 8, color: COLORS.midGray }}>
            Exportiert am {exportDate}
          </Text>
          <Text style={{ fontSize: 8, color: COLORS.midGray }}>
            {`Kinder erlaubt: ${event.children_allowed ? 'Ja' : 'Nein'} · Max. Begleitpersonen: ${event.max_begleitpersonen}`}
          </Text>
        </View>
      </View>

      {/* Page footer */}
      <Text
        fixed
        style={{
          position: 'absolute',
          bottom: 20,
          right: 40,
          fontSize: 8,
          color: COLORS.headerGray,
          fontFamily: 'Helvetica',
        }}
        render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
      />
    </Page>
  )
}
