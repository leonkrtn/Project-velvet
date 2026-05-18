import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function statusLabel(s: string) {
  if (s === 'bezahlt') return 'Bezahlt'
  if (s === 'anzahlung') return 'Anzahlung'
  return 'Offen'
}

function statusColor(s: string) {
  if (s === 'bezahlt') return COLORS.green
  if (s === 'anzahlung') return COLORS.amber
  return COLORS.midGray
}

export default function PdfSectionBudget({ data }: Props) {
  const { budgetItems, budgetTotal } = data

  const totalPlanned = budgetItems.reduce((s, i) => s + (i.planned ?? 0), 0)
  const totalActual  = budgetItems.reduce((s, i) => s + (i.actual ?? 0), 0)
  const totalOpen    = totalPlanned - totalActual
  const deckung      = budgetTotal ? Math.round((totalActual / budgetTotal) * 100) : null

  // Group by category
  const byCategory = new Map<string, typeof budgetItems>()
  for (const item of budgetItems) {
    const cat = item.category || 'Sonstiges'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(item)
  }

  const categoryTotals = Array.from(byCategory.entries()).map(([cat, items]) => ({
    cat,
    planned: items.reduce((s, i) => s + (i.planned ?? 0), 0),
    actual:  items.reduce((s, i) => s + (i.actual ?? 0), 0),
  }))

  return (
    <>
      <Page size="A4" orientation="portrait" style={S.page}>
        <View style={S.sectionHeader}>
          <Text style={S.sectionHeaderText}>Budget</Text>
        </View>

        {/* Stats */}
        <View style={S.statRow}>
          <View style={S.statBox}>
            <Text style={S.statValue}>{fmtMoney(totalPlanned)}</Text>
            <Text style={S.statLabel}>Geplant</Text>
          </View>
          <View style={S.statBox}>
            <Text style={[S.statValue, { color: COLORS.darkGray }]}>{fmtMoney(totalActual)}</Text>
            <Text style={S.statLabel}>Ausgegeben</Text>
          </View>
          <View style={S.statBox}>
            <Text style={[S.statValue, { color: totalOpen >= 0 ? COLORS.midGray : COLORS.red }]}>
              {fmtMoney(totalOpen)}
            </Text>
            <Text style={S.statLabel}>Offen</Text>
          </View>
          {deckung != null && (
            <View style={S.statBox}>
              <Text style={[S.statValue, { color: deckung > 100 ? COLORS.red : deckung > 90 ? COLORS.amber : COLORS.darkGray }]}>
                {deckung} %
              </Text>
              <Text style={[S.statLabel, { color: deckung > 100 ? COLORS.red : undefined }]}>
                {deckung > 100 ? 'Über Budget!' : 'Ausgeschöpft'}
              </Text>
            </View>
          )}
        </View>

        {/* Category overview */}
        <Text style={S.subHeader}>Übersicht nach Kategorie</Text>
        <View style={S.table}>
          <View style={S.tableHeaderRow}>
            <Text style={[S.tableCellHeader, { flex: 2 }]}>Kategorie</Text>
            <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Geplant</Text>
            <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Tatsächlich</Text>
            <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Differenz</Text>
          </View>
          {categoryTotals.map(({ cat, planned, actual }, i) => (
            <View key={cat} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{cat}</Text>
              <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtMoney(planned)}</Text>
              <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtMoney(actual)}</Text>
              <Text style={[S.tableCell, { flex: 1, textAlign: 'right', color: actual > planned ? COLORS.red : COLORS.green }]}>
                {fmtMoney(planned - actual)}
              </Text>
            </View>
          ))}
          {/* Total row */}
          <View style={{
            flexDirection: 'row',
            borderTopWidth: 1, borderTopColor: COLORS.darkGray, borderTopStyle: 'solid',
            backgroundColor: COLORS.lightGray,
          }}>
            <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>Gesamt</Text>
            <Text style={[S.tableCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmtMoney(totalPlanned)}</Text>
            <Text style={[S.tableCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmtMoney(totalActual)}</Text>
            <Text style={[S.tableCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: totalOpen >= 0 ? COLORS.green : COLORS.red }]}>
              {fmtMoney(totalOpen)}
            </Text>
          </View>
        </View>

        <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>

      {/* Einzelpositionen */}
      {budgetItems.length > 0 && (
        <Page size="A4" orientation="landscape" style={S.pageLandscape}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionHeaderText}>Budget — Einzelpositionen</Text>
          </View>

          <View style={S.table}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Kategorie</Text>
              <Text style={[S.tableCellHeader, { flex: 2.5 }]}>Beschreibung</Text>
              <Text style={[S.tableCellHeader, { width: 70, textAlign: 'right' }]}>Geplant</Text>
              <Text style={[S.tableCellHeader, { width: 70, textAlign: 'right' }]}>Tatsächlich</Text>
              <Text style={[S.tableCellHeader, { width: 70 }]}>Status</Text>
              <Text style={[S.tableCellHeader, { flex: 1.5 }]}>Notizen</Text>
            </View>
            {budgetItems.map((item, i) => (
              <View key={item.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt} wrap={false}>
                <Text style={[S.tableCell, { flex: 1.5 }]}>{item.category || '—'}</Text>
                <Text style={[S.tableCell, { flex: 2.5 }]}>{item.description || '—'}</Text>
                <Text style={[S.tableCell, { width: 70, textAlign: 'right' }]}>{fmtMoney(item.planned)}</Text>
                <Text style={[S.tableCell, { width: 70, textAlign: 'right' }]}>{fmtMoney(item.actual)}</Text>
                <View style={[{ width: 70 }, S.tableCell]}>
                  <Text style={{ fontSize: 8, color: statusColor(item.payment_status), fontFamily: 'Helvetica-Bold' }}>
                    {statusLabel(item.payment_status)}
                  </Text>
                </View>
                <Text style={[S.tableCell, { flex: 1.5 }]}>{item.notes ?? '—'}</Text>
              </View>
            ))}
          </View>

          <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      )}
    </>
  )
}
