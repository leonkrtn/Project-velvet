export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header: h1 Übersicht + phase badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div className="skeleton" style={{ height: 32, width: 140 }} />
        <div className="skeleton" style={{ height: 28, width: 100, borderRadius: 20 }} />
      </div>
      {/* Stats grid: 4 cards auto-fit */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
            <div className="skeleton" style={{ height: 10, width: '55%', marginBottom: 12, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 28, width: '45%', borderRadius: 6 }} />
          </div>
        ))}
      </div>
      {/* Two-column: budget card + todo list */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Budget card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ height: 14, width: 80 }} />
            <div className="skeleton" style={{ height: 14, width: 100 }} />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="skeleton" style={{ height: 12, width: `${35 + (i * 13) % 30}%` }} />
              <div className="skeleton" style={{ height: 12, width: 60 }} />
            </div>
          ))}
        </div>
        {/* Todo list */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ height: 14, width: 100 }} />
            <div className="skeleton" style={{ height: 28, width: 80, borderRadius: 8 }} />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="skeleton" style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
              <div className="skeleton" style={{ height: 12, width: `${40 + (i * 11) % 30}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
