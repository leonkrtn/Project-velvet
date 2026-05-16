export default function Loading() {
  const HOUR_H = 80
  const hours = Array.from({ length: 16 }, (_, i) => i + 8)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div className="skeleton" style={{ height: 32, width: 180, marginBottom: 16, flexShrink: 0 }} />
      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexShrink: 0 }}>
        {[80, 80, 80].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 'var(--radius-sm)' }} />
        ))}
      </div>
      {/* Calendar shell */}
      <div style={{ flex: 1, overflowY: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface)', position: 'relative' }}>
        <div style={{ position: 'relative', height: hours.length * HOUR_H }}>
          {hours.map((h, i) => (
            <div key={h} style={{ position: 'absolute', top: i * HOUR_H, left: 0, right: 0, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', paddingTop: 6 }}>
              <div className="skeleton" style={{ height: 10, width: 36, marginLeft: 12, borderRadius: 4 }} />
            </div>
          ))}
          {[
            { top: 1*HOUR_H, height: 1.5*HOUR_H, left: '60px', width: '55%' },
            { top: 3*HOUR_H, height: HOUR_H, left: '60px', width: '40%' },
            { top: 5*HOUR_H, height: 2*HOUR_H, left: '60px', width: '60%' },
            { top: 8.5*HOUR_H, height: HOUR_H, left: '60px', width: '45%' },
            { top: 10*HOUR_H, height: 1.5*HOUR_H, left: '60px', width: '50%' },
          ].map((ev, i) => (
            <div key={i} className="skeleton" style={{ position: 'absolute', top: ev.top + 2, left: ev.left, width: ev.width, height: ev.height - 4, borderRadius: 6 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
