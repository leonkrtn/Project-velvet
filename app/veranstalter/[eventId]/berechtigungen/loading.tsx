export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, width: 300 }} />
        </div>
        <div className="skeleton" style={{ height: 34, width: 140, borderRadius: 8 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: `${35 + (i * 11) % 25}%`, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: `${25 + (i * 7) % 20}%` }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton" style={{ height: 28, width: 60, borderRadius: 6 }} />
              <div className="skeleton" style={{ height: 28, width: 90, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
