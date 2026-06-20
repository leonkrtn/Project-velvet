export default function Loading() {
  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: 320, marginBottom: 28 }} />
      {[
        { rows: 2, twoCol: true },
        { rows: 4, twoCol: false },
        { rows: 2, twoCol: false },
        { rows: 3, twoCol: false },
      ].map((cfg, ci) => (
        <div key={ci} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 22px', marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 13, width: 180, marginBottom: 18 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: cfg.rows }).map((_, ri) =>
              cfg.twoCol && ri === 0 ? (
                <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="skeleton" style={{ height: 38, borderRadius: 8 }} />
                  <div className="skeleton" style={{ height: 38, borderRadius: 8 }} />
                </div>
              ) : (
                <div key={ri} className="skeleton" style={{ height: 38, borderRadius: 8 }} />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
