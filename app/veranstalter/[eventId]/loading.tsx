export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header: title + subtitle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div className="skeleton" style={{ height: 32, width: 220, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, width: 160 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 34, width: 100, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 34, width: 120, borderRadius: 8 }} />
        </div>
      </div>
      {/* Main content card */}
      <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
      {/* Two-column row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="skeleton" style={{ height: 140, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 140, borderRadius: 12 }} />
      </div>
    </div>
  )
}
