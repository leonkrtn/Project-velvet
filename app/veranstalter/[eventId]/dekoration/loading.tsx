export default function Loading() {
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', overflow: 'hidden', margin: '-36px -40px -60px' }}>
      {/* Left nav sidebar */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 8 }}>
        <div className="skeleton" style={{ height: 11, width: 70, marginBottom: 6, borderRadius: 4 }} />
        {[0,1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: 34, borderRadius: 8 }} />
        ))}
        <div className="skeleton" style={{ height: 28, width: 110, borderRadius: 8, marginTop: 8 }} />
      </div>
      {/* Canvas area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 28, width: 80, borderRadius: 6 }} />
          <div className="skeleton" style={{ height: 28, width: 90, borderRadius: 6 }} />
        </div>
        <div className="skeleton" style={{ flex: 1 }} />
      </div>
    </div>
  )
}
