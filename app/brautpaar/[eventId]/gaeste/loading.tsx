export default function Loading() {
  return (
    <div className="bp-page">
      {/* Header */}
      <div className="bp-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div className="bp-skeleton" style={{ height: 28, width: 140, marginBottom: 8, borderRadius: 8 }} />
          <div className="bp-skeleton" style={{ height: 16, width: 200, borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="bp-skeleton" style={{ height: 36, width: 110, borderRadius: 8 }} />
          <div className="bp-skeleton" style={{ height: 36, width: 130, borderRadius: 8 }} />
        </div>
      </div>
      {/* Tab bar: 4 tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--bp-rule)', marginBottom: '1.5rem' }}>
        {[80, 70, 90, 100].map((w, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 32, width: w, borderRadius: '8px 8px 0 0' }} />
        ))}
      </div>
      {/* Table */}
      <div style={{ background: 'var(--bp-white)', border: '1px solid var(--bp-rule)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 100px', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--bp-rule)' }}>
          {[140, 70, 80, 60].map((w, i) => (
            <div key={i} className="bp-skeleton" style={{ height: 10, width: w, borderRadius: 4 }} />
          ))}
        </div>
        {/* Guest rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 100px', gap: 12, padding: '12px 16px', borderBottom: i < 7 ? '1px solid var(--bp-rule)' : 'none' }}>
            <div className="bp-skeleton" style={{ height: 12, width: `${50 + (i * 13) % 30}%`, borderRadius: 4 }} />
            <div className="bp-skeleton" style={{ height: 20, width: 60, borderRadius: 20 }} />
            <div className="bp-skeleton" style={{ height: 12, width: 70, borderRadius: 4 }} />
            <div className="bp-skeleton" style={{ height: 12, width: 50, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
