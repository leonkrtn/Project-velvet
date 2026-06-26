export default function Loading() {
  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 22, width: 120, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: 220 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[80, 100, 80].map((w, i) => <div key={i} className="skeleton" style={{ width: w, height: 32, borderRadius: 8 }} />)}
        </div>
        {[0,1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: 90, borderRadius: 13, marginBottom: 10 }} />
        ))}
      </div>
    </div>
  )
}
