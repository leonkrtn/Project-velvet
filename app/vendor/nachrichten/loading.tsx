export default function Loading() {
  return (
    <div style={{ display: 'flex', height: '100dvh', background: 'var(--bg)' }}>
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="skeleton" style={{ height: 36, borderRadius: 9 }} />
        </div>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 13, width: '70%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 11, width: '90%' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
    </div>
  )
}
