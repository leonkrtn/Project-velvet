export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div className="skeleton" style={{ height: 32, width: 140, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, width: 240 }} />
        </div>
        <div className="skeleton" style={{ height: 34, width: 130, borderRadius: 8 }} />
      </div>
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: `${35 + (i * 13) % 30}%`, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: `${25 + (i * 9) % 25}%` }} />
            </div>
            <div className="skeleton" style={{ height: 24, width: 70, borderRadius: 20 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
