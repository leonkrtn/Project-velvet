export default function Loading() {
  return (
    <div className="bp-page">
      <div className="bp-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div className="bp-skeleton" style={{ height: 28, width: 120, marginBottom: 8, borderRadius: 8 }} />
          <div className="bp-skeleton" style={{ height: 16, width: 200, borderRadius: 6 }} />
        </div>
        <div className="bp-skeleton" style={{ height: 36, width: 140, borderRadius: 8, flexShrink: 0 }} />
      </div>
      {/* Task list */}
      <div style={{ background: 'var(--bp-white)', border: '1px solid var(--bp-rule)', borderRadius: 12, overflow: 'hidden' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: i < 7 ? '1px solid var(--bp-rule)' : 'none' }}>
            <div className="bp-skeleton" style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="bp-skeleton" style={{ height: 13, width: `${40 + (i * 13) % 35}%`, borderRadius: 4 }} />
            </div>
            <div className="bp-skeleton" style={{ height: 20, width: 60, borderRadius: 10 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
