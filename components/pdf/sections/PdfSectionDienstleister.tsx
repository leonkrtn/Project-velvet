import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
}

function statusColor(s: string) {
  if (s === 'bestätigt' || s === 'bestaetigt') return COLORS.green
  if (s === 'abgesagt') return COLORS.red
  return COLORS.amber
}

function statusLabel(s: string) {
  if (s === 'bestätigt' || s === 'bestaetigt') return 'Bestätigt'
  if (s === 'abgesagt') return 'Abgesagt'
  return 'Angefragt'
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
}

export default function PdfSectionDienstleister({ data, mode }: Props) {
  const { vendors } = data

  const confirmed = vendors.filter(v => v.status === 'bestätigt' || v.status === 'bestaetigt').length
  const open      = vendors.length - confirmed - vendors.filter(v => v.status === 'abgesagt').length

  // Group by category
  const byCategory = new Map<string, typeof vendors>()
  for (const v of vendors) {
    const cat = v.category || 'Sonstiges'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(v)
  }

  return (
    <Page size="A4" orientation="portrait" style={S.page}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionHeaderText}>Dienstleister</Text>
      </View>

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{vendors.length}</Text>
          <Text style={S.statLabel}>Gesamt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={[S.statValue, { color: COLORS.green }]}>{confirmed}</Text>
          <Text style={S.statLabel}>Bestätigt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={[S.statValue, { color: COLORS.amber }]}>{open}</Text>
          <Text style={S.statLabel}>Noch offen</Text>
        </View>
      </View>

      {vendors.length === 0 ? (
        <Text style={[S.muted, S.small]}>Keine Dienstleister erfasst.</Text>
      ) : (
        Array.from(byCategory.entries()).map(([cat, list]) => (
          <View key={cat} style={{ marginBottom: 14 }} wrap={false}>
            <Text style={S.subHeader}>{cat}</Text>
            <View style={S.table}>
              <View style={S.tableHeaderRow}>
                <Text style={[S.tableCellHeader, { flex: 2 }]}>Name</Text>
                <Text style={[S.tableCellHeader, { width: 65 }]}>Status</Text>
                <Text style={[S.tableCellHeader, { flex: 1.5 }]}>E-Mail</Text>
                <Text style={[S.tableCellHeader, { flex: 1 }]}>Telefon</Text>
                {mode === 'intern' && (
                  <>
                    <Text style={[S.tableCellHeader, { width: 60, textAlign: 'right' }]}>Preis</Text>
                    <Text style={[S.tableCellHeader, { flex: 1 }]}>Notizen</Text>
                  </>
                )}
              </View>
              {list.map((v, i) => (
                <View key={v.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <View style={[{ flex: 2 }, S.tableCell]}>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{v.name}</Text>
                    {v.contact_name && (
                      <Text style={{ fontSize: 8, color: COLORS.midGray }}>Kontakt: {v.contact_name}</Text>
                    )}
                  </View>
                  <View style={[{ width: 65 }, S.tableCell, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <View style={{
                      width: 5, height: 5, borderRadius: 3,
                      backgroundColor: statusColor(v.status),
                    }} />
                    <Text style={{ fontSize: 8, color: statusColor(v.status), fontFamily: 'Helvetica-Bold' }}>
                      {statusLabel(v.status)}
                    </Text>
                  </View>
                  <Text style={[S.tableCell, { flex: 1.5 }]}>{v.email ?? '—'}</Text>
                  <Text style={[S.tableCell, { flex: 1 }]}>{v.phone ?? '—'}</Text>
                  {mode === 'intern' && (
                    <>
                      <Text style={[S.tableCell, { width: 60, textAlign: 'right' }]}>{fmtMoney(v.price)}</Text>
                      <Text style={[S.tableCell, { flex: 1 }]}>{v.notes ?? '—'}</Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))
      )}

      <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  )
}
