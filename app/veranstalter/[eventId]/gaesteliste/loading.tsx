export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div className="skeleton" style={{ height: 32, width: 160, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, width: 220 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 34, width: 100, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 34, width: 130, borderRadius: 8 }} />
        </div>
      </div>
      {/* Filters row */}
      <div style={{ display: 'flex', gap: 8, margin: '20px 0 16px', flexWrap: 'wrap' }}>
        {[70, 90, 80, 100, 75, 60].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 32, width: w, borderRadius: 20 }} />
        ))}
      </div>
      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 160px 100px', gap: 12, padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          {[160, 70, 80, 100, 60].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 10, width: w, borderRadius: 4 }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 160px 100px', gap: 12, padding: '12px 16px', borderBottom: i < 9 ? '1px solid var(--border)' : 'none' }}>
            <div className="skeleton" style={{ height: 13, width: `${40 + (i * 13) % 35}%` }} />
            <div className="skeleton" style={{ height: 20, width: 70, borderRadius: 20 }} />
            <div className="skeleton" style={{ height: 13, width: 80 }} />
            <div className="skeleton" style={{ height: 13, width: 100 }} />
            <div className="skeleton" style={{ height: 13, width: 60 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
