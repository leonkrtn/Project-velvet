export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 32, width: 100 }} />
        <div className="skeleton" style={{ height: 34, width: 130, borderRadius: 8 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[70, 90, 80, 100, 70, 80].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 20 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--radius)' }} />
        ))}
      </div>
    </div>
  )
}
