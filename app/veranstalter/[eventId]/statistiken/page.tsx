import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ eventId: string }>
}

function fmtMoney(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const STATUS_LABELS: Record<string, string> = {
  angelegt: 'Angelegt', eingeladen: 'Eingeladen', zugesagt: 'Zugesagt',
  abgesagt: 'Abgesagt', vielleicht: 'Vielleicht',
}

const STATUS_COLORS: Record<string, string> = {
  zugesagt: '#34C759', abgesagt: '#FF3B30', vielleicht: '#FF9500',
  eingeladen: '#007AFF', angelegt: '#8E8E93',
}

export default async function StatistikenPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  const [eventRes, guestsRes, vendorsRes, budgetRes, tasksRes] = await Promise.all([
    supabase.from('events').select('budget_total, organizer_fee').eq('id', eventId).single(),
    supabase.from('guests').select('id, status').eq('event_id', eventId),
    supabase.from('vendors').select('id, name, category, price, status').eq('event_id', eventId),
    supabase.from('budget_items').select('id, category, planned, actual, payment_status').eq('event_id', eventId),
    supabase.from('tasks').select('id, title, done, phase').eq('event_id', eventId).order('created_at'),
  ])

  const event = eventRes.data
  const guests = guestsRes.data ?? []
  const vendors = vendorsRes.data ?? []
  const budgetItems = budgetRes.data ?? []
  const tasks = tasksRes.data ?? []

  const budgetTotal = event?.budget_total ?? 0
  const organizerFee = event?.organizer_fee ?? 0
  const totalSpent = budgetItems.reduce((s, b) => s + (b.actual ?? 0), 0)
  const totalPlanned = budgetItems.reduce((s, b) => s + (b.planned ?? 0), 0)
  const vendorTotal = vendors.reduce((s, v) => s + (v.price ?? 0), 0)
  const remaining = budgetTotal - totalSpent
  const margin = budgetTotal - vendorTotal - organizerFee

  // Guest stats by status
  const guestByStatus = guests.reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = (acc[g.status] ?? 0) + 1
    return acc
  }, {})

  // Vendor cost by category
  const vendorByCategory = vendors.reduce<Record<string, number>>((acc, v) => {
    const cat = v.category ?? 'Sonstiges'
    acc[cat] = (acc[cat] ?? 0) + (v.price ?? 0)
    return acc
  }, {})

  const vendorCategories = Object.entries(vendorByCategory).sort((a, b) => b[1] - a[1])
  const maxVendorCost = Math.max(...vendorCategories.map(([, v]) => v), 1)

  // Donut chart: budget distribution
  const donutData = vendorCategories.slice(0, 6)
  const donutColors = ['#007AFF', '#FF9500', '#AF52DE', '#34C759', '#FF3B30', '#5AC8FA']
  const donutTotal = donutData.reduce((s, [, v]) => s + v, 1)

  let donutOffset = 0
  const DONUT_R = 60
  const DONUT_CIRC = 2 * Math.PI * DONUT_R
  const donutSegments = donutData.map(([cat, val], i) => {
    const pct = val / donutTotal
    const dash = pct * DONUT_CIRC
    const gap = DONUT_CIRC - dash
    const seg = { cat, val, color: donutColors[i % donutColors.length], dash, gap, offset: donutOffset }
    donutOffset += dash
    return seg
  })

  const tasksDone = tasks.filter(t => t.done).length
  const tasksProgress = tasks.length > 0 ? (tasksDone / tasks.length) * 100 : 0

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--heading-font)', fontSize: 28, fontWeight: 600, marginBottom: 6 }}>Statistiken</h1>
      <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 28 }}>Finanzielle Übersicht und Event-Kennzahlen</p>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiBox label="Gesamtbudget" value={fmtMoney(budgetTotal)} color="var(--text)" />
        <KpiBox label="Ausgegeben" value={fmtMoney(totalSpent)} color="#007AFF" />
        <KpiBox label="Verbleibend" value={fmtMoney(remaining)} color={remaining >= 0 ? 'var(--green)' : 'var(--red)'} />
        <KpiBox label="Veranstalter-Marge" value={fmtMoney(margin)} color={margin >= 0 ? 'var(--green)' : 'var(--red)'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Donut chart: Budget nach Kategorie */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Budget nach Kategorie</h3>
          {vendorTotal === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>Keine Daten</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <svg width={160} height={160} style={{ flexShrink: 0 }}>
                <circle cx={80} cy={80} r={DONUT_R} fill="none" stroke="var(--surface2)" strokeWidth={20} />
                {donutSegments.map(s => (
                  <circle
                    key={s.cat}
                    cx={80} cy={80} r={DONUT_R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={20}
                    strokeDasharray={`${s.dash} ${s.gap}`}
                    strokeDashoffset={-s.offset + DONUT_CIRC / 4}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '80px 80px' }}
                  />
                ))}
                <text x={80} y={75} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-dim)' }}>Gesamt</text>
                <text x={80} y={93} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: 'var(--text)' }}>{fmtMoney(vendorTotal)}</text>
              </svg>
              <div style={{ flex: 1 }}>
                {donutSegments.map(s => (
                  <div key={s.cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, flex: 1, color: 'var(--text-mid)' }}>{s.cat}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{Math.round((s.val / donutTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Gäste-Status */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Gäste-Status</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <GuestStat label="Gesamt" value={guests.length} color="var(--text)" />
            <GuestStat label="Zugesagt" value={guestByStatus.zugesagt ?? 0} color="#34C759" />
            <GuestStat label="Abgesagt" value={guestByStatus.abgesagt ?? 0} color="#FF3B30" />
            <GuestStat label="Ausstehend" value={(guestByStatus.eingeladen ?? 0) + (guestByStatus.angelegt ?? 0)} color="#8E8E93" />
          </div>
          {guests.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Rücklauf</div>
              <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                {Object.entries(guestByStatus).map(([status, count]) => (
                  <div
                    key={status}
                    style={{
                      height: '100%',
                      width: `${(count / guests.length) * 100}%`,
                      background: STATUS_COLORS[status] ?? '#ccc',
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {Object.entries(guestByStatus).map(([status, count]) => (
                  <span key={status} style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    <span style={{ width: 8, height: 8, background: STATUS_COLORS[status] ?? '#ccc', display: 'inline-block', borderRadius: 2, marginRight: 4 }} />
                    {STATUS_LABELS[status] ?? status} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bar chart: Ausgaben nach Dienstleister */}
      {vendorCategories.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Ausgaben nach Kategorie</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vendorCategories.map(([cat, val], i) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 120, fontSize: 13, color: 'var(--text-mid)', flexShrink: 0 }}>{cat}</div>
                <div style={{ flex: 1, height: 20, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(val / maxVendorCost) * 100}%`, background: donutColors[i % donutColors.length], borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <div style={{ width: 80, fontSize: 13, fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{fmtMoney(val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Cost table */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Dienstleister-Kosten</h3>
          {vendors.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>Keine Dienstleister</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Kategorie</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Kosten</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 8px', color: 'var(--text)' }}>{v.name ?? '—'}</td>
                    <td style={{ padding: '8px 8px', color: 'var(--text-dim)' }}>{v.category ?? '—'}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 500 }}>{v.price != null ? fmtMoney(v.price) : '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ padding: '8px 8px', fontWeight: 700 }}>Gesamt</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(vendorTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Tasks progress */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 24 }}>
          <h3 style={{ fontFamily: 'var(--heading-font)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Aufgaben-Fortschritt</h3>
          {tasks.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>Keine Aufgaben</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span>{tasksDone} von {tasks.length} erledigt</span>
                <span style={{ fontWeight: 600 }}>{Math.round(tasksProgress)}%</span>
              </div>
              <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ height: '100%', width: `${tasksProgress}%`, background: 'var(--green)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tasks.slice(0, 8).map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${t.done ? 'var(--green)' : 'var(--border2)'}`, background: t.done ? 'var(--green)' : 'transparent', flexShrink: 0 }} />
                    <span style={{ color: t.done ? 'var(--text-dim)' : 'var(--text)', textDecoration: t.done ? 'line-through' : 'none' }}>
                      {t.title ?? 'Aufgabe'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--heading-font)', color }}>{value}</div>
    </div>
  )
}

function GuestStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 'var(--r-sm)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
