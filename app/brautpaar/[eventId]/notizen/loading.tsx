export default function Loading() {
  return (
    <div className="bp-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
        <div>
          <div className="bp-skeleton" style={{ height: 30, width: 160, marginBottom: 8, borderRadius: 8 }} />
          <div className="bp-skeleton" style={{ height: 16, width: 220, borderRadius: 6 }} />
        </div>
        <div className="bp-skeleton" style={{ height: 38, width: 140, borderRadius: 8, flexShrink: 0 }} />
      </div>
      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[90, 110, 80, 120, 70, 90].map((w, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 32, width: w, borderRadius: 999 }} />
        ))}
      </div>
      {/* Note cards */}
      {[1, 2, 3].map(i => (
        <div key={i} className="bp-skeleton" style={{ height: 160, borderRadius: 12, marginBottom: 12 }} />
      ))}
    </div>
  )
}
