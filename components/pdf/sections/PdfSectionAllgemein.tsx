import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData, PdfMode } from '../PdfTypes'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function or_(v: string | null | undefined, fallback = '—') {
  return v || fallback
}

interface Props {
  data: PdfEventData
  mode: PdfMode
}

export default function PdfSectionAllgemein({ data, mode }: Props) {
  const { event, bpMembers, organizerCosts } = data
  const venue = [event.location_name || event.venue, event.location_street, [event.location_zip, event.location_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return (
    <Page size="A4" orientation="portrait" style={S.page}>
      {/* Section header */}
      <View style={S.sectionHeader}>
        <Text style={S.sectionHeaderText}>Veranstaltungsinfo</Text>
      </View>

      {/* Stat boxes */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{fmtDate(event.date)}</Text>
          <Text style={S.statLabel}>Datum</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{event.ceremony_start ? `${event.ceremony_start} Uhr` : '—'}</Text>
          <Text style={S.statLabel}>Zeremonienstart</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{or_(event.projektphase)}</Text>
          <Text style={S.statLabel}>Projektphase</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{event.max_begleitpersonen}</Text>
          <Text style={S.statLabel}>Max. Begleitpersonen</Text>
        </View>
      </View>

      {/* General info */}
      <Text style={S.subHeader}>Allgemeine Informationen</Text>
      <View style={S.kvGrid2}>
        <View style={S.kvItem}>
          <Text style={S.kvLabel}>Eventname</Text>
          <Text style={S.kvValue}>{event.title}</Text>
        </View>
        <View style={S.kvItem}>
          <Text style={S.kvLabel}>Paar</Text>
          <Text style={S.kvValue}>{or_(event.couple_name)}</Text>
        </View>
        <View style={S.kvItem}>
          <Text style={S.kvLabel}>Datum</Text>
          <Text style={S.kvValue}>{fmtDate(event.date)}</Text>
        </View>
        <View style={S.kvItem}>
          <Text style={S.kvLabel}>Zeremonienstart</Text>
          <Text style={S.kvValue}>{event.ceremony_start ? `${event.ceremony_start} Uhr` : '—'}</Text>
        </View>
        <View style={{ width: '100%' }}>
          <Text style={S.kvLabel}>Veranstaltungsort</Text>
          <Text style={S.kvValue}>{or_(venue)}</Text>
        </View>
        {event.location_website && (
          <View style={S.kvItem}>
            <Text style={S.kvLabel}>Website</Text>
            <Text style={S.kvValue}>{event.location_website}</Text>
          </View>
        )}
        <View style={S.kvItem}>
          <Text style={S.kvLabel}>Dresscode</Text>
          <Text style={S.kvValue}>{or_(event.dresscode)}</Text>
        </View>
        <View style={S.kvItem}>
          <Text style={S.kvLabel}>Kinder erlaubt</Text>
          <Text style={S.kvValue}>
            {event.children_allowed ? 'Ja' : 'Nein'}
            {event.children_note ? ` — ${event.children_note}` : ''}
          </Text>
        </View>
      </View>

      {/* Beteiligte (Brautpaar) */}
      {bpMembers.length > 0 && (
        <>
          <Text style={S.subHeader}>Beteiligte (Brautpaar)</Text>
          <View style={S.table}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 1 }]}>Name</Text>
              <Text style={[S.tableCellHeader, { flex: 1 }]}>E-Mail</Text>
            </View>
            {bpMembers.map((m, i) => (
              <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[S.tableCell, { flex: 1 }]}>{or_(m.name)}</Text>
                <Text style={[S.tableCell, { flex: 1 }]}>{or_(m.email)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Internal only */}
      {mode === 'intern' && event.internal_notes && (
        <>
          <Text style={S.subHeader}>Interne Notizen</Text>
          <View style={{
            backgroundColor: COLORS.ultraLight,
            borderWidth: 1, borderColor: COLORS.border, borderStyle: 'solid',
            borderRadius: 3, padding: 10, marginBottom: 14,
          }}>
            <Text style={{ fontSize: 9, color: COLORS.darkGray, lineHeight: 1.5 }}>
              {event.internal_notes}
            </Text>
          </View>
        </>
      )}

      {mode === 'intern' && organizerCosts.length > 0 && (
        <>
          <Text style={S.subHeader}>Veranstalterkosten</Text>
          <View style={S.table}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Kategorie</Text>
              <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Betrag</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Notizen</Text>
            </View>
            {organizerCosts.map((c, i) => (
              <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[S.tableCell, { flex: 2 }]}>{c.category}</Text>
                <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtMoney(c.amount)}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{or_(c.notes)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  )
}
