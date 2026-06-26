export default function Loading() {
  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 22, width: 110, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: 240 }} />
          </div>
          <div className="skeleton" style={{ width: 130, height: 36, borderRadius: 9 }} />
        </div>
        <div className="skeleton" style={{ height: 42, borderRadius: 10, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 11, width: 80, borderRadius: 4, marginBottom: 10 }} />
        {[0,1,2].map(i => (
          <div key={i} className="skeleton" style={{ height: 68, borderRadius: 13, marginBottom: 10 }} />
        ))}
        <div className="skeleton" style={{ height: 11, width: 90, borderRadius: 4, margin: '20px 0 10px' }} />
        {[0,1].map(i => (
          <div key={i} className="skeleton" style={{ height: 68, borderRadius: 13, marginBottom: 10 }} />
        ))}
      </div>
    </div>
  )
}
