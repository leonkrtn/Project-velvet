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

function fmtMoney(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PdfSectionGetraenke({ data, mode, sectionIndex, headerTitle, exportTimestamp }: Props) {
  const { getraenkeKategorien, getraenkeArtikel, getraenkeCocktails } = data

  const artikelCount   = getraenkeArtikel.length
  const kategorieCount = getraenkeKategorien.length
  const cocktailCount  = getraenkeCocktails.length

  // Group articles by category
  const artikelByKategorie: Record<string, typeof getraenkeArtikel> = {}
  const uncategorised: typeof getraenkeArtikel = []
  for (const art of getraenkeArtikel) {
    if (art.kategorie_id) {
      if (!artikelByKategorie[art.kategorie_id]) artikelByKategorie[art.kategorie_id] = []
      artikelByKategorie[art.kategorie_id].push(art)
    } else {
      uncategorised.push(art)
    }
  }

  // Budget calculations (mode === 'intern' only)
  const kategorienTotal = getraenkeArtikel.reduce((sum, art) => {
    const preis = (art.price_per_unit ?? 0) * (art.total_planned ?? 0)
    return sum + preis
  }, 0)
  const cocktailsTotal = getraenkeCocktails.reduce((sum, c) => {
    const preis = (c.price_per_unit ?? 0) * (c.planned_count ?? 0)
    return sum + preis
  }, 0)
  const grandTotal = kategorienTotal + cocktailsTotal

  return (
    <Page size="A4" orientation="portrait" style={S.page} wrap>
      <PageHeader title={headerTitle} timestamp={exportTimestamp} />

      <SectionTitle index={sectionIndex} title="Getränkeplanung" />

      {/* Stats */}
      <View style={S.statRow}>
        <View style={S.statBox}>
          <Text style={S.statValue}>{artikelCount}</Text>
          <Text style={S.statLabel}>Artikel</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{kategorieCount}</Text>
          <Text style={S.statLabel}>Kategorien</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statValue}>{cocktailCount}</Text>
          <Text style={S.statLabel}>Cocktails</Text>
        </View>
      </View>

      {/* ── Mengenplanung per category ─────────────────────────────────────── */}
      {getraenkeKategorien.length > 0 || uncategorised.length > 0 ? (
        <>
          <Text style={S.subHeader}>Mengenplanung</Text>

          {getraenkeKategorien.map(kat => {
            const arts = artikelByKategorie[kat.id] ?? []
            if (arts.length === 0) return null
            const katTotal = arts.reduce((s, a) => s + (a.price_per_unit ?? 0) * (a.total_planned ?? 0), 0)
            return (
              <View key={kat.id} style={{ marginBottom: 12 }}>
                {/* Category header row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={{
                    width: 8, height: 8, borderRadius: 2,
                    backgroundColor: kat.color || COLORS.midGray,
                  }} />
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.darkGray }}>
                    {kat.name}
                  </Text>
                  {/* is_alcoholic may be missing from DB (migration pending) — default true */}
                  <StatusBadge
                    label={(kat.is_alcoholic ?? true) ? 'Alkoholisch' : 'Alkoholfrei'}
                    bg={(kat.is_alcoholic ?? true) ? COLORS.amber : COLORS.green}
                  />
                </View>

                <View style={S.table}>
                  <View style={S.tableHeaderRow}>
                    <Text style={[S.tableCellHeader, { flex: 3 }]}>Artikel</Text>
                    <Text style={[S.tableCellHeader, { flex: 1 }]}>Einheit</Text>
                    <Text style={[S.tableCellHeader, { width: 60, textAlign: 'right' }]}>Menge</Text>
                    {mode === 'intern' && (
                      <>
                        <Text style={[S.tableCellHeader, { width: 60, textAlign: 'right' }]}>€ / Einheit</Text>
                        <Text style={[S.tableCellHeader, { width: 60, textAlign: 'right' }]}>Gesamt €</Text>
                      </>
                    )}
                  </View>
                  {arts.map((art, i) => (
                    <View key={art.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                      <Text style={[S.tableCell, { flex: 3 }]}>{art.name}</Text>
                      <Text style={[S.tableCell, { flex: 1 }]}>{art.unit || '—'}</Text>
                      <Text style={[S.tableCell, { width: 60, textAlign: 'right' }]}>
                        {art.total_planned ?? 0}
                      </Text>
                      {mode === 'intern' && (
                        <>
                          <Text style={[S.tableCell, { width: 60, textAlign: 'right' }]}>
                            {fmtMoney(art.price_per_unit ?? 0)}
                          </Text>
                          <Text style={[S.tableCell, { width: 60, textAlign: 'right' }]}>
                            {fmtMoney((art.price_per_unit ?? 0) * (art.total_planned ?? 0))}
                          </Text>
                        </>
                      )}
                    </View>
                  ))}
                  {mode === 'intern' && (
                    <View style={S.tableRowTotal}>
                      <Text style={[S.tableCell, { flex: 3, fontFamily: 'Helvetica-Bold' }]}>Gesamt</Text>
                      <Text style={[S.tableCell, { flex: 1 }]} />
                      <Text style={[S.tableCell, { width: 60 }]} />
                      <Text style={[S.tableCell, { width: 60 }]} />
                      <Text style={[S.tableCell, { width: 60, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                        {fmtMoney(katTotal)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )
          })}

          {/* Uncategorised articles */}
          {uncategorised.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.midGray, marginBottom: 4 }}>
                Ohne Kategorie
              </Text>
              <View style={S.table}>
                <View style={S.tableHeaderRow}>
                  <Text style={[S.tableCellHeader, { flex: 3 }]}>Artikel</Text>
                  <Text style={[S.tableCellHeader, { flex: 1 }]}>Einheit</Text>
                  <Text style={[S.tableCellHeader, { width: 60, textAlign: 'right' }]}>Menge</Text>
                  {mode === 'intern' && (
                    <>
                      <Text style={[S.tableCellHeader, { width: 60, textAlign: 'right' }]}>€ / Einheit</Text>
                      <Text style={[S.tableCellHeader, { width: 60, textAlign: 'right' }]}>Gesamt €</Text>
                    </>
                  )}
                </View>
                {uncategorised.map((art, i) => (
                  <View key={art.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCell, { flex: 3 }]}>{art.name}</Text>
                    <Text style={[S.tableCell, { flex: 1 }]}>{art.unit || '—'}</Text>
                    <Text style={[S.tableCell, { width: 60, textAlign: 'right' }]}>
                      {art.total_planned ?? 0}
                    </Text>
                    {mode === 'intern' && (
                      <>
                        <Text style={[S.tableCell, { width: 60, textAlign: 'right' }]}>
                          {fmtMoney(art.price_per_unit ?? 0)}
                        </Text>
                        <Text style={[S.tableCell, { width: 60, textAlign: 'right' }]}>
                          {fmtMoney((art.price_per_unit ?? 0) * (art.total_planned ?? 0))}
                        </Text>
                      </>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      ) : (
        <Text style={S.mutedItalic}>Keine Getränkeartikel erfasst.</Text>
      )}

      {/* ── Cocktails ─────────────────────────────────────────────────────── */}
      {getraenkeCocktails.length > 0 && (
        <>
          <Text style={S.subHeader}>Cocktails</Text>
          <View style={S.table}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 3 }]}>Name</Text>
              <Text style={[S.tableCellHeader, { flex: 1 }]}>Art</Text>
              <Text style={[S.tableCellHeader, { width: 60, textAlign: 'right' }]}>Geplant</Text>
              {mode === 'intern' && (
                <Text style={[S.tableCellHeader, { width: 70, textAlign: 'right' }]}>Preis / Stk.</Text>
              )}
              <Text style={[S.tableCellHeader, { flex: 2 }]}>Zutaten</Text>
            </View>
            {getraenkeCocktails.map((cocktail, i) => {
              const ingredients = (cocktail.ingredients ?? [])
                .map(ing => `${ing.name}${ing.amount ? ` (${ing.amount}${ing.unit ? ' ' + ing.unit : ''})` : ''}`)
                .join(', ')
              return (
                <View key={cocktail.id} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                  <Text style={[S.tableCell, { flex: 3 }]}>{cocktail.name}</Text>
                  <View style={[S.tableCell, { flex: 1 }]}>
                    <StatusBadge
                      label={(cocktail.is_alcoholic ?? true) ? 'Alkohol' : 'Alkoholfrei'}
                      bg={(cocktail.is_alcoholic ?? true) ? COLORS.amber : COLORS.green}
                    />
                  </View>
                  <Text style={[S.tableCell, { width: 60, textAlign: 'right' }]}>
                    {cocktail.planned_count ?? 0}
                  </Text>
                  {mode === 'intern' && (
                    <Text style={[S.tableCell, { width: 70, textAlign: 'right' }]}>
                      {(cocktail.price_per_unit ?? 0) > 0
                        ? `${fmtMoney(cocktail.price_per_unit ?? 0)} €`
                        : '—'}
                    </Text>
                  )}
                  <Text style={[S.tableCell, { flex: 2 }]}>
                    {ingredients || '—'}
                  </Text>
                </View>
              )
            })}
          </View>
        </>
      )}

      {/* ── Budget Summary (intern only) ───────────────────────────────────── */}
      {mode === 'intern' && (artikelCount > 0 || cocktailCount > 0) && (
        <>
          <Text style={S.subHeader}>Kostenübersicht</Text>
          <View style={S.table}>
            <View style={S.tableHeaderRow}>
              <Text style={[S.tableCellHeader, { flex: 3 }]}>Bereich</Text>
              <Text style={[S.tableCellHeader, { width: 80, textAlign: 'right' }]}>Betrag (€)</Text>
            </View>
            {artikelCount > 0 && (
              <View style={S.tableRow}>
                <Text style={[S.tableCell, { flex: 3 }]}>Getränkeartikel</Text>
                <Text style={[S.tableCell, { width: 80, textAlign: 'right' }]}>
                  {fmtMoney(kategorienTotal)}
                </Text>
              </View>
            )}
            {cocktailCount > 0 && (
              <View style={S.tableRowAlt}>
                <Text style={[S.tableCell, { flex: 3 }]}>Cocktails</Text>
                <Text style={[S.tableCell, { width: 80, textAlign: 'right' }]}>
                  {fmtMoney(cocktailsTotal)}
                </Text>
              </View>
            )}
            <View style={S.tableRowTotal}>
              <Text style={[S.tableCell, { flex: 3, fontFamily: 'Helvetica-Bold' }]}>Gesamt</Text>
              <Text style={[S.tableCell, { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                {fmtMoney(grandTotal)}
              </Text>
            </View>
          </View>
        </>
      )}

      <PageFooter />
    </Page>
  )
}
