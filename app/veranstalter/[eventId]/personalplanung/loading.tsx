export default function Loading() {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, width: 260 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 34, width: 120, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 34, width: 140, borderRadius: 8 }} />
        </div>
      </div>
      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 8, margin: '20px 0 16px', flexWrap: 'wrap' }}>
        {[60, 60, 60, 60, 60, 60, 60].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 20 }} />
        ))}
      </div>
      {/* Schedule board: role columns with shift cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="skeleton" style={{ height: 10, width: 10, borderRadius: 3 }} />
              <div className="skeleton" style={{ height: 12, width: 90 }} />
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 2 + (col % 3) }).map((_, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ height: 13, width: `${55 + (i * 11) % 30}%` }} />
                  <div className="skeleton" style={{ height: 11, width: 110 }} />
                  <div className="skeleton" style={{ height: 11, width: 70 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
