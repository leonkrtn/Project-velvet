export default function Loading() {
  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 22, width: 120, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: 260 }} />
          </div>
          <div className="skeleton" style={{ width: 80, height: 34, borderRadius: 9 }} />
          <div className="skeleton" style={{ width: 72, height: 34, borderRadius: 9 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 12 }} />)}
        </div>
        <div className="skeleton" style={{ height: 200, borderRadius: 10, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 140, borderRadius: 10 }} />
      </div>
    </div>
  )
}
