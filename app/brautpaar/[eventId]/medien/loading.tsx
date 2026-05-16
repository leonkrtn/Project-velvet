export default function Loading() {
  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <div className="bp-skeleton" style={{ height: 28, width: 200, marginBottom: 8, borderRadius: 8 }} />
        <div className="bp-skeleton" style={{ height: 16, width: 260, borderRadius: 6 }} />
      </div>
      {/* Briefing card */}
      <div style={{ background: 'var(--bp-white)', border: '1px solid var(--bp-rule)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <div className="bp-skeleton" style={{ height: 10, width: 70, marginBottom: 16, borderRadius: 4 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[0,1].map(i => (
            <div key={i}>
              <div className="bp-skeleton" style={{ height: 12, width: 60, marginBottom: 8, borderRadius: 4 }} />
              {[100, 85, 70].map((w, j) => (
                <div key={j} className="bp-skeleton" style={{ height: 13, width: `${w}%`, marginBottom: 5, borderRadius: 4 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[60, 130, 80, 90].map((w, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 32, width: w, borderRadius: 8 }} />
        ))}
      </div>
      {/* Shot list */}
      {[3, 4].map((count, gi) => (
        <div key={gi} style={{ marginBottom: 16 }}>
          <div className="bp-skeleton" style={{ height: 10, width: 90, marginBottom: 10, borderRadius: 4 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} style={{ background: 'var(--bp-white)', border: '1px solid var(--bp-rule)', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10 }}>
                <div className="bp-skeleton" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="bp-skeleton" style={{ height: 13, width: `${50 + (i * 13) % 30}%`, marginBottom: 5, borderRadius: 4 }} />
                  <div className="bp-skeleton" style={{ height: 11, width: `${35 + (i * 9) % 25}%`, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
