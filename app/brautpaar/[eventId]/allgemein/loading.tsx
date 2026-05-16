export default function Loading() {
  return (
    <div className="bp-page">
      <div className="bp-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div className="bp-skeleton" style={{ height: 28, width: 160, marginBottom: 8, borderRadius: 8 }} />
          <div className="bp-skeleton" style={{ height: 16, width: 240, borderRadius: 6 }} />
        </div>
        <div className="bp-skeleton" style={{ height: 36, width: 100, borderRadius: 8, flexShrink: 0 }} />
      </div>
      {/* 4 section cards */}
      {[3, 4, 2, 3].map((rows, ci) => (
        <div key={ci} style={{ background: 'var(--bp-white)', border: '1px solid var(--bp-rule)', borderRadius: 12, overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--bp-rule)' }}>
            <div className="bp-skeleton" style={{ height: 14, width: 160, borderRadius: 6 }} />
          </div>
          <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Array.from({ length: rows }).map((_, ri) => (
              <div key={ri}>
                <div className="bp-skeleton" style={{ height: 11, width: 100, marginBottom: 6, borderRadius: 4 }} />
                <div className="bp-skeleton" style={{ height: 38, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
