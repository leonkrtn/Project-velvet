import { Page, View, Text, Svg, Polygon, Circle, Rect, G } from '@react-pdf/renderer'
import { S, COLORS } from '../PdfStyles'
import type { PdfEventData, PdfMode, PdfSeatingTable } from '../PdfTypes'

interface Props {
  data: PdfEventData
  mode: PdfMode
}

function allergyLabel(tag: string) {
  const map: Record<string, string> = {
    gluten: 'Gluten', lactose: 'Laktose', nuts: 'Nüsse', egg: 'Eier',
    fish: 'Fisch', shellfish: 'Schalentiere', soy: 'Soja',
    vegetarian: 'Vegetarisch', vegan: 'Vegan', halal: 'Halal', kosher: 'Koscher',
  }
  return map[tag] || tag
}

// Returns the axis-aligned bounding box half-extents for a table, accounting for rotation.
function tableBounds(t: PdfSeatingTable) {
  if (t.shape === 'round') {
    const r = t.table_length / 2
    return { minX: t.pos_x - r, maxX: t.pos_x + r, minY: t.pos_y - r, maxY: t.pos_y + r }
  }
  const rad = (t.rotation * Math.PI) / 180
  const cosR = Math.abs(Math.cos(rad))
  const sinR = Math.abs(Math.sin(rad))
  const hw = (t.table_length / 2) * cosR + (t.table_width / 2) * sinR
  const hh = (t.table_length / 2) * sinR + (t.table_width / 2) * cosR
  return { minX: t.pos_x - hw, maxX: t.pos_x + hw, minY: t.pos_y - hh, maxY: t.pos_y + hh }
}

function buildRoomSvg(
  points: Array<{ x: number; y: number }>,
  tables: PdfSeatingTable[],
  svgW: number,
  svgH: number,
) {
  if (points.length === 0) return null

  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)

  // Compute axis-aligned bounding box that includes room polygon AND all tables
  let minX = Math.min(...xs)
  let maxX = Math.max(...xs)
  let minY = Math.min(...ys)
  let maxY = Math.max(...ys)
  for (const t of tables) {
    const b = tableBounds(t)
    if (b.minX < minX) minX = b.minX
    if (b.maxX > maxX) maxX = b.maxX
    if (b.minY < minY) minY = b.minY
    if (b.maxY > maxY) maxY = b.maxY
  }

  const pad = 20
  const scaleX = (svgW - 2 * pad) / Math.max(maxX - minX, 0.001)
  const scaleY = (svgH - 2 * pad) / Math.max(maxY - minY, 0.001)
  const scale = Math.min(scaleX, scaleY)

  const offX = pad + ((svgW - 2 * pad) - (maxX - minX) * scale) / 2 - minX * scale
  const offY = pad + ((svgH - 2 * pad) - (maxY - minY) * scale) / 2 - minY * scale

  const toX = (x: number) => x * scale + offX
  const toY = (y: number) => y * scale + offY

  const polyPoints = points.map(p => `${toX(p.x)},${toY(p.y)}`).join(' ')

  const tableElems = tables.map(t => {
    const cx = toX(t.pos_x)
    const cy = toY(t.pos_y)

    if (t.shape === 'round') {
      const r = Math.max((t.table_length / 2) * scale, 8)
      return { type: 'circle' as const, cx, cy, r, name: t.name }
    } else {
      const w = Math.max(t.table_length * scale, 16)
      const h = Math.max(t.table_width * scale, 10)
      return { type: 'rect' as const, cx, cy, w, h, rotation: t.rotation, name: t.name }
    }
  })

  return { polyPoints, tableElems }
}

export default function PdfSectionSitzplan({ data, mode }: Props) {
  const { seatingTables, seatingAssignments, guests, begleitpersonen, roomPoints, coupleName } = data

  // Fast lookup maps
  const guestMap    = new Map(guests.map(g => [g.id, g]))
  const begleitMap  = new Map(begleitpersonen.map(b => [b.id, b]))

  // Stats
  const totalCapacity = seatingTables.reduce((s, t) => s + t.capacity, 0)

  // "Platziert" = all seated (including brautpaar slots)
  const placedCount = seatingAssignments.length

  // "Ohne Platz" = confirmed guests + confirmed begleitpersonen that have no seat assignment
  const confirmedGuestCount  = guests.filter(g => g.status === 'zugesagt').length
  const confirmedBegleitCount = begleitpersonen.filter(b => guestMap.get(b.guest_id)?.status === 'zugesagt').length
  // Only count guest/begleit assignments, not brautpaar slots
  const guestSeatedCount = seatingAssignments.filter(a => a.brautpaar_slot == null).length
  const unplaced = Math.max(0, (confirmedGuestCount + confirmedBegleitCount) - guestSeatedCount)

  // Group assignments by table
  const assignmentsByTable = new Map<string, typeof seatingAssignments>()
  for (const t of seatingTables) assignmentsByTable.set(t.id, [])
  for (const a of seatingAssignments) {
    assignmentsByTable.get(a.table_id)?.push(a)
  }

  // SVG dimensions (landscape A4 minus margins)
  const svgW = 769  // ~841 - 2*36
  const svgH = 340

  const svg = buildRoomSvg(roomPoints, seatingTables, svgW, svgH)

  return (
    <>
      {/* Page 1: Room visualization */}
      <Page size="A4" orientation="landscape" style={S.pageLandscape}>
        <View style={S.sectionHeader}>
          <Text style={S.sectionHeaderText}>Sitzplan</Text>
        </View>

        <View style={S.statRow}>
          <View style={S.statBox}>
            <Text style={S.statValue}>{seatingTables.length}</Text>
            <Text style={S.statLabel}>Tische</Text>
          </View>
          <View style={S.statBox}>
            <Text style={S.statValue}>{totalCapacity}</Text>
            <Text style={S.statLabel}>Kapazität</Text>
          </View>
          <View style={S.statBox}>
            <Text style={[S.statValue, { color: COLORS.green }]}>{placedCount}</Text>
            <Text style={S.statLabel}>Platziert</Text>
          </View>
          <View style={S.statBox}>
            <Text style={[S.statValue, { color: unplaced > 0 ? COLORS.amber : COLORS.midGray }]}>{unplaced}</Text>
            <Text style={S.statLabel}>Ohne Platz</Text>
          </View>
        </View>

        {/* SVG Room Plan */}
        {svg ? (
          <View style={{
            borderWidth: 1, borderColor: COLORS.border, borderStyle: 'solid',
            borderRadius: 4, backgroundColor: COLORS.ultraLight,
            overflow: 'hidden', marginBottom: 14,
          }}>
            <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
              {/* Room polygon */}
              <Polygon
                points={svg.polyPoints}
                fill={COLORS.lightGray}
                stroke={COLORS.darkGray}
                strokeWidth={1.5}
              />
              {/* Tables with name labels */}
              {svg.tableElems.map((t, i) => {
                if (t.type === 'circle') {
                  return (
                    <G key={i}>
                      <Circle
                        cx={t.cx} cy={t.cy} r={t.r}
                        fill={COLORS.white}
                        stroke={COLORS.black}
                        strokeWidth={1}
                      />
                      <Text
                        x={t.cx} y={t.cy + 3}
                        textAnchor="middle"
                        fontSize={Math.min(8, Math.max(5, t.r * 0.55))}
                        fill={COLORS.darkGray}
                        fontFamily="Helvetica"
                      >
                        {t.name}
                      </Text>
                    </G>
                  )
                } else {
                  const hw = t.w / 2
                  const hh = t.h / 2
                  return (
                    <G key={i} transform={`rotate(${t.rotation}, ${t.cx}, ${t.cy})`}>
                      <Rect
                        x={t.cx - hw} y={t.cy - hh}
                        width={t.w} height={t.h}
                        fill={COLORS.white}
                        stroke={COLORS.black}
                        strokeWidth={1}
                      />
                      <Text
                        x={t.cx} y={t.cy + 3}
                        textAnchor="middle"
                        fontSize={Math.min(8, Math.max(5, Math.min(t.w, t.h) * 0.35))}
                        fill={COLORS.darkGray}
                        fontFamily="Helvetica"
                      >
                        {t.name}
                      </Text>
                    </G>
                  )
                }
              })}
            </Svg>
          </View>
        ) : (
          <View style={{
            borderWidth: 1, borderColor: COLORS.border, borderStyle: 'solid',
            borderRadius: 4, backgroundColor: COLORS.ultraLight,
            padding: 20, marginBottom: 14, alignItems: 'center',
          }}>
            <Text style={[S.muted, S.small]}>Kein Raumplan konfiguriert</Text>
          </View>
        )}

        {/* Table legend */}
        {seatingTables.length > 0 && (
          <>
            <Text style={S.subHeader}>Tischübersicht</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {seatingTables.map(t => {
                const assigned = assignmentsByTable.get(t.id) ?? []
                return (
                  <View key={t.id} style={{
                    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'solid',
                    borderRadius: 3, paddingVertical: 4, paddingHorizontal: 8,
                    flexDirection: 'row', gap: 6, alignItems: 'center',
                  }}>
                    <View style={{
                      width: 10, height: 10, borderRadius: t.shape === 'round' ? 5 : 2,
                      borderWidth: 1, borderColor: COLORS.black, borderStyle: 'solid',
                      backgroundColor: COLORS.white,
                    }} />
                    <Text style={{ fontSize: 8 }}>{t.name}</Text>
                    <Text style={[S.small, S.muted]}>{assigned.length}/{t.capacity}</Text>
                  </View>
                )
              })}
            </View>
          </>
        )}

        <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>

      {/* Page 2+: Table assignment detail */}
      {seatingTables.length > 0 && (
        <Page size="A4" orientation="portrait" style={S.page}>
          <View style={[S.sectionHeader, { backgroundColor: COLORS.darkGray }]}>
            <Text style={S.sectionHeaderText}>Sitzplan — Tischzuweisungen</Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {seatingTables.map(t => {
              const assignments = assignmentsByTable.get(t.id) ?? []
              const rows: Array<{ label: string; extra: string; muted?: boolean }> = []

              for (const a of assignments) {
                if (a.brautpaar_slot != null) {
                  // Resolve brautpaar name: split on ' & ', fall back gracefully
                  const parts = coupleName?.split(' & ') ?? []
                  const slotName = a.brautpaar_slot === 1
                    ? (parts[0] || 'Brautpaar 1')
                    : (parts[1] || parts[0] || 'Brautpaar 2')
                  rows.push({ label: slotName, extra: '(Brautpaar)' })
                } else if (a.guest_id) {
                  const g = guestMap.get(a.guest_id)
                  if (g) {
                    rows.push({
                      label: g.name,
                      extra: [g.meal_choice, ...(g.allergy_tags ?? []).map(allergyLabel)].filter(Boolean).join(', '),
                    })
                  }
                } else if (a.begleitperson_id) {
                  const b = begleitMap.get(a.begleitperson_id)
                  if (b) {
                    rows.push({
                      label: `  └ ${b.name}`,
                      extra: [b.meal_choice, ...(b.allergy_tags ?? []).map(allergyLabel)].filter(Boolean).join(', '),
                      muted: true,
                    })
                  }
                }
              }

              // Show up to 3 empty seats to indicate remaining capacity
              const emptySeats = t.capacity - assignments.length
              for (let i = 0; i < Math.min(emptySeats, 3); i++) {
                rows.push({ label: '— (frei)', extra: '', muted: true })
              }

              return (
                <View key={t.id} style={{ width: '47%' }} wrap={false}>
                  <View style={{
                    backgroundColor: COLORS.lightGray,
                    paddingVertical: 5, paddingHorizontal: 8,
                    flexDirection: 'row', justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.black }}>
                      {t.name}
                    </Text>
                    <Text style={[S.small, S.muted]}>
                      {assignments.length}/{t.capacity} Plätze
                    </Text>
                  </View>
                  <View style={{
                    borderWidth: 1, borderTopWidth: 0,
                    borderColor: COLORS.border, borderStyle: 'solid',
                    borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
                  }}>
                    {rows.map((r, ri) => (
                      <View key={ri} style={{
                        flexDirection: 'row',
                        borderTopWidth: ri === 0 ? 0 : 0.5,
                        borderTopColor: COLORS.border,
                        borderTopStyle: 'solid',
                        paddingVertical: 4, paddingHorizontal: 7,
                        backgroundColor: ri % 2 === 0 ? COLORS.white : COLORS.ultraLight,
                      }}>
                        <Text style={{
                          flex: 1, fontSize: 8,
                          color: r.muted ? COLORS.midGray : COLORS.darkGray,
                          fontStyle: r.muted ? 'italic' : 'normal',
                        }}>
                          {r.label}
                        </Text>
                        {r.extra ? (
                          <Text style={{ fontSize: 7, color: COLORS.midGray, maxWidth: 80 }}>{r.extra}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              )
            })}
          </View>

          <Text style={S.footer} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      )}
    </>
  )
}
