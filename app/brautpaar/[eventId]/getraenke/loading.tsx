export default function Loading() {
  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <div className="bp-skeleton" style={{ height: 11, width: 120, marginBottom: 8, borderRadius: 4 }} />
        <div className="bp-skeleton" style={{ height: 30, width: 240, marginBottom: 8, borderRadius: 8 }} />
        <div className="bp-skeleton" style={{ height: 16, width: 200, borderRadius: 6 }} />
      </div>
      {/* Sub-tabs (Mengenplanung / Budget / Cocktails) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[130, 90, 100].map((w, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 34, width: w, borderRadius: 8 }} />
        ))}
      </div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="bp-skeleton" style={{ height: 80, borderRadius: 12 }} />
        ))}
      </div>
      {/* Category blocks with article rows */}
      {[0, 1].map(c => (
        <div key={c} style={{ marginBottom: 24 }}>
          <div className="bp-skeleton" style={{ height: 18, width: 160, marginBottom: 12, borderRadius: 6 }} />
          {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="bp-skeleton" style={{ height: 48, borderRadius: 10, marginBottom: 8 }} />
          ))}
        </div>
      ))}
    </div>
  )
}
