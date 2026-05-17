export default function Loading() {
  return (
    <div>
      <div className="skeleton" style={{ height: 32, width: 140, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: 260, marginBottom: 24 }} />
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Requirements sidebar */}
        <div style={{ width: 300, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
          {[100, 120, 90, 110, 80, 100].map((w, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
              <div className="skeleton" style={{ height: 10, width: 70, marginBottom: 6, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 13, width: w, borderRadius: 4 }} />
            </div>
          ))}
        </div>
        {/* Song list */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[60, 80, 70, 80, 60].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 'var(--radius-sm)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 13, width: `${40 + (i * 11) % 30}%`, marginBottom: 5, borderRadius: 4 }} />
                  <div className="skeleton" style={{ height: 11, width: `${30 + (i * 7) % 20}%`, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
