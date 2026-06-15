export default function Loading() {
  return (
    <div className="bp-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="bp-skeleton" style={{ height: 28, width: 140, borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[100, 110].map((w, i) => (
            <div key={i} className="bp-skeleton" style={{ height: 34, width: w, borderRadius: 8 }} />
          ))}
        </div>
      </div>
      {/* Canvas / room plan area */}
      <div className="bp-skeleton" style={{ height: 'min(60vh, 520px)', borderRadius: 12, marginBottom: 16 }} />
      {/* Table chips below */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 64, borderRadius: 10 }} />
        ))}
      </div>
    </div>
  )
}
