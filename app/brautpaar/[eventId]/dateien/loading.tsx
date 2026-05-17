export default function Loading() {
  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="bp-skeleton" style={{ height: 28, width: 100, borderRadius: 8 }} />
        <div className="bp-skeleton" style={{ height: 36, width: 130, borderRadius: 8 }} />
      </div>
      {/* Module filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[70, 90, 80, 100, 70].map((w, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 32, width: w, borderRadius: 8 }} />
        ))}
      </div>
      {/* File grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 160, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  )
}
