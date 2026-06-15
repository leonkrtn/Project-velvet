export default function Loading() {
  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="skeleton" style={{ height: 32, width: 220, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: 300, marginBottom: 28 }} />
      {/* Sub-tabs (Mengenplanung / Budget / Cocktails) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[140, 90, 100].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 34, width: w, borderRadius: 8 }} />
        ))}
      </div>
      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
            <div className="skeleton" style={{ height: 10, width: '55%', marginBottom: 12, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 28, width: '45%', borderRadius: 6 }} />
          </div>
        ))}
      </div>
      {/* Category tables */}
      {[0, 1].map(c => (
        <div key={c} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 22px', marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 14, width: 170, marginBottom: 18 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 3 }).map((_, r) => (
              <div key={r} className="skeleton" style={{ height: 40, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
