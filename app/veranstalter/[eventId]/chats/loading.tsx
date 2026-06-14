export default function Loading() {
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Conversation list */}
      <div className="chat-load-list" style={{ width: 300, minWidth: 300, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
        {/* Header: title + plus button + search */}
        <div style={{ padding: '18px 16px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="skeleton" style={{ height: 22, width: 56, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
          </div>
          <div className="skeleton" style={{ height: 34, borderRadius: 10 }} />
        </div>
        {/* Conversation items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px' }}>
              <div className="skeleton" style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div className="skeleton" style={{ height: 13, width: `${50 + (i * 11) % 25}%`, borderRadius: 4 }} />
                  <div className="skeleton" style={{ height: 11, width: 30, borderRadius: 4 }} />
                </div>
                <div className="skeleton" style={{ height: 12, width: `${40 + (i * 7) % 30}%`, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message area */}
      <div className="chat-load-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', minWidth: 0, overflow: 'hidden' }}>
        {/* Chat header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div className="skeleton" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0 }} />
          <div>
            <div className="skeleton" style={{ height: 14, width: 160, marginBottom: 5, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 11, width: 90, borderRadius: 4 }} />
          </div>
        </div>
        {/* Messages */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          {[{ w: '52%', align: 'flex-start', h: 42 }, { w: '38%', align: 'flex-end', h: 38 }, { w: '58%', align: 'flex-start', h: 60 }, { w: '34%', align: 'flex-end', h: 38 }, { w: '46%', align: 'flex-start', h: 42 }].map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.align as 'flex-start' | 'flex-end' }}>
              <div className="skeleton" style={{ height: m.h, width: m.w, borderRadius: 12 }} />
            </div>
          ))}
        </div>
        {/* Input bar */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <div className="skeleton" style={{ flex: 1, height: 40, borderRadius: 22 }} />
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
        </div>
      </div>
    </div>
  )
}
