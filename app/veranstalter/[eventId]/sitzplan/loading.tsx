export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="skeleton" style={{ height: 32, width: 140, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, width: 280 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 34, width: 120, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 34, width: 150, borderRadius: 8 }} />
        </div>
      </div>
      {/* Room/canvas area */}
      <div className="skeleton" style={{ height: 'calc(100vh - 260px)', minHeight: 400, borderRadius: 12 }} />
    </div>
  )
}
