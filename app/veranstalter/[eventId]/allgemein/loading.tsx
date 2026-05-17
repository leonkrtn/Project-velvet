export default function Loading() {
  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="skeleton" style={{ height: 32, width: 140, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: 280, marginBottom: 28 }} />
      {[3, 3, 2, 2].map((rows, ci) => (
        <div key={ci} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 22px', marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 13, width: 160, marginBottom: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: rows }).map((_, ri) => (
              <div key={ri}>
                <div className="skeleton" style={{ height: 11, width: 100, marginBottom: 6, borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 38, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="skeleton" style={{ height: 44, width: 120, borderRadius: 8 }} />
    </div>
  )
}
