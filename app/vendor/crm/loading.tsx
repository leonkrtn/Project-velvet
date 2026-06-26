export default function Loading() {
  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 22, width: 100, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: 220 }} />
          </div>
          <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 9 }} />
          <div className="skeleton" style={{ width: 100, height: 36, borderRadius: 9 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[80, 100, 90, 80, 100].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 32, borderRadius: 8 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 40, borderRadius: 10, marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[0,1,2,3].map(col => (
            <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="skeleton" style={{ height: 32, borderRadius: 8 }} />
              {[0,1,2].map(i => (
                <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
