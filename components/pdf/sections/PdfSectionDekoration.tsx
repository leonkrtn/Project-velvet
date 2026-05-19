import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import { PageHeader, SectionTitle, PageFooter } from '../PdfShared'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
  sectionIndex: number
  headerTitle: string
  exportTimestamp: string
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ARTICLE_TYPES = ['article', 'flat_rate_article', 'fabric']

export default function PdfSectionDekoration({ data, mode, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { dekoAreas, dekoCanvases, dekoItemsByCanvas, dekoCatalogItems, dekoFlatRates } = data

  const catalogMap  = new Map(dekoCatalogItems.map(c => [c.id, c]))
  const flatRateMap = new Map(dekoFlatRates.map(fr => [fr.id, fr]))

  let totalArticles = 0
  for (const items of Object.values(dekoItemsByCanvas)) {
    totalArticles += items.filter(i => ARTICLE_TYPES.includes(i.type)).length
  }
  const frozenMain  = dekoCanvases.filter(c => c.is_frozen && c.canvas_type === 'main').length
  const totalMain   = dekoCanvases.filter(c => c.canvas_type === 'main').length

  let dekoTotal = 0
  if (mode === 'intern') {
    for (const items of Object.values(dekoItemsByCanvas)) {
      for (const item of items) {
        if (item.type === 'article') {
          const cat = catalogMap.get(item.data.catalog_item_id as string)
          if (cat && !cat.is_free && cat.price_per_unit) {
            dekoTotal += cat.price_per_unit * ((item.data.quantity as number) ?? 1)
          }
        } else if (item.type === 'flat_rate_article') {
          const cat = catalogMap.get(item.data.catalog_item_id as string)
          const itemIsFree = (item.data.is_free as boolean | undefined) ?? false
          if (cat && !itemIsFree && !cat.is_free && cat.price_per_unit) {
            dekoTotal += cat.price_per_unit * ((item.data.quantity as number) ?? 1)
          }
        } else if (item.type === 'fabric') {
          const cat = catalogMap.get(item.data.catalog_item_id as string)
          if (cat && cat.price_per_meter) {
            dekoTotal += cat.price_per_meter * ((item.data.quantity_meters as number) ?? 0)
          }
        }
      }
    }
    for (const fr of dekoFlatRates) dekoTotal += fr.amount
  }

  const sortedAreas = [...dekoAreas].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Dekoration" />

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{dekoAreas.length}</Text>
          <Text style={S.statLabel}>Bereiche</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{totalArticles}</Text>
          <Text style={S.statLabel}>Artikel gesamt</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{frozenMain} / {totalMain}</Text>
          <Text style={S.statLabel}>Eingereicht</Text>
        </View>
        {mode === 'intern' && (
          <View style={S.statBox}>
            <Text style={S.statValue}>{fmtMoney(dekoTotal)} €</Text>
            <Text style={S.statLabel}>Budget gesamt</Text>
          </View>
        )}
      </View>

      {sortedAreas.map(area => {
        const areaCanvases = dekoCanvases
          .filter(c => c.area_id === area.id)
          .sort((a, b) => a.sort_order - b.sort_order)

        // Collect all article items across canvases for this area's main/variant canvases
        const mainCanvas = areaCanvases.find(c => c.canvas_type === 'main')
        const items      = mainCanvas ? (dekoItemsByCanvas[mainCanvas.id] ?? []) : []
        const articleItems = items.filter(i => ARTICLE_TYPES.includes(i.type))
        const voteItems    = items.filter(i => i.type === 'vote_card')
        const textItems    = items.filter(i => ['text_block', 'sticky_note', 'heading', 'checklist'].includes(i.type))

        const hasContent = articleItems.length > 0 || voteItems.length > 0 || textItems.length > 0

        const voteTexts = voteItems.map(v => (v.data.title as string) || '—').join(', ')
        const textSummary = textItems.length > 0 ? `${textItems.length} Textnotiz${textItems.length !== 1 ? 'en' : ''}` : null

        return (
          <View key={area.id} style={{ marginBottom: 14 }} wrap={false}>
            {/* BEREICH: area name sub-header */}
            <Text style={S.subHeader}>Bereich: {area.name}</Text>

            {!hasContent ? (
              <Text style={[S.mutedItalic, { marginTop: 6 }]}>Keine Inhalte erfasst.</Text>
            ) : (
              <>
                {articleItems.length > 0 && (
                  <View style={[S.table, { marginTop: 8 }]}>
                    <View style={S.tableHeaderRow}>
                      <Text style={[S.tableCellHeader, { flex: 2 }]}>Artikel</Text>
                      <Text style={[S.tableCellHeader, { width: 60 }]}>Typ</Text>
                      <Text style={[S.tableCellHeader, { width: 50, textAlign: 'right' }]}>Menge</Text>
                      {mode === 'intern' && (
                        <>
                          <Text style={[S.tableCellHeader, { width: 70, textAlign: 'right' }]}>Preis / Einh. (€)</Text>
                          <Text style={[S.tableCellHeader, { width: 65, textAlign: 'right' }]}>Gesamt (€)</Text>
                        </>
                      )}
                    </View>
                    {articleItems.map((item, i) => {
                      const isFabric   = item.type === 'fabric'
                      const isFlatRate = item.type === 'flat_rate_article'
                      const cat        = catalogMap.get(item.data.catalog_item_id as string)
                      const linkedFR   = isFlatRate ? flatRateMap.get(item.data.flat_rate_id as string) : undefined
                      const name       = cat?.name ?? linkedFR?.name ?? '—'
                      const qty        = isFabric
                        ? `${item.data.quantity_meters ?? 0} m`
                        : `${item.data.quantity ?? 1}×`
                      const itemIsFree = isFlatRate
                        ? ((item.data.is_free as boolean | undefined) ?? false) || (cat?.is_free ?? false)
                        : (cat?.is_free ?? false)
                      const unitPrice  = isFabric ? cat?.price_per_meter : cat?.price_per_unit
                      const total      = isFabric
                        ? (cat?.price_per_meter ?? 0) * ((item.data.quantity_meters as number) ?? 0)
                        : (cat?.price_per_unit ?? 0) * ((item.data.quantity as number) ?? 1)
                      const typeLabel  = isFabric ? 'Stoff' : isFlatRate ? 'Pauschal' : 'Artikel'

                      return (
                        <View key={item.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                          <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{name}</Text>
                          <Text style={[S.tableCell, { width: 60 }]}>{typeLabel}</Text>
                          <Text style={[S.tableCell, { width: 50, textAlign: 'right' }]}>{qty}</Text>
                          {mode === 'intern' && (
                            <>
                              <Text style={[S.tableCell, { width: 70, textAlign: 'right' }]}>
                                {itemIsFree ? 'Inklusive' : fmtMoney(unitPrice)}
                              </Text>
                              <Text style={[S.tableCell, { width: 65, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                                {itemIsFree ? '—' : fmtMoney(total)}
                              </Text>
                            </>
                          )}
                        </View>
                      )
                    })}
                  </View>
                )}

                {/* Vote-Karten and Textnotizen kv row */}
                <View style={[S.kvGrid, { marginTop: articleItems.length > 0 ? 4 : 8, marginBottom: 0 }]}>
                  <View style={S.kvItem}>
                    <Text style={S.kvLabel}>Vote-Karten</Text>
                    <Text style={S.kvValue}>{voteTexts || '—'}</Text>
                  </View>
                  <View style={S.kvItem}>
                    <Text style={S.kvLabel}>Textnotizen</Text>
                    <Text style={S.kvValue}>{textSummary || '—'}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )
      })}

      {/* Pauschalpreise — intern only */}
      {mode === 'intern' && dekoFlatRates.length > 0 && (
        <>
          <Text style={S.subHeader}>Pauschalpreise</Text>
          <View style={[S.table, { marginTop: 8 }]}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Name</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Beschreibung</Text>
              <Text style={[S.tableCellHeader, { width: 80, textAlign: 'right' }]}>Betrag (€)</Text>
            </View>
            {dekoFlatRates.map((fr, i) => (
              <View key={fr.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                <Text style={[S.tableCell, { flex: 2 }]}>{fr.name}</Text>
                <Text style={[S.tableCell, { flex: 2 }]}>{fr.description || '—'}</Text>
                <Text style={[S.tableCell, { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                  {fmtMoney(fr.amount)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <PageFooter />
    </Page>
  )
}
