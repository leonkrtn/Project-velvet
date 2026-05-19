import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import { PageHeader, SectionTitle, PageFooter, StatusBadge } from '../PdfShared'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
  sectionIndex: number
  headerTitle: string
  exportTimestamp: string
}

function vendorBadge(s: string) {
  if (s === 'bestätigt' || s === 'bestaetigt') return { label: 'Bestätigt', bg: COLORS.green,   color: COLORS.white }
  if (s === 'abgesagt')                         return { label: 'Abgesagt',  bg: COLORS.red,     color: COLORS.white }
  return                                               { label: 'Angefragt', bg: COLORS.amber,   color: COLORS.white }
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PdfSectionDienstleister({ data, mode, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { vendors } = data

  const confirmed = vendors.filter(v => v.status === 'bestätigt' || v.status === 'bestaetigt').length
  const open      = vendors.length - confirmed - vendors.filter(v => v.status === 'abgesagt').length

  const byCategory = new Map<string, typeof vendors>()
  for (const v of vendors) {
    const cat = v.category || 'Sonstiges'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(v)
  }

  return (
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Dienstleister" />

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{vendors.length}</Text>
          <Text style={S.statLabel}>Gesamt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{confirmed}</Text>
          <Text style={S.statLabel}>Bestätigt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{open}</Text>
          <Text style={S.statLabel}>Noch offen</Text>
        </View>
      </View>

      {vendors.length === 0 ? (
        <Text style={S.mutedItalic}>Keine Dienstleister erfasst.</Text>
      ) : (
        Array.from(byCategory.entries()).map(([cat, list]) => (
          <View key={cat} style={{ marginBottom: 14 }}>
            <Text style={S.subHeader}>{cat}</Text>
            <View style={[S.table, { marginTop: 8 }]}>
              <View style={S.tableHeaderRow}>
                <Text style={[S.tableCellHeader, { flex: 2 }]}>Name</Text>
                <Text style={[S.tableCellHeader, { width: 68 }]}>Status</Text>
                <Text style={[S.tableCellHeader, { flex: 1.5 }]}>E-Mail</Text>
                <Text style={[S.tableCellHeader, { flex: 1 }]}>Telefon</Text>
                {mode === 'intern' && (
                  <>
                    <Text style={[S.tableCellHeader, { width: 64, textAlign: 'right' }]}>Preis (€)</Text>
                    <Text style={[S.tableCellHeader, { flex: 1.2 }]}>Notizen</Text>
                  </>
                )}
              </View>
              {list.map((v, i) => {
                const badge = vendorBadge(v.status)
                return (
                  <View key={v.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt} wrap={false}>
                    <View style={[S.tableCell, { flex: 2 }]}>
                      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{v.name}</Text>
                      {v.contact_name && (
                        <Text style={{ fontSize: 8, color: COLORS.midGray }}>Kontakt: {v.contact_name}</Text>
                      )}
                    </View>
                    <View style={[S.tableCell, { width: 68, justifyContent: 'center' }]}>
                      <StatusBadge label={badge.label} bg={badge.bg} color={badge.color} />
                    </View>
                    <Text style={[S.tableCell, { flex: 1.5 }]}>{v.email ?? '—'}</Text>
                    <Text style={[S.tableCell, { flex: 1 }]}>{v.phone ?? '—'}</Text>
                    {mode === 'intern' && (
                      <>
                        <Text style={[S.tableCell, { width: 64, textAlign: 'right' }]}>{fmtMoney(v.price)}</Text>
                        <Text style={[S.tableCell, { flex: 1.2 }]}>{v.notes ?? '—'}</Text>
                      </>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        ))
      )}

      <PageFooter />
    </Page>
  )
}
