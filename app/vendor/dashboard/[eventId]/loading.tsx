export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 20px' }}>
      <div className="skeleton" style={{ height: 28, width: 200 }} />
      <div className="skeleton" style={{ height: 44 }} />
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton" style={{ height: 80 }} />
      ))}
    </div>
  )
}
