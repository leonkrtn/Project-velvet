export default function Loading() {
  return (
    <div className="bp-page">
      {/* h1 Catering & Menü */}
      <div className="bp-skeleton" style={{ height: 28, width: 190, marginBottom: 8, borderRadius: 8 }} />
      <div className="bp-skeleton" style={{ height: 16, width: 300, marginBottom: 28, borderRadius: 6 }} />
      {/* 3 section cards */}
      {[
        { rows: 2, twoCol: true },
        { rows: 3, twoCol: false },
        { rows: 2, twoCol: false },
      ].map((cfg, ci) => (
        <div key={ci} style={{ background: 'var(--bp-white)', border: '1px solid var(--bp-rule)', borderRadius: 12, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bp-rule)' }}>
            <div className="bp-skeleton" style={{ height: 13, width: 160, borderRadius: 6 }} />
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: cfg.rows }).map((_, ri) =>
              cfg.twoCol && ri === 0 ? (
                <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="bp-skeleton" style={{ height: 38, borderRadius: 8 }} />
                  <div className="bp-skeleton" style={{ height: 38, borderRadius: 8 }} />
                </div>
              ) : (
                <div className="bp-skeleton" key={ri} style={{ height: 38, borderRadius: 8 }} />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
