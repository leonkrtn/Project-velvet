export default function Loading() {
  const HOUR_H = 80
  const hours = Array.from({ length: 16 }, (_, i) => i + 8)
  return (
    <div className="bp-page">
      {/* h1 Ablaufplan */}
      <div className="bp-skeleton" style={{ height: 28, width: 160, marginBottom: 16, borderRadius: 8 }} />
      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[80, 80, 80].map((w, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 32, width: w, borderRadius: 8 }} />
        ))}
      </div>
      {/* Calendar shell */}
      <div style={{ flex: 1, overflowY: 'auto', borderRadius: 12, border: '1px solid var(--bp-rule)', background: 'var(--bp-white)', position: 'relative' }}>
        <div style={{ position: 'relative', height: hours.length * HOUR_H }}>
          {hours.map((h, i) => (
            <div key={h} style={{ position: 'absolute', top: i * HOUR_H, left: 0, right: 0, borderTop: '1px solid var(--bp-rule)', display: 'flex', alignItems: 'flex-start', paddingTop: 6 }}>
              <div className="bp-skeleton" style={{ height: 10, width: 36, marginLeft: 12, borderRadius: 4 }} />
            </div>
          ))}
          {/* Fake event blocks */}
          {[
            { top: 1*HOUR_H, height: 1.5*HOUR_H, left: '60px', width: '55%' },
            { top: 3*HOUR_H, height: HOUR_H, left: '60px', width: '40%' },
            { top: 5*HOUR_H, height: 2*HOUR_H, left: '60px', width: '60%' },
            { top: 8.5*HOUR_H, height: HOUR_H, left: '60px', width: '45%' },
          ].map((ev, i) => (
            <div key={i} className="bp-skeleton" style={{ position: 'absolute', top: ev.top + 2, left: ev.left, width: ev.width, height: ev.height - 4, borderRadius: 6 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
