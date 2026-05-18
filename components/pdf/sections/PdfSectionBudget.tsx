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

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function paymentBadge(s: string) {
  if (s === 'bezahlt')   return { label: 'Bezahlt',   bg: COLORS.green, color: COLORS.white }
  if (s === 'anzahlung') return { label: 'Anzahlung', bg: COLORS.amber, color: COLORS.white }
  return { label: 'Offen', bg: COLORS.lightGray, color: COLORS.darkGray }
}

export default function PdfSectionBudget({ data, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { budgetItems, budgetTotal } = data

  const totalPlanned = budgetItems.reduce((s, i) => s + (i.planned ?? 0), 0)
  const totalActual  = budgetItems.reduce((s, i) => s + (i.actual ?? 0), 0)
  const totalOpen    = totalPlanned - totalActual
  const deckung      = budgetTotal && budgetTotal > 0
    ? Math.round((totalActual / budgetTotal) * 100)
    : null

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
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Budget" />

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{fmtMoney(totalPlanned)} €</Text>
          <Text style={S.statLabel}>Geplant</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{fmtMoney(totalActual)} €</Text>
          <Text style={S.statLabel}>Ausgegeben</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{fmtMoney(totalOpen)} €</Text>
          <Text style={S.statLabel}>Noch offen</Text>
        </View>
        {deckung != null && (
          <View style={S.statBox}>
            <Text style={S.statValue}>{deckung} %</Text>
            <Text style={S.statLabel}>{deckung > 100 ? 'Über Budget!' : 'Ausgeschöpft'}</Text>
          </View>
        )}
      </View>

      {/* Übersicht nach Kategorie */}
      <Text style={S.subHeader}>Übersicht nach Kategorie</Text>
      <View style={[S.table, { marginTop: 8 }]}>
        <View style={S.tableHeaderRow}>
          <Text style={[S.tableCellHeader, { flex: 2 }]}>Kategorie</Text>
          <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Geplant (€)</Text>
          <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Tatsächlich (€)</Text>
          <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Differenz (€)</Text>
        </View>
        {categoryTotals.map(({ cat, planned, actual }, i) => (
          <View key={cat} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{cat}</Text>
            <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtMoney(planned)}</Text>
            <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtMoney(actual)}</Text>
            <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtMoney(planned - actual)}</Text>
          </View>
        ))}
        <View style={S.tableRowTotal}>
          <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>Gesamt</Text>
          <Text style={[S.tableCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmtMoney(totalPlanned)}</Text>
          <Text style={[S.tableCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmtMoney(totalActual)}</Text>
          <Text style={[S.tableCell, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmtMoney(totalOpen)}</Text>
        </View>
      </View>

      {/* Einzelpositionen */}
      {budgetItems.length > 0 && (
        <>
          <Text style={S.subHeader}>Einzelpositionen</Text>
          <View style={[S.table, { marginTop: 8 }]}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 1.2 }]}>Kategorie</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Beschreibung</Text>
              <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Geplant (€)</Text>
              <Text style={[S.tableCellHeader, { flex: 1, textAlign: 'right' }]}>Tatsächlich (€)</Text>
              <Text style={[S.tableCellHeader, { width: 62 }]}>Status</Text>
              <Text style={[S.tableCellHeader, { flex: 1.2 }]}>Notizen</Text>
            </View>
            {budgetItems.map((item, i) => {
              const badge = paymentBadge(item.payment_status)
              return (
                <View key={item.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt} wrap={false}>
                  <Text style={[S.tableCell, { flex: 1.2 }]}>{item.category || '—'}</Text>
                  <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{item.description || '—'}</Text>
                  <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtMoney(item.planned)}</Text>
                  <Text style={[S.tableCell, { flex: 1, textAlign: 'right' }]}>{fmtMoney(item.actual)}</Text>
                  <View style={[S.tableCell, { width: 62, justifyContent: 'center' }]}>
                    <StatusBadge label={badge.label} bg={badge.bg} color={badge.color} />
                  </View>
                  <Text style={[S.tableCell, { flex: 1.2 }]}>{item.notes ?? '—'}</Text>
                </View>
              )
            })}
          </View>
        </>
      )}

      <PageFooter />
    </Page>
  )
}
