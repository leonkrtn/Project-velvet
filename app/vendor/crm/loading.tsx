export default function Loading() {
  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 20, width: 160, marginBottom: 7 }} />
              <div className="skeleton" style={{ height: 14, width: 100 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton" style={{ width: 86, height: 32, borderRadius: 8 }} />
              <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 8 }} />
              <div className="skeleton" style={{ width: 76, height: 32, borderRadius: 8 }} />
              <div className="skeleton" style={{ width: 60, height: 32, borderRadius: 9 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="skeleton" style={{ flex: 1, height: 36, borderRadius: 9 }} />
            <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 9 }} />
            <div className="skeleton" style={{ width: 72, height: 36, borderRadius: 9 }} />
          </div>
        </div>
        {/* List header */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 160px 120px 100px 90px', gap: 12, padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          <div />
          {[120, 100, 80, 60, 60].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 12, width: w, borderRadius: 4 }} />
          ))}
        </div>
        {/* List rows */}
        <div style={{ padding: '0 0 8px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 160px 120px 100px 90px', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 9 }} />
              <div>
                <div className="skeleton" style={{ height: 14, width: 160, marginBottom: 7, borderRadius: 5 }} />
                <div className="skeleton" style={{ height: 12, width: 120, borderRadius: 4 }} />
              </div>
              <div>
                <div className="skeleton" style={{ height: 13, width: 100, marginBottom: 6, borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 11, width: 70, borderRadius: 4 }} />
              </div>
              <div className="skeleton" style={{ height: 14, width: 70, borderRadius: 4, marginLeft: 'auto' }} />
              <div className="skeleton" style={{ height: 12, width: 55, borderRadius: 4, margin: '0 auto' }} />
              <div className="skeleton" style={{ height: 20, width: 62, borderRadius: 100, marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
