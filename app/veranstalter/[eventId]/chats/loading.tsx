export default function Loading() {
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', overflow: 'hidden', margin: '-36px -40px -60px' }}>
      {/* Conversation list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="skeleton" style={{ height: 16, width: 120 }} />
        </div>
        <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 8 }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 12, width: `${55 + (i * 11) % 25}%`, marginBottom: 5 }} />
                <div className="skeleton" style={{ height: 11, width: `${40 + (i * 7) % 30}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Message area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="skeleton" style={{ height: 14, width: 160 }} />
        </div>
        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[{ w: '50%', align: 'flex-start' }, { w: '40%', align: 'flex-end' }, { w: '55%', align: 'flex-start' }, { w: '35%', align: 'flex-end' }].map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.align as 'flex-start' | 'flex-end' }}>
              <div className="skeleton" style={{ height: 40, width: m.w, borderRadius: 12 }} />
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  )
}
