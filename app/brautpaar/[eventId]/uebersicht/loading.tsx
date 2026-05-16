export default function Loading() {
  return (
    <div className="bp-page">
      <div className="bp-page-header">
        <div className="bp-skeleton" style={{ height: 11, width: 130, marginBottom: 8, borderRadius: 4 }} />
        <div className="bp-skeleton" style={{ height: 30, width: 260, marginBottom: 8, borderRadius: 8 }} />
        <div className="bp-skeleton" style={{ height: 16, width: 180, borderRadius: 6 }} />
      </div>
      {/* Countdown gold card */}
      <div className="bp-skeleton" style={{ height: 96, borderRadius: 12, marginBottom: '2rem' }} />
      {/* 4 stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[0,1,2,3].map(i => (
          <div key={i} className="bp-skeleton" style={{ height: 96, borderRadius: 12 }} />
        ))}
      </div>
      {/* Module heading + 3-col grid of 10 links */}
      <div className="bp-skeleton" style={{ height: 14, width: 70, marginBottom: 12, borderRadius: 6 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bp-skeleton" style={{ height: 52, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  )
}
