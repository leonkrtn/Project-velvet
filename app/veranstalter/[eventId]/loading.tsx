export default function Loading() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="skeleton" style={{ height: 32, width: 240 }} />
      <div className="skeleton" style={{ height: 20, width: 160 }} />
      <div className="skeleton" style={{ height: 280 }} />
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="skeleton" style={{ flex: 1, height: 120 }} />
        <div className="skeleton" style={{ flex: 1, height: 120 }} />
      </div>
    </div>
  )
}
