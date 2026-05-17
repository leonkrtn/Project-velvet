export default function Loading() {
  return (
    <div style={{ height: '100dvh', display: 'flex', overflow: 'hidden' }}>
      {/* Conversation list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--bp-rule)', background: 'var(--bp-white)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--bp-rule)' }}>
          <div className="bp-skeleton" style={{ height: 16, width: 120, borderRadius: 6 }} />
        </div>
        <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 10 }}>
              <div className="bp-skeleton" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="bp-skeleton" style={{ height: 12, width: `${60 + (i * 11) % 25}%`, marginBottom: 5, borderRadius: 4 }} />
                <div className="bp-skeleton" style={{ height: 11, width: `${45 + (i * 7) % 30}%`, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Message area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bp-ivory)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bp-rule)', background: 'var(--bp-white)' }}>
          <div className="bp-skeleton" style={{ height: 14, width: 160, borderRadius: 6 }} />
        </div>
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[{ w: '55%', align: 'flex-start' }, { w: '45%', align: 'flex-end' }, { w: '60%', align: 'flex-start' }, { w: '40%', align: 'flex-end' }].map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.align as 'flex-start' | 'flex-end' }}>
              <div className="bp-skeleton" style={{ height: 40, width: m.w, borderRadius: 12 }} />
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bp-rule)', background: 'var(--bp-white)' }}>
          <div className="bp-skeleton" style={{ height: 42, borderRadius: 10 }} />
        </div>
      </div>
    </div>
  )
}
