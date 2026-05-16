export default function Loading() {
  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <div className="bp-skeleton" style={{ height: 28, width: 140, marginBottom: 8, borderRadius: 8 }} />
        <div className="bp-skeleton" style={{ height: 16, width: 240, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Sidebar: requirements */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[100, 120, 90, 110, 80].map((w, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--bp-rule)' }}>
              <div className="bp-skeleton" style={{ height: 10, width: 70, marginBottom: 6, borderRadius: 4 }} />
              <div className="bp-skeleton" style={{ height: 13, width: w, borderRadius: 4 }} />
            </div>
          ))}
        </div>
        {/* Song list */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[60, 80, 70, 80].map((w, i) => (
              <div key={i} className="bp-skeleton" style={{ height: 32, width: w, borderRadius: 8 }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bp-white)', border: '1px solid var(--bp-rule)', borderRadius: 10, marginBottom: 4 }}>
                <div className="bp-skeleton" style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="bp-skeleton" style={{ height: 13, width: `${40 + (i * 11) % 30}%`, marginBottom: 5, borderRadius: 4 }} />
                  <div className="bp-skeleton" style={{ height: 11, width: `${30 + (i * 7) % 20}%`, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
