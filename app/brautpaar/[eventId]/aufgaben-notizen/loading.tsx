export default function Loading() {
  return (
    <div className="bp-page">
      {/* Header */}
      <div className="bp-page-header">
        <div className="bp-skeleton" style={{ height: 28, width: 220, borderRadius: 8 }} />
      </div>
      {/* Toggle: 2 options (Aufgaben / Notizen) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[110, 100].map((w, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 36, width: w, borderRadius: 8 }} />
        ))}
      </div>
      {/* Content: list of cards */}
      <div style={{ minHeight: 480 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 150, borderRadius: 12, marginBottom: 12 }} />
        ))}
      </div>
    </div>
  )
}
