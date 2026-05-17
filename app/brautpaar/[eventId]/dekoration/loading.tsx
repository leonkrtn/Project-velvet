export default function Loading() {
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Left nav sidebar */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--bp-rule)', background: 'var(--bp-white)', display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 8 }}>
        <div className="bp-skeleton" style={{ height: 11, width: 70, marginBottom: 6, borderRadius: 4 }} />
        {[130, 110, 140, 120].map((w, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 34, borderRadius: 8 }} />
        ))}
        <div className="bp-skeleton" style={{ height: 28, width: 110, borderRadius: 8, marginTop: 8 }} />
      </div>
      {/* Canvas area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Canvas toolbar */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--bp-rule)', display: 'flex', gap: 8 }}>
          <div className="bp-skeleton" style={{ height: 28, width: 80, borderRadius: 6 }} />
          <div className="bp-skeleton" style={{ height: 28, width: 90, borderRadius: 6 }} />
        </div>
        {/* Canvas */}
        <div className="bp-skeleton" style={{ flex: 1 }} />
      </div>
    </div>
  )
}
