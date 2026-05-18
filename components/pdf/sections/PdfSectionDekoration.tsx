import { Page, View, Text } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData, PdfMode } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
}

const CANVAS_TYPE_LABEL: Record<string, string> = {
  main: 'Hauptcanvas',
  variant: 'Variante',
  moodboard: 'Moodboard',
}

export default function PdfSectionDekoration({ data, mode }: Props) {
  const { dekoAreas, dekoCanvases, dekoItemsByCanvas, dekoCatalogItems, dekoFlatRates } = data

  // Build catalog lookup
  const catalogMap = new Map(dekoCatalogItems.map(c => [c.id, c]))

  // Count article items across all canvases
  const ARTICLE_TYPES = ['article', 'flat_rate_article', 'fabric']
  let totalArticles = 0
  for (const items of Object.values(dekoItemsByCanvas)) {
    totalArticles += items.filter(i => ARTICLE_TYPES.includes(i.type)).length
  }
  const frozenCount = dekoCanvases.filter(c => c.is_frozen && c.canvas_type === 'main').length
  const totalFrozen = dekoCanvases.filter(c => c.canvas_type === 'main').length

  // Compute total deko budget (intern)
  let dekoTotal = 0
  if (mode === 'intern') {
    for (const items of Object.values(dekoItemsByCanvas)) {
      for (const item of items) {
        if (item.type === 'article' || item.type === 'flat_rate_article') {
          const cat = catalogMap.get(item.data.catalog_item_id as string)
          if (cat && !cat.is_free && cat.price_per_unit) {
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
    for (const fr of dekoFlatRates) {
      dekoTotal += fr.amount
    }
  }

  // Sort areas
  const sortedAreas = [...dekoAreas].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <View style={S.sectionHeader}>
        <Text style={S.sectionHeaderText}>Dekoration</Text>
      </View>

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
          <Text style={S.statValue}>{frozenCount}/{totalFrozen}</Text>
          <Text style={S.statLabel}>Eingereicht</Text>
        </View>
        {mode === 'intern' && (
          <View style={S.statBox}>
            <Text style={S.statValue}>{fmtMoney(dekoTotal)}</Text>
            <Text style={S.statLabel}>Budget gesamt</Text>
          </View>
        )}
      </View>

      {sortedAreas.map(area => {
        const areaCanvases = dekoCanvases
          .filter(c => c.area_id === area.id)
          .sort((a, b) => a.sort_order - b.sort_order)
        const areaFlatRates = dekoFlatRates.filter(() => false) // flat rates are event-wide

        return (
          <View key={area.id} style={{ marginBottom: 16 }} wrap={false}>
            {/* Area header with color accent */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
            }}>
              <View style={{
                width: 4, height: 16,
                backgroundColor: area.color || COLORS.darkGray,
                borderRadius: 2,
              }} />
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.black }}>
                {area.name}
              </Text>
            </View>

            {areaCanvases.length === 0 ? (
              <Text style={[S.muted, S.small, { paddingLeft: 12 }]}>Keine Canvases in diesem Bereich.</Text>
            ) : (
              areaCanvases.map(canvas => {
                const items = dekoItemsByCanvas[canvas.id] ?? []
                const articleItems = items.filter(i => ARTICLE_TYPES.includes(i.type))
                const textItems = items.filter(i => ['text_block', 'sticky_note', 'heading', 'checklist'].includes(i.type))
                const voteItems = items.filter(i => i.type === 'vote_card')

                return (
                  <View key={canvas.id} style={{ paddingLeft: 12, marginBottom: 10 }}>
                    {/* Canvas sub-header */}
                    <View style={{
                      flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6,
                    }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.darkGray }}>
                        {canvas.name}
                      </Text>
                      <View style={[S.badge, { backgroundColor: COLORS.ultraLight, color: COLORS.midGray }]}>
                        <Text style={{ fontSize: 7, color: COLORS.midGray }}>
                          {CANVAS_TYPE_LABEL[canvas.canvas_type] ?? canvas.canvas_type}
                        </Text>
                      </View>
                      {canvas.is_frozen && (
                        <View style={[S.badge, { backgroundColor: '#DCFCE7', color: COLORS.green }]}>
                          <Text style={{ fontSize: 7, color: COLORS.green, fontFamily: 'Helvetica-Bold' }}>
                            Eingereicht
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Article list */}
                    {articleItems.length > 0 && (
                      <View style={S.table}>
                        <View style={S.tableHeaderRow}>
                          <Text style={[S.tableCellHeader, { flex: 2 }]}>Artikel</Text>
                          <Text style={[S.tableCellHeader, { width: 55 }]}>Typ</Text>
                          <Text style={[S.tableCellHeader, { width: 50, textAlign: 'right' }]}>Menge</Text>
                          {mode === 'intern' && (
                            <>
                              <Text style={[S.tableCellHeader, { width: 65, textAlign: 'right' }]}>Preis/Einh.</Text>
                              <Text style={[S.tableCellHeader, { width: 65, textAlign: 'right' }]}>Gesamt</Text>
                            </>
                          )}
                        </View>
                        {articleItems.map((item, i) => {
                          const cat = catalogMap.get(item.data.catalog_item_id as string)
                          const name = cat?.name ?? '—'
                          const isFabric = item.type === 'fabric'
                          const qty = isFabric
                            ? `${item.data.quantity_meters ?? 0} m`
                            : `${item.data.quantity ?? 1}×`
                          const unitPrice = isFabric ? cat?.price_per_meter : cat?.price_per_unit
                          const total = isFabric
                            ? (cat?.price_per_meter ?? 0) * ((item.data.quantity_meters as number) ?? 0)
                            : (cat?.price_per_unit ?? 0) * ((item.data.quantity as number) ?? 1)
                          const isFree = cat?.is_free ?? false

                          return (
                            <View key={item.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                              <Text style={[S.tableCell, { flex: 2 }]}>{name}</Text>
                              <Text style={[S.tableCell, { width: 55 }]}>
                                {isFabric ? 'Stoff' : 'Artikel'}
                              </Text>
                              <Text style={[S.tableCell, { width: 50, textAlign: 'right' }]}>{qty}</Text>
                              {mode === 'intern' && (
                                <>
                                  <Text style={[S.tableCell, { width: 65, textAlign: 'right' }]}>
                                    {isFree ? 'Inklusive' : fmtMoney(unitPrice)}
                                  </Text>
                                  <Text style={[S.tableCell, { width: 65, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                                    {isFree ? '—' : fmtMoney(total)}
                                  </Text>
                                </>
                              )}
                            </View>
                          )
                        })}
                      </View>
                    )}

                    {/* Vote cards */}
                    {voteItems.length > 0 && (
                      <Text style={[S.small, S.muted, { marginTop: 4 }]}>
                        Vote-Karten: {voteItems.map(v => v.data.title as string || '—').join(', ')}
                      </Text>
                    )}

                    {/* Text items summary */}
                    {textItems.length > 0 && (
                      <Text style={[S.small, S.muted, { marginTop: 4 }]}>
                        Textnotizen: {textItems.length} Element{textItems.length !== 1 ? 'e' : ''}
                      </Text>
                    )}

                    {articleItems.length === 0 && textItems.length === 0 && voteItems.length === 0 && (
                      <Text style={[S.small, S.muted]}>Keine Inhalte.</Text>
                    )}
                  </View>
                )
              })
            )}
          </View>
        )
      })}

      {/* Pauschalpreise — intern only */}
      {mode === 'intern' && dekoFlatRates.length > 0 && (
        <>
          <Text style={S.subHeader}>Pauschalpreise</Text>
          <View style={S.table}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Name</Text>
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Beschreibung</Text>
              <Text style={[S.tableCellHeader, { width: 80, textAlign: 'right' }]}>Betrag</Text>
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

      <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  )
}
