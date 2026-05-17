export default function Loading() {
  return (
    <div>
      <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: 260, marginBottom: 24 }} />
      {/* Briefing card */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 9, width: 70, marginBottom: 16, borderRadius: 4 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[0,1].map(col => (
            <div key={col}>
              <div className="skeleton" style={{ height: 12, width: 60, marginBottom: 8 }} />
              {[100, 85, 70].map((w, j) => (
                <div key={j} className="skeleton" style={{ height: 13, width: `${w}%`, marginBottom: 5 }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,59,48,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,59,48,0.15)' }}>
          <div className="skeleton" style={{ height: 12, width: 140, marginBottom: 5 }} />
          <div className="skeleton" style={{ height: 12, width: '80%' }} />
        </div>
      </div>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[80, 130, 80, 90].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 'var(--radius-sm)' }} />
        ))}
      </div>
      {/* Shot groups */}
      {[3, 4].map((count, gi) => (
        <div key={gi} style={{ marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 9, width: 90, marginBottom: 10, borderRadius: 4 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', gap: 10 }}>
                <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 13, width: `${50 + (i * 13) % 30}%`, marginBottom: 5 }} />
                  <div className="skeleton" style={{ height: 12, width: `${35 + (i * 9) % 25}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
