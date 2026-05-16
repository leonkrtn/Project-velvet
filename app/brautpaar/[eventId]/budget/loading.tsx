export default function Loading() {
  return (
    <div className="bp-page">
      <div className="bp-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div className="bp-skeleton" style={{ height: 28, width: 100, marginBottom: 8, borderRadius: 8 }} />
          <div className="bp-skeleton" style={{ height: 16, width: 220, borderRadius: 6 }} />
        </div>
        <div className="bp-skeleton" style={{ height: 36, width: 130, borderRadius: 8, flexShrink: 0 }} />
      </div>
      {/* 3 stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ background: 'var(--bp-white)', border: '1px solid var(--bp-rule)', borderRadius: 12, padding: '14px 16px' }}>
            <div className="bp-skeleton" style={{ height: 11, width: '55%', marginBottom: 10, borderRadius: 4 }} />
            <div className="bp-skeleton" style={{ height: 26, width: '45%', borderRadius: 6 }} />
          </div>
        ))}
      </div>
      {/* Budget table card */}
      <div style={{ background: 'var(--bp-white)', border: '1px solid var(--bp-rule)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--bp-rule)' }}>
          <div className="bp-skeleton" style={{ height: 14, width: 120, borderRadius: 6 }} />
          <div className="bp-skeleton" style={{ height: 32, width: 110, borderRadius: 8 }} />
        </div>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '8px 18px 6px', borderBottom: '1px solid var(--bp-rule)' }}>
          {[180, 70, 70, 60].map((w, i) => <div key={i} className="bp-skeleton" style={{ height: 10, width: w, borderRadius: 4 }} />)}
        </div>
        {/* Item rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '11px 18px', borderBottom: i < 5 ? '1px solid var(--bp-rule)' : 'none' }}>
            <div className="bp-skeleton" style={{ height: 12, width: `${45 + (i * 11) % 30}%`, borderRadius: 4 }} />
            <div className="bp-skeleton" style={{ height: 12, width: 60, borderRadius: 4 }} />
            <div className="bp-skeleton" style={{ height: 12, width: 60, borderRadius: 4 }} />
            <div className="bp-skeleton" style={{ height: 20, width: 50, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
