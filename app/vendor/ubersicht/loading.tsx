export default function Loading() {
  return (
    <div style={{ padding: '28px 24px 48px', background: 'var(--bg)', flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 20, width: 180, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 13, width: 280 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 20 }}>
            {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
          </div>
        </div>
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      </div>
    </div>
  )
}
